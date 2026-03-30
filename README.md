# ESSKULTUR — Restaurant OS

**Vertical SaaS for modern restaurant operations, built on Cloudflare.**

Not an ERP. Not Odoo. Not generic.

---

## 🚀 Quick Start

**New to the project?** Start here:

1. [PRODUCT.md](./PRODUCT.md) — Product positioning, business model, user society
2. [ARCHITECTURE.md](./ARCHITECTURE.md) — System design, multi-tenant data model, provisioning flow
3. [BUSINESS_MODEL.md](./BUSINESS_MODEL.md) — Pricing tiers (€29-€99/user), revenue streams, activation flow
4. [ROADMAP.md](./ROADMAP.md) — Execution phases (booking → POS → payment → remove Odoo)
5. [AI_CONTEXT.md](./AI_CONTEXT.md) — What this platform is, core rules, what NOT to do
6. [COPILOT_SPECIFICATION.md](./COPILOT_SPECIFICATION.md) — AI assistant design (process-bound, rule-based)
7. [MODULE_CATALOG.md](./MODULE_CATALOG.md) — Core modules (Auth, Booking, POS, Payment, Admin, Notifications, etc.)

---

## 💡 Key Principles

- **Cloudflare-native**: Workers = business logic, D1 = source of truth
- **Vertical SaaS**: Built for restaurants, not generic businesses
- **Multi-tenant**: Each restaurant has isolated data, shared infrastructure
- **Real-time**: No batch delays, instant updates for staff and guests
- **Tenant-first**: Every table has `tenant_id`, zero data leaks

---

## 📋 Project Structure

```
ess-admin-ds/
├── src/                  -- Current implementation (Workers, APIs, databases)
├── public/               -- Static assets (forms, pages)
├── cloudflare/           -- Target runtime architecture (coming)
├── knowledge/            -- Architecture docs, ADRs, specs, APIs
├── docs/                 -- Contracts, secrets, data, migration notes
├── test/                 -- Test suite
├── scripts/              -- Verification and checkpoint scripts
│
├── PRODUCT.md            -- ✨ Product positioning (START HERE)
├── ARCHITECTURE.md       -- System design
├── BUSINESS_MODEL.md     -- Pricing, revenue, activation flow
├── ROADMAP.md            -- Phases: booking → POS → payment → Odoo removal
├── CHECKPOINTS.md        -- Progress verification (8 checkpoints per phase)
├── COPILOT_SPECIFICATION.md -- AI assistant rules
├── MODULE_CATALOG.md     -- Core module definitions
├── DECISIONS.md          -- Architecture decision records (ADRs)
├── TRANSITION.md         -- Migration from Odoo to Cloudflare-native
└── AI_CONTEXT.md         -- Context guide for AI assistance
```

---

## 🎯 Current Status

**Phase 1: Booking + Platform Entry** (NOW → Q2 2026, ~88% complete)

- ✅ Platform home, plans, contact form, and SaaS admin dashboard working locally
- ✅ Self-service signup provisions organization + company + admin PIN user
- ✅ Booking board, staff app, onsite booking create, and stage updates verified locally
- ✅ Platform login/signup/pricing copy now supports EN/DE/VI browser-driven localization with contextual login routing
- ✅ Website master preview shipped with dynamic theme presets, schema examples, runtime tenant adapter, and form wiring for booking/contact/membership
- 🔄 Admin UI / go-live setup still incomplete
- 🔄 Founder/KC OTP runtime still blocked locally by missing Twilio credentials
- 🔄 Stripe checkout and tenant website publish/domain workflow still pending

**Verified** (2026-03-30 local runtime + tests):
- Platform site + signup provisioning live on localhost
- Platform landing/signup pricing updates live: Service POS + German checkout, Repeat Guests SMS + loyal guest messaging
- Public booking form renders; localhost `company_id` override submit works
- Staff create booking from board → all systems updated
- Stage transitions (pending → confirmed → arrived → done)
- Per-tenant data isolation working
- Vitest: 19/21 passing (2 founder/KC failures due Twilio credentials)

---

## 📦 Core Modules

