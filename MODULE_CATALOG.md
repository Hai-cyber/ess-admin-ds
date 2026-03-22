# Module Catalog — ESSKULTUR Restaurant OS

This document defines the core modules, their responsibilities, APIs, and data contracts.

---

## Module Framework

Each module follows this structure:

```
src/modules/{module_name}/
├── api.js           -- Exported HTTP handlers for routes
├── db.js            -- D1 queries (always include tenant_id)
├── schema.json      -- Config payload validation schema
├── README.md        -- Purpose, entry points, dependencies
└── __tests__/       -- Unit tests
```

Entry point in `src/index.js`:
```javascript
import({ module_name }) from './modules/booking';
// Routes dispatch to module handlers
```

---

## Core Modules

### 1. AUTH Module

**Purpose**: Tenant routing, staff PIN authentication, OAuth support (future).

**Routes**:
- `POST /auth/login` — PIN login for staff
- `POST /auth/verify-otp` — OTP verification
- `POST /auth/logout` — Logout
- `GET /auth/me` — Current user context

**Data**:
```javascript
{
  user_id: "staff_abc",
  tenant_id: "tenant_123",
  role: "admin", // admin, hostess, bartender, manager
  permissions: ["view_bookings", "create_booking", ...]
}
```

**Dependencies**: Session storage (Durable Object), D1 (staff table)

---

### 2. BOOKING Module ⭐ (Phase 1)

**Purpose**: Accept reservations, manage stages, send notifications.

**Routes**:
- `POST /api/bookings/create` — Guest submits booking
- `GET /api/bookings?date=YYYY-MM-DD` — List bookings for date
- `GET /api/bookings/{id}` — Booking detail
- `POST /api/bookings/{id}/stage` — Update stage (confirmed, arrived, done, cancelled)
- `DELETE /api/bookings/{id}` — Cancel booking
- `GET /api/notifications/stream` — SSE for real-time updates

**Data**:
```javascript
{
  id: "booking_abcd",
  tenant_id: "tenant_123",
  phone: "+49123456789",
  name: "Max Müller",
  guests_pax: 4,
  booking_datetime: "2026-03-21T19:30:00Z",
  area: "indoor",
  stage: "pending", // pending → confirmed → arrived → done
  notes: "Birthday party",
  created_at: "...",
  updated_at: "..."
}
```

**DB Queries**:
- Insert booking with `tenant_id`
- Filter by `tenant_id` + date
- Log stage change in `booking_actions`

**Dependencies**: Notifications (SSE), SMS/email (external)

---

### 3. POS Module ⭐ (Phase 3)

**Purpose**: Table management, order entry, kitchen workflow, payment.

**Routes**:
- `GET /api/pos/tables` — List all tables with status
- `POST /api/pos/orders` — Create order from booking
- `GET /api/pos/orders?status=open` — Kitchen view
- `PUT /api/pos/orders/{id}/status` — Update order status
- `POST /api/pos/orders/{id}/items` — Add items to order
- `DELETE /api/pos/orders/{id}/items/{item_id}` — Remove item
- `POST /api/pos/orders/{id}/payment` — Process payment (Stripe)
- `GET /api/pos/receipt/{id}` — Print receipt with TSE

**Data**:
```javascript
Order: {
  id: "order_xyz",
  tenant_id: "tenant_123",
  booking_id: "booking_abc",
  table_id: "table_5",
  status: "open", // open → sent_to_kitchen → ready → closed
  total: 89.50,
  items: [
    { id: "item_1", name: "Schnitzel", qty: 1, price: 18.50, status: "sent" }
  ],
  payments: [
    { id: "payment_1", amount: 89.50, method: "card", timestamp: "..." }
  ],
  created_at: "...",
  closed_at: "..."
}
```

**DB Queries**:
- Fetch tables by `tenant_id`
- Create order with `tenant_id`
- Update order items (log all changes)
- Query for kitchen display by `tenant_id`

**Dependencies**: Payment (Stripe), TSE (Fiskally), Notifications

---

### 4. PAYMENT Module ⭐ (Phase 3)

**Purpose**: Process payments, manage integrations, handle failures.

**Routes**:
- `POST /api/payments/charge` — Charge card via Stripe
- `GET /api/payments/methods?tenant_id=...` — List enabled payment methods
- `POST /api/payments/refund/{transaction_id}` — Refund transaction
- `GET /api/transactions?date=...` — Daily settlement report

