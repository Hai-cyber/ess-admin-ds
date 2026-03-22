# Data Contracts — Restaurant OS

**Purpose**: Define database schema, validation rules, and data relationships.

**Principle**: D1 is source of truth. All data must conform to schema.

---

## Database Schema

### Tenants Table

**Purpose**: Restaurant organizations. Created via self-service signup.

```sql
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,           -- = subdomain slug (e.g. 'trattoria-roma')
  name TEXT NOT NULL,
  plan TEXT NOT NULL,            -- 'core', 'commerce', 'growth', 'enterprise'
  status TEXT NOT NULL DEFAULT 'pending_email',
    -- 'pending_email'  → signed up, awaiting email verification
    -- 'trial_active'   → email verified, in 14-day trial, setup wizard in progress
    -- 'active'         → trial complete or paid subscription started
    -- 'suspended'      → payment failed or admin hold
    -- 'cancelled'      → account closed
  subdomain TEXT NOT NULL UNIQUE,  -- {subdomain}.restaurantos.app
  domain TEXT,                     -- custom domain (Phase 3+)
  owner_email TEXT NOT NULL,
  owner_phone TEXT,
  email_token TEXT,                -- short-lived verification token; cleared after verify
  email_verified_at TEXT,
  website_template TEXT DEFAULT 'minimal',  -- 'minimal' | 'modern' | 'premium'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  trial_started_at TEXT,
  activated_at TEXT,
  cancelled_at TEXT,

  FOREIGN KEY (plan) REFERENCES plans(id)
);

CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_email ON tenants(owner_email);
```

**Validation**:
- `id` / `subdomain`: lowercase, alphanumeric + dash, 3-30 chars; unique
- `name`: 1-100 chars
- `plan`: enum (core|commerce|growth|enterprise)
- `status`: enum (pending_email|trial_active|active|suspended|cancelled)
- `owner_email`: valid email
- `email_token`: UUID; cleared on verify; expires after 24h
- `website_template`: enum (minimal|modern|premium)

---

### Staff Table

**Purpose**: Restaurant users (hostess, bartender, manager, admin)

```sql
CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,  -- hashed 4-digit PIN
  role TEXT NOT NULL,  -- 'hostess', 'bartender', 'manager', 'admin'
  is_active INTEGER DEFAULT 1,  -- 0 = disabled, 1 = active
  permissions TEXT,  -- JSON array: ["view_bookings", "confirm_booking", ...]
  phone TEXT,
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,  -- staff_id of who created
  
  UNIQUE(tenant_id, pin),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_staff_tenant ON staff(tenant_id);
CREATE INDEX idx_staff_pin_tenant ON staff(tenant_id, pin);
```

**Validation**:
- `id`: UUID format
- `tenant_id`: Valid tenant reference
- `pin`: Exactly 4 digits (1000-9999)
- `role`: enum (hostess|bartender|manager|admin)
- `is_active`: 0 or 1
- `permissions`: JSON array

**Unique constraint**: Same PIN cannot exist within same tenant, but can exist across tenants

---

### Customers Table

**Purpose**: Restaurant guests who made bookings

```sql
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  total_bookings INTEGER DEFAULT 0,
  total_spend DECIMAL(10,2) DEFAULT 0.00,
  loyalty_points INTEGER DEFAULT 0,
  loyalty_tier TEXT,  -- 'bronze', 'silver', 'gold'
  sms_opt_in INTEGER DEFAULT 0,
  email_opt_in INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  UNIQUE(tenant_id, phone),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_phone_tenant ON customers(tenant_id, phone);
```

**Validation**:
- `phone`: E.164 format (+49xxxxxxxxx)
- `email`: Valid email (optional)
- `loyalty_tier`: enum (bronze|silver|gold) or NULL
- `sms_opt_in`: 0 or 1
- `email_opt_in`: 0 or 1

---

### Bookings Table

**Purpose**: Restaurant reservations

