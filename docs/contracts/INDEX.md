# Contracts Index — Restaurant OS

**Purpose**: Master index of all contracts (technical specifications). See this first.

**Principle**: Contracts are the source of truth for design and implementation. All PRs must verify compliance.

---

## Quick Navigation

### I'm implementing a new endpoint

→ Read [API_CONTRACTS.md](./API_CONTRACTS.md)

**You'll learn**:
- Endpoint method, path, auth
- Request body shape
- Response shape (success & error)
- Error codes
- Rate limits
- Performance targets

**Example**: 
```javascript
POST /api/bookings/create
Auth: None (CAPTCHA)
Rate: 10 req/min per IP
Target latency: < 500ms
Response: { ok: true, booking_id, redirect_url }
```

---

### I'm designing a database schema

→ Read [DATA_CONTRACTS.md](./DATA_CONTRACTS.md)

**You'll learn**:
- SQL CREATE TABLE statements
- Field validation rules
- Foreign key relationships
- Unique constraints
- Index strategy for perf
- Tenant isolation rule (✅ ALL queries filter by tenant_id)

**Example**:
```sql
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,     -- ✅ REQUIRED for isolation
  phone TEXT NOT NULL,
  booking_datetime TEXT NOT NULL,
  stage TEXT DEFAULT 'pending',  -- enum: pending|confirmed|arrived|done|cancelled|noshow
  ...
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Query pattern (REQUIRED):
SELECT * FROM bookings WHERE tenant_id = ? AND booking_date = ?
```

---

### I'm building or scaling website skins

→ Read [WEBSITE_TEMPLATE_CONTRACTS.md](./WEBSITE_TEMPLATE_CONTRACTS.md)

Then enforce publish gating with [WEBSITE_PUBLISH_VALIDATION.md](./WEBSITE_PUBLISH_VALIDATION.md)

**You'll learn**:
- The fixed-skin model for tenant websites
- Which payload fields are editable vs. fixed
- Stable page keys and section keys
- Media slot rules and fallback order
- What a tenant may customize without breaking rendering
- The validation rules required before publish

**Example**:
```json
{
  "tenant": {
    "theme": "theme-luxury-b",
    "tier": "premium",
    "content_preset": "theme-luxury-b"
  },
  "navigation": {
    "labels": {
      "menu": "Speisekarte"
    }
  }
}
```

This changes presentation and copy only. It does not change the internal page model.

For subdomain abuse protection, moderation review, and Telegram operator triage, also read:

- `knowledge/specs/subdomain-abuse-protection-spec.md`
- `knowledge/runbooks/content-review-telegram.md`

---

### I'm creating a new module

→ Read [MODULE_CONTRACTS.md](./MODULE_CONTRACTS.md)

**You'll learn**:
- Required file structure (api.js, db.js, schema.json)
- Module interface (what to export)
- How modules call each other
- Event publishing pattern
- Testing requirements (unit, integration, E2E)
- Module dependencies (what breaks if X fails?)

**Example**:
```
src/modules/booking/
├── api.js           -- HTTP handlers
├── db.js            -- D1 queries (all filter tenant_id)
├── schema.json      -- Input validation
├── README.md        -- Purpose, routes, dependencies
└── __tests__/       -- >80% coverage required
```

---

### I'm integrating with external systems

→ Read [INTEGRATION_CONTRACTS.md](./INTEGRATION_CONTRACTS.md)

**You'll learn**:
- Which external APIs we use (Stripe, Twilio, Fiskaly)
- Endpoint URLs and request/response shapes
- Error handling and retry logic
- Graceful degradation (what works without this integration?)
- Secrets management (where to store API keys)
- Testing with mocks vs. real services

**Example**:
```javascript
// Stripe charge
POST https://api.stripe.com/v1/payment_intents
{
  "amount": 2850,  // cents
  "currency": "eur",
  "payment_method": "pm_..."
}

// If Stripe unavailable
→ Staff can still take cash payment manually
→ Queue charge for retry
→ Alert ops_team@restaurantos.app
```

---

### I'm implementing authentication/authorization

→ Read [SECURITY_CONTRACTS.md](./SECURITY_CONTRACTS.md)

**You'll learn**:
- How tenant resolution works (subdomain vs. override)
- PIN authentication flow
- Role-based access control (admin, manager, hostess)
- Rate limiting (prevent bruteforce)
- Secrets management (where to store keys)
- Audit logging (what to log for compliance)
- Tenant isolation verification

