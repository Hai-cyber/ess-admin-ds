# Database Schema (Tenant-Scoped)

## Critical Tables for Tenant Isolation

All sensitive tables **must include** `company_id` column and **queries must filter** `WHERE company_id = ?`.

### customers

```sql
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  name TEXT,
  founder_status TEXT,    -- 'pending_verification', 'live', 'inactive'
  founder_level TEXT,     -- 'trial', 'gold', etc.
  founder_terms_accepted INTEGER,
  kc_terms_accepted INTEGER,
  otp_verified INTEGER,
  sms_opt_in INTEGER,
  opt_in_text TEXT,
  opt_in_timestamp TEXT,
  created_at TEXT,
  updated_at TEXT,
  created_by TEXT,
  updated_by TEXT,
  notes TEXT,
  UNIQUE(company_id, phone),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

**Tenant isolation:** `(company_id, phone)` unique constraint.

### bookings

```sql
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  guests_pax INTEGER,
  booking_date TEXT,
  booking_time TEXT,
  booking_datetime TEXT,
  area TEXT,             -- 'indoor', 'outdoor', 'garden', 'bar'
  stage TEXT,            -- 'pending', 'confirmed', 'arrived', 'done', 'cancelled', 'noshow'
  stage_id INTEGER,
  source TEXT,
  submitted_at TEXT,
  updated_at TEXT,
  updated_by TEXT,
  created_by TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  INDEX idx_company_date (company_id, booking_date)
);
```

**Tenant isolation:** All reads `/api/bookings` filter `WHERE company_id = ?`.

### staff

```sql
CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  name TEXT,
  pin TEXT,           -- 4-digit PIN
  role TEXT,          -- 'hostess', 'manager', 'admin'
  is_active INTEGER DEFAULT 1,
  permissions TEXT,   -- JSON array
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(company_id, pin),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

**Tenant isolation:** Auth via `(company_id, pin)`. Same PIN can exist across companies.

### settings

```sql
CREATE TABLE settings (
  company_id INTEGER,
  key TEXT,
  value TEXT,
  description TEXT,
  updated_at TEXT,
  updated_by TEXT,
  PRIMARY KEY (company_id, key),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

Stores per-company configuration (modules, integrations, operational).

### otp_cache

```sql
CREATE TABLE otp_cache (
  phone TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  otp_code TEXT,
  created_at TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

**Tenant isolation:** OTP per `(company_id, phone)` to prevent cross-tenant verification.

### contacts

```sql
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  subject TEXT,
  message TEXT,
  summary TEXT,
  is_meaningful INTEGER,
  status TEXT,           -- 'open', 'processed', 'spam'
  pushed_to_gmail INTEGER,
  submitted_at TEXT,
  processed_at TEXT,
  processed_by TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

**Tenant isolation:** All admin read/write scoped by `company_id`.

### media_assets

```sql
CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  title TEXT,
  alt_text TEXT,
  mime_type TEXT,
  data_url TEXT,         -- base64 image
  tags TEXT,             -- JSON array
  is_active INTEGER,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  INDEX idx_company_active (company_id, is_active)
);
```

**Tenant isolation:** Admin media library scoped per company.

## Metadata Tables (Not Tenant-Scoped)

### companies

```sql
CREATE TABLE companies (
  id INTEGER PRIMARY KEY,
  organization_id INTEGER,
  subdomain TEXT UNIQUE,
  name TEXT,
  email TEXT,
  phone TEXT,
  odoo_company_id INTEGER,
  odoo_url TEXT,
  is_active INTEGER DEFAULT 1,
  timezone TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
```

**Note:** No `company_id` column (it IS the ID). Used in **resolver to map subdomain → company**.

### organizations

```sql
CREATE TABLE organizations (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE,
  name TEXT,
  billing_email TEXT,
  phone TEXT,
  odoo_url TEXT,
  odoo_db_name TEXT,
  is_active INTEGER DEFAULT 1,
  timezone TEXT
);
```

Holds organization-level defaults; referenced by companies.

## Query Patterns

### ✅ Correct (Tenant-Scoped)

```js
// Booking read
await db.prepare(`
  SELECT * FROM bookings 
  WHERE company_id = ? AND id = ?
`).bind(companyId, bookingId).first();

// Staff auth
await db.prepare(`
  SELECT * FROM staff 
  WHERE company_id = ? AND pin = ?
`).bind(companyId, pin).first();

// Customer list
await db.prepare(`
  SELECT * FROM customers 
  WHERE company_id = ? 
  ORDER BY created_at DESC
`).bind(companyId).all();
```

### ❌ Incorrect (No Tenant Filter)

```js
// ❌ DON'T: Leaks data from all companies
await db.prepare(`SELECT * FROM bookings WHERE id = ?`).bind(bookingId).first();

// ❌ DON'T: Cross-tenant contamination risk
await db.prepare(`SELECT * FROM staff WHERE pin = ?`).bind(pin).first();
```

## Code References

- **Schema initialization**: [src/db/init.js](../../src/db/init.js)
- **Tenant-scoped queries (booking)**: [src/index.js:2851-2875](../../src/index.js#L2851)
- **Tenant-scoped queries (staff)**: [src/index.js:2019-2045](../../src/index.js#L2019)