```sql
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  guests_pax INTEGER NOT NULL,  -- 1-12
  booking_date TEXT NOT NULL,  -- YYYY-MM-DD
  booking_time TEXT NOT NULL,  -- HH:MM
  booking_datetime TEXT NOT NULL,  -- ISO8601 with TZ
  area TEXT NOT NULL,  -- 'indoor', 'outdoor', 'garden', 'bar'
  stage TEXT NOT NULL DEFAULT 'pending',  -- pending|confirmed|arrived|done|cancelled|noshow
  stage_id INTEGER,  -- denormalized for board display
  source TEXT NOT NULL,  -- 'web', 'phone', 'onsite'
  duration_minutes INTEGER,  -- optional reservation length
  table_id TEXT,  -- POS table (when seated)
  order_id TEXT,  -- linked POS order
  notes TEXT,
  flag TEXT,  -- 'vip', 'founder', 'kc', 'birthday'
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT,
  arrived_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  created_by TEXT,  -- staff_id or 'web_form'
  updated_by TEXT,  -- staff_id who made last change
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (table_id) REFERENCES tables(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX idx_bookings_tenant_date ON bookings(tenant_id, booking_date);
CREATE INDEX idx_bookings_tenant_stage ON bookings(tenant_id, stage);
CREATE INDEX idx_bookings_phone ON bookings(tenant_id, phone);
```

**Validation**:
- `guests_pax`: 1-12
- `booking_date`: >= today, <= 60 days future
- `booking_time`: 00:00-23:59 (15-min slots)
- `area`: enum (indoor|outdoor|garden|bar)
- `stage`: enum (pending|confirmed|arrived|done|cancelled|noshow)
- `source`: enum (web|phone|onsite)
- `flag`: enum (vip|founder|kc|birthday) or NULL
- `duration_minutes`: 60-180 (or NULL for open-ended)

**Stage transitions** (valid paths):
```
pending → confirmed
pending → cancelled
confirmed → arrived
confirmed → cancelled
confirmed → noshow
arrived → done
arrived → cancelled
```

---

### Tables Table (POS)

**Purpose**: Restaurant table configuration and status

```sql
CREATE TABLE tables (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  number INTEGER NOT NULL,  -- table number (1, 2, 5, etc.)
  area TEXT NOT NULL,  -- 'indoor', 'outdoor', 'garden', 'bar'
  capacity INTEGER NOT NULL,  -- 2-12
  status TEXT NOT NULL DEFAULT 'free',  -- 'free', 'occupied', 'reserved', 'closed'
  current_booking_id TEXT,  -- booking when occupied
  current_order_id TEXT,  -- active order
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  UNIQUE(tenant_id, number),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (current_booking_id) REFERENCES bookings(id),
  FOREIGN KEY (current_order_id) REFERENCES orders(id)
);

CREATE INDEX idx_tables_tenant_area ON tables(tenant_id, area);
```

**Validation**:
- `number`: 1-30 (typical restaurant)
- `area`: enum
- `capacity`: 1-12
- `status`: enum (free|occupied|reserved|closed)

---

### Orders Table (POS)

**Purpose**: POS orders (meals, drinks, items)

```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  booking_id TEXT,  -- optional link to booking
  table_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',  -- 'open'|'sent_to_kitchen'|'ready'|'served'|'closed'
  items TEXT NOT NULL,  -- JSON array of { product_id, qty, price, notes }
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2),
  total DECIMAL(10,2) NOT NULL,
  tip DECIMAL(10,2),
  payment_id TEXT,  -- transaction ID from Payment module
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  created_by TEXT,  -- staff_id
  updated_by TEXT,
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (table_id) REFERENCES tables(id),
  FOREIGN KEY (payment_id) REFERENCES payments(id)
);

CREATE INDEX idx_orders_tenant_table ON orders(tenant_id, table_id);
CREATE INDEX idx_orders_status ON orders(tenant_id, status);
```

**Validation**:
- `status`: enum
- `items`: JSON array with product_id, qty, price
- `subtotal`, `tax`, `total`: DECIMAL(10,2) >= 0
- `tip`: DECIMAL(10,2) >= 0 or NULL