**Data**:
```javascript
Transaction: {
  id: "txn_abc",
  tenant_id: "tenant_123",
  order_id: "order_xyz",
  amount: 89.50,
  currency: "EUR",
  method: "card", // card, cash, split
  status: "completed", // pending, completed, failed, refunded
  gateway_ref: "stripe_pi_123", // External reference
  timestamp: "...",
  receipt_tse: { ... } // TSE signature
}
```

**DB Queries**:
- Query transactions by `tenant_id` + date
- Store transaction with TSE receipt

**Dependencies**: Stripe SDK, Fiskally SDK, Journal (audit trail)

---

### 5. WEBSITE Module (Phase 1) — Tenant Template Site

**Purpose**: Serve each tenant's public-facing restaurant website from their subdomain. Restaurant owner configures content via Admin UI; guests see menu, booking form, and contact info.

**URL pattern**: `{subdomain}.restaurantos.app` → reads tenant config from D1

**Routes**:
- `GET /` — Restaurant homepage (template rendered with tenant settings)
- `GET /menu` — Menu page (items from `menu_items` settings)
- `GET /booking` — Booking form (delegates to BOOKING module)
- `GET /about` — About page (from tenant settings)
- `GET /contact` — Contact page
- `POST /api/contact` — Contact form submission

**Templates** (tenant picks one in Admin → Website Settings):
- `minimal` — Clean, single-column, fast load
- `modern` — Hero image, card grid, bold typography
- `premium` — Full-page sections, animations, gallery

**Data**:
```javascript
WebsiteConfig: {
  tenant_id: "tenant_123",
  template: "modern",        // minimal | modern | premium
  title: "Restaurant Esskultur",
  tagline: "Seit 2012 in Berlin.",
  logo_url: "https://...",
  hero_image_url: "https://...",
  accent_color: "#2D6A4F",
  menu_items: [
    { name, description, price, category, image_url }
  ],
  contact_phone: "+49...",
  contact_email: "info@...",
  address: "Hauptstr. 1, Berlin",
  social_links: { instagram: "...", facebook: "...", google: "..." },
  booking_enabled: true,
  custom_domain: null     // Phase 3+: point restaurant's own domain here
}
```

**DB Queries**:
- Fetch website config by `tenant_id` (settings table)
- Store contact submissions with `tenant_id`

**Dependencies**: CDN (images/assets), BOOKING module (booking form embed)

---

### 6. ADMIN Module ⭐ (Phase 1)

**Purpose**: Tenant restaurant admin only. Handles restaurant-scoped settings, staff management, billing setup, website builder content, and reporting.

**Routes**:
- `GET /api/admin/dashboard` — Overview (bookings, revenue, staff)
- `GET /api/admin/settings` — Restaurant config
- `PUT /api/admin/settings` — Update config
- `GET /api/admin/staff` — List staff
- `POST /api/admin/staff` — Add staff user
- `DELETE /api/admin/staff/{id}` — Remove staff
- `GET /api/admin/insights?date_from=...` — Reports

**Data**:
```javascript
Settings: {
  tenant_id: "tenant_123",
  name: "Restaurant Esskultur",
  address: "...",
  phone: "+49...",
  business_hours: { mon: { open: "10:00", close: "22:00" }, ... },
  areas: [ "indoor", "outdoor", "bar" ],
  payment_gateway: "stripe",
  sms_provider: "twilio",
  tse_provider: "fiskaly"
}
```

**DB Queries**:
- Fetch all config by `tenant_id`
- Update config (validate schema, log change)
- Fetch staff list by `tenant_id`

**Dependencies**: Schema validation, Audit log

**Not this module**:
- SaaS pricing management
- signup lead CRM
- platform-wide website builder defaults

These belong to the **PLATFORM admin surface**, not tenant admin.

---

### 7. NOTIFICATION Module ⭐ (Phase 1)

**Purpose**: Real-time updates, SMS, email delivery.

**Routes**:
- `GET /api/notifications/stream` — SSE for real-time
- `POST /api/notifications/settings` — Notification preferences
- `GET /api/notifications/history` — Past notifications

**Data**:
```javascript
Notification: {
  id: "notif_xyz",
  tenant_id: "tenant_123",
  booking_id: "booking_abc",
  type: "booking_confirmed", 
  channel: "sms", // sms, email, push, in-app
  status: "sent", // pending, sent, failed
  recipient: "+49...",
  message: "...",
  timestamp: "..."
}
```

