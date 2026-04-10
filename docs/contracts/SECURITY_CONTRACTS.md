# Security Contracts — Restaurant OS

**Purpose**: Define tenant isolation, authentication, and authorization rules.

**Principle**: Fail-closed. No data leaks. No shortcuts.

---

## Authentication Contract

### Tenant Resolution

**Sources** (in order of precedence):

1. **Subdomain** (primary): `tenant_abc.gooddining.app` → `tenant_id = tenant_abc`
2. **Query override** (dev only): `?company_id=1` (localhost/workers.dev only)
3. **Authenticated admin session** (admin-only resolution path): session already carries the company or operator scope
4. **None**: Returns `400 tenant_required`

**Resolution function**:

```javascript
function resolveTenant(url, options = {}) {
  const host = new URL(url).hostname;
  
  // 1. Check override (dev only)
  if (options.company_id_override) {
    if (!['localhost', '127.0.0.1'].includes(host) && !host.includes('workers.dev')) {
      throw new Error('company_id_override_not_allowed');
    }
    return options.company_id_override;
  }
  
  // 2. Extract subdomain
  const match = host.match(/^([a-z0-9-]+)\.restaurantos\.app$/);
  if (!match) {
    throw new Error('tenant_required');
  }
  
  const tenant_id = match[1];
  
  // 3. Verify tenant exists and is active
  const tenant = db.prepare(
    'SELECT id FROM tenants WHERE id = ? AND status != "cancelled"'
  ).bind(tenant_id).first();
  
  if (!tenant) {
    throw new Error('tenant_not_found');
  }
  
  return tenant_id;
}
```

**Errors**:

| Error | Status | Meaning |
|-------|--------|---------|
| `tenant_required` | 400 | No subdomain, no override |
| `company_id_override_not_allowed` | 403 | Override attempted on production host |
| `tenant_not_found` | 404 | Tenant doesn't exist or cancelled |
| `tenant_subdomain_not_found` | 404 | Subdomain not in system |

---

### Identity Session Authentication

**Applies to**:
- Restaurant Admin
- SaaS Admin

**Requirements**:
- Browser session stored in `HttpOnly` cookie
- Server-side session record in D1 (`auth_sessions`)
- Session tied to `user_id` and explicit scope (`restaurant_admin` or `platform_admin`)
- Restaurant Admin session tied to a concrete `company_id`
- Platform Admin session tied to an authorized operator membership

**Session verification**:

```javascript
async function verifyAdminSession(request) {
  const cookies = parseCookies(request.headers.get('cookie') || '');
  const token = cookies.gd_admin_session;
  if (!token) throwError('auth_session_required', 401);

  const tokenHash = await sha256Hex(token);
  const session = await db.prepare(`
    SELECT s.user_id, s.session_scope, s.company_id, s.organization_id, s.expires_at, s.revoked_at,
           u.primary_email, u.display_name
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
    LIMIT 1
  `).bind(tokenHash).first();

  if (!session || session.revoked_at || Date.parse(session.expires_at) <= Date.now()) {
    throwError('auth_session_invalid', 401);
  }

  return session;
}
```

**Session scope rules**:

- `restaurant_admin`: may access tenant admin routes only for the bound company or an active company membership
- `platform_admin`: may access operator routes only with an active platform operator membership

### Board PIN Authentication

**Requirements**:
- 4 digits (1000-9999)
- Per-tenant unique (same PIN can exist across tenants)
- Valid only for Booking Board or other explicitly board-scoped operational flows
- Not accepted as the primary login path for Restaurant Admin or SaaS Admin

**PIN verification**:

```javascript
async function verifyBoardPIN(request) {
  const body = await request.json();
  const { pin, tenant_id } = body;
  
  // 1. Resolve tenant (already done by middleware)
  
  // 2. Validate PIN format
  if (!/^\d{4}$/.test(pin)) {
    throwError('invalid_pin_format', 400);
  }
  
  // 3. Query staff record
  const staff = await db.prepare(
    'SELECT * FROM staff WHERE tenant_id = ? AND pin_hash = ? AND is_active = 1'
  ).bind(tenant_id, bcrypt.hashSync(pin)).first();
  
  if (!staff) {
    // ⚠️ IMPORTANT: Don't reveal if tenant or PIN is wrong
    throwError('invalid_pin', 401);
  }
  
  // 4. Return staff record for board-scoped use
  return staff;
}
```