---

### Payments Table

**Purpose**: Transaction audit trail

```sql
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  method TEXT NOT NULL,  -- 'card', 'cash', 'split'
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'completed'|'failed'|'refunded'
  stripe_transaction_id TEXT,  -- external ref
  card_last_4 TEXT,  -- last 4 digits (or NULL for cash)
  receipt_url TEXT,  -- PDF/JPG URL
  tse_signature TEXT,  -- Fiskaly signature (TSE)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  refunded_at TEXT,
  created_by TEXT,  -- staff_id
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX idx_payments_tenant_date ON payments(tenant_id, created_at);
CREATE INDEX idx_payments_status ON payments(tenant_id, status);
```

**Validation**:
- `amount`: > 0
- `currency`: enum (EUR|USD|etc.) or specific set
- `method`: enum (card|cash|split)
- `status`: enum
- `stripe_transaction_id`: Stripe format (pi_xxx) or NULL
- `tse_signature`: TSE XML signature or NULL (required for Germany TSE compliance)

---

### Settings Table

**Purpose**: Per-tenant configuration

```sql
CREATE TABLE settings (
  tenant_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,  -- JSON string
  description TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  
  PRIMARY KEY (tenant_id, key),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_settings_tenant ON settings(tenant_id);
```

**Standard keys**:

| Key | Value type | Example |
|-----|-----------|---------|
| `restaurant_name` | string | "Esskultur Berlin" |
| `restaurant_address` | string | "Hauptstr. 1, 10115 Berlin" |
| `restaurant_phone` | string | "+49301234567" |
| `restaurant_email` | string | "info@esskultur.de" |
| `website_url` | string | "https://esskultur.de" |
| `business_hours_mon` | JSON | {"open":"10:00","close":"22:00"} |
| `business_hours_*` | JSON | ... (tue-sun) |
| `areas` | JSON array | ["indoor","outdoor","garden","bar"] |
| `payment_methods` | JSON array | ["card","cash","paypal"] |
| `booking_duration_default` | number | 90 (minutes) |
| `booking_advance_limit` | number | 60 (days) |
| `modules_enabled` | JSON array | ["booking","pos","payment"] |
| `stripe_account_id` | string | "acct_xxx" |
| `twilio_account_sid` | string | "*****" (encrypted) |
| `fiskaly_api_key` | string | "*****" (encrypted) |

---

### Notifications Table

**Purpose**: Message log (SMS, email, push)

```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  booking_id TEXT,
  channel TEXT NOT NULL,  -- 'sms', 'email', 'push', 'webhook'
  recipient TEXT NOT NULL,  -- phone, email, etc.
  message_type TEXT,  -- 'booking_confirmed', 'arrival_reminder', etc.
  status TEXT DEFAULT 'pending',  -- 'pending', 'sent', 'failed', 'bounced'
  external_ref TEXT,  -- SMS provider ID, etc.
  error TEXT,  -- failure reason
  sent_at TEXT,
  created_at TEXT NOT NULL,
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE INDEX idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX idx_notifications_status ON notifications(tenant_id, status);
```

---

## Tenant Isolation Rule

**CRITICAL**: Every SELECT query must include:

```sql
WHERE tenant_id = ?
```

Example (CORRECT):
```sql
SELECT * FROM bookings
WHERE tenant_id = ? AND booking_date = ?
```

Example (WRONG — causes data leak):
```sql
SELECT * FROM bookings
WHERE booking_date = ?  -- ❌ No tenant filter!
```

**Enforcement**: 
- Code review checks all SQL
- CI script runs `grep -r "SELECT.*FROM.*WHERE.*tenant_id"` to verify
- Failed queries abort deployment

---

## Data Validation

### Phone format validation

```javascript
const E164_REGEX = /^\+[1-9]\d{1,14}$/;
if (!E164_REGEX.test(phone)) {
  throw new Error('Invalid phone format (must be E.164)');
}
```