| Module | Status | Purpose |
|--------|--------|---------|
| **Auth** | ✅ | Staff PIN login, role-based access |
| **Booking** | ✅ | Online reservations, stage management |
| **POS** | 🔄 | Table management, orders, kitchen display |
| **Payment** | 🔄 | Stripe integration, transaction handling |
| **Website** | ✅ | Master template preview, menu, booking/contact/membership wiring |
| **Admin** | 🔄 | Settings, staff management, reporting |
| **Notifications** | ✅ | Real-time SSE, SMS, email delivery |
| **Marketing** (Phase 5) | ❌ | Campaigns, discounts, loyalty |
| **Shop** (Phase 5) | ❌ | Ecommerce, preorder, delivery |

---

## 🛠️ Development

### Setup

```bash
npm install
npm run dev              # Start Wrangler dev server
npm run test             # Run tests
npm run deploy           # Deploy to Cloudflare
```

### Key Scripts

```bash
npm run check:tenant:failopen   # Verify no hardcoded fallback tenants
npm run check:tenant:sql        # Verify all SQL queries filter by tenant_id
npm run ci:verify               # Test suite + tenant guard checks
npm run ci                      # Full CI checks (structure + tenant isolation + tests)
```

### Checkpoints

See [CHECKPOINTS.md](./CHECKPOINTS.md) for 8 verification checkpoints across all phases:

| Checkpoint | Status | Purpose |
|-----------|--------|---------|
| **CP-1: Tenant Isolation** | ✅ DONE | No cross-tenant data leaks |
| **CP-2: Booking MVP** | ✅ DONE | Complete booking flow (form → board → notifications) |
| **CP-3: Admin UI Setup** | ⏳ IN PROGRESS | Setup wizard, go-live flow |
| **CP-4: Staff Mobile** | 📋 Phase 2 | Mobile-first, touch UI, 8h battery |
| **CP-5: POS System** | 📋 Phase 3 | Table mgmt, orders, kitchen, payment |
| **CP-6: Payment** | 📋 Phase 3 | Card, split bill, TSE receipts |
| **CP-7: Odoo Removed** | ❌ Phase 4 | Zero Odoo in critical path |
| **CP-8: Growth** | ❌ Phase 5 | Loyalty, shop, 50+ restaurants |

Manual runtime verification currently complements the automated scripts above.

### Environment

Copy `.dev.vars.example` to `.dev.vars` and fill in:
- `TURNSTILE_SECRET` — Cloudflare CAPTCHA
- `DATABASE_URL` — D1 connection string
- `STRIPE_SECRET_KEY` — Payment gateway (Phase 3)
- `TWILIO_ACCOUNT_SID` — SMS provider (Phase 2)

---

## 📊 Database

D1 (SQLite) schema with tenant isolation:

```sql
-- Example: every table has tenant_id
CREATE TABLE bookings (
  id STRING,
  tenant_id STRING NOT NULL,
  phone STRING NOT NULL,
  name STRING NOT NULL,
  guests_pax INT,
  booking_datetime TIMESTAMP,
  area STRING,
  stage STRING,
  created_at TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Query pattern: ALWAYS include tenant_id
SELECT * FROM bookings
WHERE tenant_id = ? AND created_at >= ?
```

---

## 🔐 Security & Compliance

- **Tenant isolation**: Every query filtered by `tenant_id`
- **No shared data**: Each restaurant's data is logically isolated
- **TSE compliance**: Signed receipts, audit trails (Phase 3)
- **PCI-DSS**: Payment handling via Stripe, no card data stored locally

---

## 🚀 Deployment

### Production

```bash
npm run deploy              # Deploy to Cloudflare Workers
wrangler publish           # Publish D1 migrations
```

### Monitoring

- Cloudflare Workers Analytics (requests, latency, errors)
- D1 Query Performance dashboard
- Custom alerting (email on 500 errors)

---

## 📞 Support

- **Documentation**: See PRODUCT.md, ARCHITECTURE.md, MODULE_CATALOG.md
- **Issues**: GitHub Issues (with `tenant_id` context)
- **Slack**: Engineering channel for architectural discussions

---

## 📄 License

Proprietary — ESSKULTUR GmbH 2026

---

## 🗺️ Roadmap Summary

| Phase | Focus | ETA |
|-------|-------|-----|
| 1 | Booking + Admin UI | Q2 2026 |
| 2 | Staff mobile UI | Q3 2026 |
| 3 | POS + Payment + TSE | Q4 2026 |
| 4 | Remove Odoo | Q1 2027 |
| 5 | Loyalty + Shop + Marketing | Q2+ 2027 |

See [ROADMAP.md](./ROADMAP.md) for detailed milestones.