**Rate limiting on PIN guessing**:

```javascript
// After 5 failed attempts, lock for 15 minutes
const failedAttempts = await redis.incr(`pin_failures:${ip}:${tenant_id}`);
if (failedAttempts >= 5) {
  const lockTime = await redis.ttl(`pin_lock:${ip}:${tenant_id}`);
  if (lockTime > 0) {
    throwError('too_many_attempts', 429);
  }
  await redis.setex(`pin_lock:${ip}:${tenant_id}`, 900, '1');
}
```

---

### Identity Providers

**Current target providers**:
- Email magic link
- Google OAuth

**Not in scope yet**:
- Microsoft
- generic SAML or OIDC SSO

---

## Authorization Contract

### Role-Based Access Control (RBAC)

**Roles**:

| Role | Permissions | Use case |
|------|-------------|----------|
| `platform_admin` | All SaaS Admin operations | Internal platform operator |
| `tenant_admin` | All Restaurant Admin operations | Restaurant owner/admin |
| `manager` | Bookings (update), staff limited, reporting | Senior staff |
| `hostess` | Bookings (confirm/arrive), POS view (read-only) | Front desk |
| `bartender` | POS (items, payment), orders only | Bar staff |
| `waiter` | Orders, payments, table status | Floor server |

**Permission checks**:

```javascript
function requirePermission(actor, permission) {
  const ROLES_PERMISSIONS = {
    'platform_admin': ['*'],
    'tenant_admin': ['*'],
    'manager': [
      'view_bookings',
      'confirm_booking',
      'view_staff',
      'edit_settings',
      'view_reports'
    ],
    'hostess': [
      'view_bookings',
      'confirm_booking',
      'create_booking'
    ],
    'bartender': [
      'view_orders',
      'add_items',
      'process_payment'
    ]
  };
  
  const staffPermissions = ROLES_PERMISSIONS[actor.role] || [];
  
  if (staffPermissions.includes('*')) {
    return true;  // Admin
  }
  
  if (!staffPermissions.includes(permission)) {
    throwError('permission_denied', 403);
  }
  
  return true;
}

// Usage in route
export async function handleRequest(request) {
  const actor = await verifyAdminSession(request);
  requirePermission(actor, 'confirm_booking');
  // Proceed with operation
}
```

### Dual-Stack Transition Rule

During the migration window:

- admin routes may accept either a valid admin session or the legacy PIN fallback
- board routes continue to accept PIN
- new features must default to session auth for admin surfaces

End state:

- Restaurant Admin and SaaS Admin use session auth only
- Booking Board keeps PIN

---

## Tenant Isolation Contract

### Rule: Every query must filter by tenant_id

**CORRECT**:
```sql
SELECT * FROM bookings WHERE tenant_id = ? AND booking_date = ?
```

**WRONG** (data leak):
```sql
SELECT * FROM bookings WHERE booking_date = ?
```

### Enforcement

**Code review checklist**:
```
- [ ] All SELECT statements include tenant_id filter
- [ ] All UPDATE statements filter by tenant_id
- [ ] All DELETE statements filter by tenant_id
- [ ] Foreign keys validate tenant relationship
- [ ] No cross-tenant queries possible
```

**CI/CD check** (runs on every commit):

```bash
#!/bin/bash
# scripts/verify-tenant-isolation.sh

echo "Checking for SQL queries without tenant_id filter..."
VIOLATIONS=$(grep -r "SELECT.*FROM.*WHERE" src/ \
  | grep -v "WHERE.*tenant_id" \
  | grep -v "test\|spec\|comment" \
  | wc -l)

if [ $VIOLATIONS -gt 0 ]; then
  echo "❌ Found $VIOLATIONS queries without tenant_id filter"
  exit 1
fi

echo "✅ All queries properly filtered"
exit 0
```

### Foreign Key Constraints

**Goal**: Prevent cross-tenant relationships

```sql
-- Create booking only if customer belongs to same tenant
ALTER TABLE bookings
ADD CONSTRAINT fk_bookings_customer_tenant
CHECK (
  SELECT tenant_id FROM customers WHERE id = customer_id
  = bookings.tenant_id
);
```

---

## Secrets Management

### Environment variables (never in code)

```
# Production (.env.production — NOT in git)
DATABASE_URL=https://...
STRIPE_SECRET_KEY=sk_live_...
TWILIO_ACCOUNT_SID=AC...
```