### Date validation

```javascript
const bookingDate = new Date('2026-03-22');
const today = new Date();
if (bookingDate < today) {
  throw new Error('Booking date must be in future');
}
if ((bookingDate - today) / (1000 * 60 * 60 * 24) > 60) {
  throw new Error('Can only book up to 60 days in advance');
}
```

### Enum validation

```javascript
const validAreas = ['indoor', 'outdoor', 'garden', 'bar'];
if (!validAreas.includes(area)) {
  throw new Error(`Area must be one of: ${validAreas.join(', ')}`);
}
```

---

## Indexes (Performance)

Create these indexes for query performance:

```sql
-- Booking queries (>90% of usage)
CREATE INDEX idx_bookings_tenant_date ON bookings(tenant_id, booking_date);
CREATE INDEX idx_bookings_tenant_stage ON bookings(tenant_id, stage);

-- Customer lookups
CREATE INDEX idx_customers_tenant_phone ON customers(tenant_id, phone);

-- Staff authentication
CREATE INDEX idx_staff_tenant_pin ON staff(tenant_id, pin);

-- Settings lookup (frequent)
CREATE INDEX idx_settings_tenant ON settings(tenant_id);

-- Payments audit
CREATE INDEX idx_payments_tenant_date ON payments(tenant_id, created_at);

-- Order status (kitchen display)
CREATE INDEX idx_orders_tenant_status ON orders(tenant_id, status);
```

---

## Migration Path

When schema changes:

1. **Add column**: No downtime migration
   ```sql
   ALTER TABLE bookings ADD COLUMN new_field TEXT;
   UPDATE bookings SET new_field = DEFAULT_VALUE;
   ```

2. **Remove column**: 
   - First deploy: Stop using column in code
   - Wait 30 days
   - Second deploy: Remove column

3. **Rename column**: 
   - Create new column
   - Copy data
   - Drop old column

---

## Backup & Recovery

- **D1 backups**: Every 6 hours (Cloudflare managed)
- **Point-in-time recovery**: 7 days history
- **Tenant cleanup**: No hard delete (soft delete + archive)

Example soft delete:
```sql
UPDATE bookings
SET deleted_at = NOW()
WHERE id = ? AND tenant_id = ?;

-- Then query ignores soft-deleted:
SELECT * FROM bookings
WHERE tenant_id = ? AND deleted_at IS NULL;
```

---

## Compliance

- **GDPR**: Per-tenant data deletion support
- **TSE (Germany)**: Payment audit trail with signed receipts
- **PCI-DSS**: No card data stored (Stripe only)

---

## Founder/KC Canonical Field Mapping (Reference Mode)

Purpose: Maintain a stable canonical data model so Founder/KC flows can be reactivated later without schema drift.

### Policy

- Founder/KC legacy forms are kept as reference assets.
- Active schema remains canonical in this file.
- Any reactivation must map legacy fields to canonical columns, not the opposite.

### Mapping Table

| Legacy Concept | Legacy Field | Canonical Column | Type | Transform |
|---|---|---|---|---|
| person name | `name` | `customers.name` | TEXT | trim + normalize spaces |
| contact phone | `phone` | `customers.phone` | TEXT | E.164 normalization |
| consent/opt-in | `opt_in` | `customers.sms_opt_in` | INTEGER | bool -> 0/1 |
| OTP verified | `otp_verified` | `customers.otp_verified` (if present) | INTEGER | bool -> 0/1 |
| founder status | `founder_status` | `customers.founder_status` | TEXT | enum normalize |
| founder level | `founder_level` | `customers.founder_level` | TEXT | enum normalize |
| KC terms accepted | `kc_terms_accepted` | `customers.kc_terms_accepted` | INTEGER | bool -> 0/1 |

### Reactivation Requirements

- Add migration notes before any schema change touching founder/KC columns.
- Preserve backwards-compatible transforms in API layer.
- Add regression tests for founder/KC mapping in tenant-isolated mode.