**Example**:
```javascript
// Tenant resolution (priority order)
1. ?company_id=1 (only localhost/workers.dev)
2. subdomain (tenant_abc.gooddining.app)
3. None → 400 tenant_required

// PIN auth
POST /auth/login { pin: "1234", tenant_id: "tenant_abc" }
→ Hash PIN
→ Query: SELECT staff WHERE tenant_id = ? AND pin_hash = ?
→ Return staff record or 401 invalid_pin

// After 5 failed PIN attempts → lock for 15 minutes
```

---

### I'm handling errors

→ Read [ERROR_CONTRACTS.md](./ERROR_CONTRACTS.md)

**You'll learn**:
- Standardized error codes (validation_failed, not_found, etc.)
- HTTP status code mapping
- Request → Error response shape
- How clients should handle each error
- Localization support (i18n)
- Error monitoring/alerting

**Example**:
```javascript
// Request
POST /api/bookings/create
{ phone: "invalid_phone" }

// Response
HTTP 400
{
  "ok": false,
  "code": "invalid_phone_format",
  "message": "Phone must be E.164 format",
  "details": { "example": "+49123456789" }
}

// Client handles
if (result.code === 'invalid_phone_format') {
  showAlert('Please use format: +49123456789');
}
```

---

## Contract Compliance Checklist

Before any PR:

### ✅ API Contracts
- [ ] All endpoints defined in [API_CONTRACTS.md](./API_CONTRACTS.md)
- [ ] Request/response shapes match spec
- [ ] Error codes match [ERROR_CONTRACTS.md](./ERROR_CONTRACTS.md)
- [ ] Performance meets latency target
- [ ] Rate limits enforced
- [ ] All tenant-required endpoints have `tenant_id`

### ✅ Data Contracts
- [ ] All tables have `tenant_id` (if sensitive)
- [ ] All queries filter by `tenant_id`
- [ ] Validation rules enforced (phone format, date range, etc.)
- [ ] Foreign keys prevent cross-tenant queries
- [ ] Indexes created for common queries

### ✅ Module Contracts
- [ ] Module has proper folder structure
- [ ] Exports `api.js`, `db.js`, `schema.json`
- [ ] README documents routes and dependencies
- [ ] All DB calls pass `tenant_id`
- [ ] >80% test coverage
- [ ] No hardcoded globals (fail-open detection)

### ✅ Integration Contracts
- [ ] External APIs configured (Stripe, Twilio, etc.)
- [ ] Errors handled with retry logic
- [ ] Graceful degradation works
- [ ] Secrets not committed to git
- [ ] Mock integrations for testing

### ✅ Security Contracts
- [ ] Tenant resolution works (subdomain + override)
- [ ] PIN authentication implemented
- [ ] RBAC enforced per endpoint
- [ ] Rate limiting on bruteforce
- [ ] Audit logging for sensitive ops
- [ ] HTTPS enforced (no HTTP)
- [ ] No data leaks (E2E isolation test passes)

### ✅ Error Contracts
- [ ] Error codes standardized
- [ ] HTTP status codes correct
- [ ] Error responses have all fields
- [ ] Localization keys exist
- [ ] Client tests verify error handling

---

## Contract Naming Convention

| File | Covers | Use When |
|------|--------|----------|
| **API_CONTRACTS.md** | HTTP endpoints | Building APIs, debugging requests |
| **DATA_CONTRACTS.md** | Database schema | Designing tables, writing queries |
| **MODULE_CONTRACTS.md** | Module structure | Creating new modules, inter-module calls |
| **INTEGRATION_CONTRACTS.md** | External APIs | Stripe, Twilio, Fiskaly integration |
| **SECURITY_CONTRACTS.md** | Auth, isolation, compliance | Login, permissions, tenant safety |
| **ERROR_CONTRACTS.md** | Error codes, status codes | Error handling, client behavior |

---

## Phase Alignment

### Phase 1: Booking System

**Active contracts**:
- ✅ AUTH (PIN login)
- ✅ BOOKING (form → board → stage)
- ✅ NOTIFICATIONS (SSE, SMS)
- ✅ ADMIN (settings, staff)
- ✅ SECURITY (tenant isolation)
- ✅ ERROR (all codes)

**Modules to build**: BOOKING, ADMIN, NOTIFICATIONS, WEBSITE

---

### Phase 2: Staff Mobile UI

**New contracts**: None (reuse existing)

**Changes**: 
- Touch UI for BOOKING module
- Offline mode for BOOKING module
- Mobile error messages

---

### Phase 3: POS + Payment

**New contracts**:
- POS Module (tables, orders, KDS) → MODULE_CONTRACTS.md
- PAYMENT Module (Stripe, receipts) → INTEGRATION_CONTRACTS.md + MODULE_CONTRACTS.md

**Modules to build**: POS, PAYMENT, TABLES, ORDERS

**New endpoints**:
- GET /api/pos/tables
- POST /api/pos/orders
- POST /api/pos/orders/{id}/payment
- GET /api/pos/receipt/{id}