**DB Queries**:
- Log notification by `tenant_id` + booking_id
- Query notification history by tenant

**Dependencies**: Twilio (SMS), SendGrid (email), Firebase (push)

---

### 8. MARKETING Module (Phase 5)

**Purpose**: Campaigns, discounts, loyalty programs.

**Routes**:
- `POST /api/marketing/campaigns` — Create campaign
- `GET /api/marketing/campaigns` — List campaigns
- `POST /api/marketing/discount` — Apply discount code
- `GET /api/marketing/loyalty` — Loyalty program status
- `POST /api/marketing/loyalty/redeem` — Redeem points

**Data**:
```javascript
Campaign: {
  id: "camp_abc",
  tenant_id: "tenant_123",
  name: "Spring Promotion",
  type: "email", // email, sms, push
  target_audience: "all", // all, vip, first_time
  status: "active",
  recipients_sent: 150,
  clicks: 23,
  conversions: 5
}
```

**Dependencies**: Email provider, SMS provider, Analytics

---

### 9. LOYALTY Module (Phase 5)

**Purpose**: Point-based loyalty, VIP tiers, rewards.

**Routes**:
- `GET /api/loyalty/{phone}` — Get loyalty status
- `POST /api/loyalty/{phone}/credit` — Add points
- `POST /api/loyalty/{phone}/redeem` — Redeem reward
- `GET /api/loyalty/rewards` — Available rewards

**Data**:
```javascript
LoyaltyAccount: {
  phone: "+49...",
  tenant_id: "tenant_123",
  points_balance: 450,
  tier: "gold", // silver, gold, platinum
  visits_count: 15,
  total_spend: 1250.00,
  joined: "2025-01-15"
}
```

---

### 10. SHOP Module (Phase 5)

**Purpose**: Ecommerce (menu preorder, delivery).

**Routes**:
- `GET /api/shop/products` — Product catalog
- `POST /api/shop/cart` — Add to cart
- `POST /api/shop/checkout` — Create order
- `GET /api/shop/orders/{id}` — Order tracking

**Data**:
```javascript
ShopOrder: {
  id: "shop_order_xyz",
  tenant_id: "tenant_123",
  phone: "+49...",
  items: [ { product_id, qty, price } ],
  total: 45.00,
  status: "processing", // processing → ready → delivered
  delivery_address: "...",
  delivery_time: "2026-03-22T18:30:00Z"
}
```

---

### 11. CRM Module ⭐ (Phase 4)

**Purpose**: First-party guest relationship management — replaces Odoo entirely. Tracks profiles, booking history, notes, tags, and membership segments per tenant.

**Routes**:
- `GET /api/crm/customers` — Search and list customers
- `GET /api/crm/customers/{phone}` — Customer profile + booking history
- `PUT /api/crm/customers/{phone}` — Update profile, notes, tags
- `GET /api/crm/customers/{phone}/history` — Full interaction timeline
- `POST /api/crm/customers/{phone}/notes` — Add staff note
- `DELETE /api/crm/customers/{phone}/notes/{id}` — Delete note
- `GET /api/crm/segments?tag=vip` — List customers by segment

**Data**:
```javascript
{
  phone: "+49123456789",
  tenant_id: "tenant_123",
  name: "Max Müller",
  email: "max@example.com",
  tags: ["vip", "birthday-june"],          // free-form staff tags
  segment: "gold",                         // vip | founder | kc | regular
  notes: [
    { id: "note_1", text: "Prefers window table", by: "staff_2", at: "..." }
  ],
  bookings_count: 14,
  last_visit: "2026-03-01",
  sms_opt_in: true,
  created_at: "...",
  updated_at: "..."
}
```

**DB Queries**:
- Look up customer by `(tenant_id, phone)` — auto-upsert on booking creation
- Full text search of `name` within `tenant_id`
- Query by tag/segment filtered by `tenant_id`
- Insert note with `tenant_id` + `customer_phone` + `staff_id`

**Dependencies**: Booking (auto-links on creation), Notifications (log SMS/email sent)

### 12. PLATFORM Module ⭐ (Phase 1)

**Purpose**: The Restaurant OS product's own public surface — `restaurantos.app`. Serves the marketing site (features, pricing, social proof), handles self-service signup, and provisions new tenants into D1.

**Note**: This module has **no `tenant_id`** context. It runs on the root domain, not a subdomain.