**Never commit secrets to git. Use Cloudflare Workers Secrets:**

```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put TWILIO_ACCOUNT_SID
```

### Encrypted settings storage

Sensitive tenant settings (API keys) encrypted at rest:

```javascript
// Encryption
async function encryptSetting(value) {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('hex');
}

// Decryption (only when needed)
async function decryptSetting(encrypted) {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  const buffer = Buffer.from(encrypted, 'hex');
  
  const iv = buffer.slice(0, 16);
  const tag = buffer.slice(16, 32);
  const data = buffer.slice(32);
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data, 'binary', 'utf8') + decipher.final('utf8');
}

// Usage: Only decrypt when sending to external API
const stripeKey = await decryptSetting(tenant.stripe_secret);
```

---

## Data Privacy

### GDPR compliance

**Right to deletion**: When tenant requests data deletion:

```javascript
async function deleteAllTenantData(tenant_id) {
  // Soft delete (for audit trail)
  await db.prepare(
    'UPDATE bookings SET deleted_at = NOW() WHERE tenant_id = ?'
  ).bind(tenant_id).run();
  
  await db.prepare(
    'UPDATE customers SET deleted_at = NOW() WHERE tenant_id = ?'
  ).bind(tenant_id).run();
  
  // ... all tables
  
  // Mark tenant as deleted
  await db.prepare(
    'UPDATE tenants SET status = "deleted", deleted_at = NOW() WHERE id = ?'
  ).bind(tenant_id).run();
}
```

**Note**: D1 backups retain data for 7 days (Cloudflare policy).

### PCI-DSS compliance

**Rule**: Never store card data locally

```javascript
// ✅ CORRECT: Use Stripe tokenization
const paymentMethod = await stripe.paymentMethods.create({
  type: 'card',
  card: { token: stripeToken }
});

// ❌ WRONG: Storing card data
db.prepare(
  'INSERT INTO payments (card_number, card_expiry) VALUES (?, ?)'
).run();  // NEVER DO THIS
```

---

## Audit Logging

### Every sensitive operation logged

```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT,  -- 'booking_confirmed', 'staff_created', 'settings_updated'
  resource_type TEXT,  -- 'booking', 'payment', 'staff'
  resource_id TEXT,
  old_value JSON,
  new_value JSON,
  timestamp TEXT,
  ip_address TEXT,
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

**Logged actions**:
- Booking creation
- Stage changes
- Staff additions/deletions
- Settings updates
- Payment processing
- Refunds

```javascript
async function logAudit(db, tenant_id, action, resource, oldValue, newValue) {
  await db.prepare(
    `INSERT INTO audit_log
     (tenant_id, user_id, action, resource_type, resource_id, old_value, new_value, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    tenant_id,
    getCurrentStaffId(),
    action,
    resource.type,
    resource.id,
    JSON.stringify(oldValue) || null,
    JSON.stringify(newValue),
    new Date().toISOString()
  ).run();
}
```

---

## Security Headers

All responses include:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
```

---

## HTTPS Enforcement

**Rule**: All endpoints HTTPS only (no HTTP)

**Enforcement**:
```javascript
if (url.protocol !== 'https:' && !url.hostname.includes('localhost')) {
  throwError('https_required', 403);
}
```

---

## Security Testing

### Run before deployment

```bash
# Check for hardcoded secrets
npm run check:secrets

# Check for SQL injection vulnerabilities
npm run check:sql-injection

# Check auth requirements
npm run check:auth-required

# Check tenant isolation
npm run check:tenant-isolation

# Check HTTPS
npm run check:https

# All security checks
npm run check:security
```

---

## Incident Response

### If data breach suspected

1. **Isolate**: Suspend affected tenant account immediately
2. **Investigate**: Query audit log for suspicious access
3. **Notify**: Contact tenant owner within 1 hour
4. **Document**: Create incident ticket (security@restaurantos.app)
5. **Remediate**: Reset secrets, rotate keys, audit all access
6. **Communication**: Send public security advisory if needed

### If attack detected

1. **Alert**: ops_team@restaurantos.app (automatic)
2. **Throttle**: Enable rate limiting on affected endpoint
3. **Block**: Block suspicious IPs
4. **Investigate**: Query logs for exploit patterns
5. **Patch**: Deploy fix within 4 hours
6. **Follow-up**: Security postmortem within 48h
