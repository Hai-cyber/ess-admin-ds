# System Architecture — ESSKULTUR Restaurant OS

## Core Principle

This is a vertical SaaS for restaurants, not a general ERP.

**Non-goals:**
- No business logic in Odoo
- No dependency on Make.com for core flow
- No generic ERP scope

---

## Runtime Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                         │
├──────────────────────┬──────────────────┬───────────────────┤
│   TenantWebsite      │   Admin UI       │   Staff Mobile    │
│ (booking, menu,      │ (config, settings│ (operations,      │
│  payment)            │  staff mgmt)     │  orders, tables)  │
└──────────────────────┴──────────────────┴───────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│            CLOUDFLARE WORKERS (Business Logic)              │
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│  Auth    │ Booking  │   POS    │ Payment  │ Marketing      │
│ (magic   │ (tables, │ (orders, │ (Stripe, │ (campaigns,    │
│  link,   │  stages) │  kitchen)│ PayPal)  │  SMS/email)    │
│  Google, │          │          │          │                │
│  session │          │          │          │                │
│  auth +  │          │          │          │                │
│  board   │          │          │          │                │
│  PIN)    │          │          │          │                │
└──────────┴──────────┴──────────┴──────────┴────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│          CLOUDFLARE D1 (Source of Truth - SQLite)           │
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│ Tenants  │ Users    │ Bookings │  Orders  │ Payments       │
│ Settings │ Staff    │ Stages   │ Items    │ Transactions   │
└──────────┴──────────┴──────────┴──────────┴────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│           EXTERNAL INTEGRATIONS (Optional)                  │
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│ Stripe   │  Twilio  │ Fiskaly  │ Email    │ SMS/WhatsApp   │
│ PayPal   │ Telegram │ (TSE)    │ Sendgrid │ Vendors        │
└──────────┴──────────┴──────────┴──────────┴────────────────┘
```

---

## Tenant Provisioning Flow

When a restaurant signs up:

```
1. SIGNUP ENDPOINT
   POST /api/tenants/signup
  body: { name, email, phone, plan, identity_provider }
   
   ↓

2. CREATE TENANT
   INSERT INTO tenants (id, name, company_id, plan, status)
   
   ↓

3. PROVISION D1 SCHEMA (Logical isolation)
   - Create tenant-scoped settings
  - Initialize owner membership and tenant-scoped defaults
   - Create booking schedule template
   
   ↓

4. ASSIGN SUBDOMAIN
   { tenant_id }.restaurantos.app
   → CNAME to Cloudflare
   
   ↓

5. INITIALIZE MODULES (per plan)
   Core: booking, POS, payment, admin UI, staff UI
   Commerce: +shop, +delivery
   Growth: +loyalty, +marketing
   
   ↓

6. CREATE OWNER IDENTITY + MEMBERSHIP
  INSERT INTO users (...)
  INSERT INTO memberships (... role = tenant_admin)
   
   ↓

7. OPTIONAL BOARD BOOTSTRAP
  INSERT INTO staff (... role, board_pin)

  ↓

8. RETURN ACCESS PATHS
  { tenant_subdomain, setup_url, login_hint, board_launch_url }
```

---

## Multi-Tenant Database Model

### Rule: Every table has `tenant_id`

```sql
-- Core tables
CREATE TABLE tenants (
  id STRING PRIMARY KEY,
  name STRING NOT NULL,
  plan STRING, -- 'core', 'commerce', 'growth', 'enterprise'
  domain STRING, -- optional custom
  status STRING, -- 'trial', 'active', 'suspended'
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE users (
  id STRING PRIMARY KEY,
  email STRING NOT NULL,
  display_name STRING,
  auth_status STRING,
  created_at TIMESTAMP
);

CREATE TABLE memberships (
  id STRING PRIMARY KEY,
  tenant_id STRING NOT NULL,
  user_id STRING NOT NULL,
  role STRING, -- 'platform_admin', 'tenant_admin', 'manager', 'viewer'
  created_at TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE sessions (
  id STRING PRIMARY KEY,
  user_id STRING NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE staff (
  id STRING PRIMARY KEY,
  tenant_id STRING NOT NULL,
  name STRING NOT NULL,
  phone STRING,
  pin STRING, -- hashed, board-only
  role STRING, -- 'hostess', 'bartender', 'manager', 'admin'
  permissions JSONB,
  created_at TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE bookings (
  id STRING PRIMARY KEY,
  tenant_id STRING NOT NULL,
  phone STRING NOT NULL,
  name STRING NOT NULL,
  guests_pax INT,
  booking_datetime TIMESTAMP,
  area STRING, -- 'indoor', 'outdoor', 'garden', 'bar'
  stage STRING, -- 'pending', 'confirmed', 'arrived', 'done', 'cancelled', 'noshow'
  notes STRING,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE orders (
  id STRING PRIMARY KEY,
  tenant_id STRING NOT NULL,
  booking_id STRING,
  table_id STRING,
  status STRING, -- 'open', 'sent_to_kitchen', 'ready', 'served', 'paid'
  total_amount DECIMAL,
  created_at TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- All other tables follow same pattern
```

### Query pattern

```javascript
// ✅ ALWAYS query with tenant_id
const booking = await db.query(
  'SELECT * FROM bookings WHERE tenant_id = ? AND id = ?',
  [tenant_id, booking_id]
);

// ❌ NEVER query without tenant_id
const booking = await db.query(
  'SELECT * FROM bookings WHERE id = ?',
  [booking_id]
); // WRONG - tenant leak
```

---

## Module Architecture

Each module is independent, with clear entry points:

```
module/
├── api.js          -- Exported Worker handlers
├── db.js           -- Database queries (always tenant_id)
├── schema.json     -- Config validation
└── README.md       -- Module docs
```

Example: Booking module
```
src/modules/booking/
├── api.js
│  ├─ POST /api/bookings/create
│  ├─ GET /api/bookings?date=...
│  ├─ POST /api/bookings/{id}/stage
│  └─ SSE /api/notifications/stream
├── db.js
│  ├─ queries for bookings, stages, actions
│  └─ all queries use tenant_id
├── schema.json
│  ├─ Validate config payload
│  └─ Settings keys: area_list, business_hours, etc.
└── README.md
```

---

## API Gateway Pattern

Worker routes all requests:

```javascript
// src/index.js (main Worker)
export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const tenant_id = getTenantFromRequest(request);
    
    // Route to correct module
    if (pathname.startsWith('/api/bookings')) {
      return bookingModule.handle(request, env, tenant_id);
    }
    if (pathname.startsWith('/api/orders')) {
      return posModule.handle(request, env, tenant_id);
    }
    // ...
    return new Response('Not found', { status: 404 });
  }
};
```

---

## Non-Functional Requirements

- **Tenant isolation**: No data leaks, all queries filtered by tenant_id
- **Latency**: < 200ms for all API responses
- **Scaling**: Support 1000+ concurrent requests per worker
- **Audit trail**: Log all state changes with timestamp, user_id, action
- **Rollback**: Version settings, staff can restore previous config
- **Secrets**: Never expose in frontend (API keys, tokens stored in env only)
- **Auth split**: Admin surfaces use identity-based sessions; Booking Board uses scoped PIN unlock only