**Includes a separate SaaS Admin surface**:
- `GET /platform/admin` — operator console
- pricing management
- signup CRM-lite / follow-up workflow
- builder defaults for platform marketing + tenant template presets

**Routes** (no tenant required):

*Marketing*
- `GET /` — Homepage (hero, features, pricing tiers, CTA)
- `GET /pricing` — Full tier comparison (Core / Commerce / Growth / Enterprise)
- `GET /features` — Feature deep-dives
- `GET /templates` — Preview of 3 tenant website templates
- `GET /demo` — Book a demo form

*Self-Service Signup*
- `GET /signup` — Signup page (plan selection + account details)
- `POST /api/platform/signup` — Create new restaurant account
- `POST /api/platform/signup/verify-email` — Verify email token
- `GET /api/platform/signup/check-subdomain?slug=my-restaurant` — Availability check
- `GET /api/platform/plans` — Return tier definitions + pricing (public)

**Signup flow**:
```
Visitor hits /signup
  → Picks plan (Core / Commerce / Growth)
  → Enters: restaurant name, owner email, password, desired subdomain
  → POST /api/platform/signup
      → Validate subdomain availability
      → Create tenant row in D1 (status: pending_email)
      → Send verification email (SendGrid)
  → Owner clicks link in email
      → POST /api/platform/signup/verify-email
      → status: trial_active
      → Redirect to {subdomain}.restaurantos.app/admin/setup (wizard)
  → Owner completes Admin Setup Wizard
      → Restaurant name, address, hours, areas, staff PINs
      → Tenant website template picked
      → Go-live toggle → website + booking form live
```

**Data**:
```javascript
SignupPayload: {
  restaurant_name: "Trattoria Roma",
  owner_email: "owner@roma.de",
  owner_phone: "+49123456789",   // optional
  subdomain: "trattoria-roma",   // becomes trattoria-roma.restaurantos.app
  plan: "core",                  // core | commerce | growth | enterprise
  country: "DE"
}

TenantRow: {
  id: "trattoria-roma",          // = subdomain
  name: "Trattoria Roma",
  owner_email: "owner@roma.de",
  plan: "core",
  status: "pending_email",       // pending_email → trial_active → active → suspended
  subdomain: "trattoria-roma",
  email_token: "tok_xxxxx",      // cleared after verification
  created_at: "..."
}
```

**DB Queries** (platform-level tables, not scoped by tenant_id):
- `INSERT INTO tenants` on signup
- `UPDATE tenants SET status = 'trial_active'` on email verify
- `SELECT id FROM tenants WHERE subdomain = ?` for availability check

**Dependencies**: SendGrid (verification email), ADMIN module (redirects owner to setup wizard after verify)

---

## Module Dependencies Graph

```
Auth
  ↓
├→ Booking → Notification → SMS/Email
│    ↓
│    └→ CRM (auto-upsert customer on booking create)
│    └→ POS → Payment → Stripe
│                  ↓
│                  └→ TSE (Fiskaly)
│
├→ CRM → Booking (history read)
│
├→ Admin → Settings
│    ↓
│    └→ Staff
│
├→ Website → CDN
│
└→ Marketing
    ↓
    ├→ CRM (audience targeting)
    ├→ Loyalty
    ├→ Shop
    └→ Analytics
```

---

## Data Isolation Rules

### Every module MUST

✅ Include `tenant_id` in all queries
✅ Validate tenant context before returning data
✅ Log all mutations (create, update, delete)
✅ Use parameterized queries (prevent SQL injection)

### Every module MUST NOT

❌ Query across tenants
❌ Expose another tenant's data
❌ Hard-code business logic as strings (use settings)
❌ Sync to Odoo — Odoo is removed; use CRM module for customer data

---

## Testing Requirements

Each module must have:
- Unit tests (db queries with test tenant_id)
- Integration tests (full flow, tenant isolation)
- E2E tests (real API call with real tenant)

Example:
```javascript
test('booking create isolates tenant data', async () => {
  const booking_a = await bookingModule.create(tenant_a, bookingData);
  const bookings_b = await bookingModule.list(tenant_b); // should NOT see booking_a
  expect(bookings_b).not.toContain(booking_a);
});
```

---

## Versioning

- Module versions tracked in `CHANGELOG.md`
- Backward compatibility maintained (deprecation warnings)
- Breaking changes documented 2 weeks in advance