---

### Phase 4: Odoo Removal

**No new contracts** — just remove Odoo integration points

**Changes**:
- INTEGRATION_CONTRACTS.md: Remove Odoo section
- Remove webhook to Odoo in BOOKING module
- Archive Make.com workflows

---

### Phase 5: Growth Features

**New contracts**:
- LOYALTY Module → MODULE_CONTRACTS.md
- SHOP Module → MODULE_CONTRACTS.md
- MARKETING Module → MODULE_CONTRACTS.md

**New endpoints**:
- GET /api/loyalty/{phone}
- POST /api/loyalty/{phone}/redeem
- GET /api/shop/products
- POST /api/shop/orders
- POST /api/marketing/campaigns

---

## Contract Versioning

When contracts change:

**Minor change** (backward compatible):
- Add new optional field
- Add new error code
- Add new permission
- → No version bump

**Major change** (breaking):
- Remove field
- Change response shape
- Change error code meaning
- → Increment major version
- → Keep old contract alive 6 months
- → Notify restaurants 30 days before sunset

---

## Contract Review Process

1. **Design phase**: Propose new contract (PR to docs/contracts/)
2. **Feedback**: Team reviews, suggests changes
3. **Approval**: 2+ approvals required
4. **Implementation**: Code must match contract
5. **Testing**: E2E tests verify contract compliance
6. **Deployment**: CI checks contract compliance before merge

---

## Updating Contracts

**When to update**:
- New feature added
- Bug fix that changes error code
- Performance optimization reveals new SLA
- Security issue requires new validation

**How to update**:
1. Edit relevant contract file
2. Document change in section header (date, reason)
3. Add changelog entry
4. PR review required (any developer can approve)
5. Merge when approved

**Example entry**:
```markdown
## Changelog

### 2026-03-22
- Added POS module contracts (Phase 3 planning)
- Updated INTEGRATION_CONTRACTS: Added Fiskaly TSE

### 2026-03-15
- Initial Restaurant OS contracts (Phase 1)
- Superseded old multi-tenant generic contracts
```

---

## Contract Compliance Metrics

Track in CI/CD:

```
Contract Compliance Score:
- API endpoints: 95% (2 endpoints pending)
- DB schema: 100% (all tables have tenant_id)
- Modules: 85% (3/5 modules complete)
- Security: 100% (auth, isolation verified)
- Errors: 98% (1 error code TBD)
```

**Target**: 100% compliance before Phase launch

---

## Questions?

| Question | Answer |
|----------|--------|
| **"Where do I find the booking endpoint spec?"** | [API_CONTRACTS.md → BOOKING Module](./API_CONTRACTS.md#booking-module) |
| **"What tables do I need?"** | [DATA_CONTRACTS.md → all tables listed](./DATA_CONTRACTS.md#database-schema) |
| **"How do I create a new module?"** | [MODULE_CONTRACTS.md → Module Framework](./MODULE_CONTRACTS.md#module-framework) |
| **"What error codes should I use?"** | [ERROR_CONTRACTS.md → Error Code Directory](./ERROR_CONTRACTS.md#error-code-directory) |
| **"How do I ensure tenant isolation?"** | [SECURITY_CONTRACTS.md → Tenant Isolation Rule](./SECURITY_CONTRACTS.md#tenant-isolation-contract) |
| **"How do I integrate Stripe?"** | [INTEGRATION_CONTRACTS.md → Payment Integration](./INTEGRATION_CONTRACTS.md#payment-integration-contract) |

---

## Archive

**Old contracts** (superseded, kept for reference):

- [routes.md](../archive/2026-03/contracts-legacy/routes.md) — Legacy routes (old API spec)
- [db-schema.md](../archive/2026-03/contracts-legacy/db-schema.md) — Legacy schema (old generic SaaS)
- [tenant.md](../archive/2026-03/contracts-legacy/tenant.md) — Legacy tenant resolution (old implementation)
- [errors.md](../archive/2026-03/contracts-legacy/errors.md) — Legacy errors (incomplete)
- [sse.md](../archive/2026-03/contracts-legacy/sse.md) — Legacy SSE spec (partial)
- [tests.md](../archive/2026-03/contracts-legacy/tests.md) — Legacy test guide (outdated)

All functionality covered in new contracts. Old files kept for rollback if needed.

---

## Related Documents

- [MODULE_CATALOG.md](../../MODULE_CATALOG.md) — Module descriptions and status
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — System design and data model
- [CHECKPOINTS.md](../../CHECKPOINTS.md) — Verification checkpoints per phase
- [ROADMAP.md](../../ROADMAP.md) — Phase timeline and deliverables
