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
./
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

**Phase 1 stabilized / Phase 2 active build** (Q2 2026 transition, ~98% Phase 1 complete)

- ✅ Platform home, plans, contact form, and SaaS admin dashboard working locally
- ✅ Self-service signup provisions organization + company + owner identity bootstrap
- ✅ Booking board, staff app, onsite booking create, and stage updates verified locally
- ✅ Platform login/signup/pricing copy now supports EN/DE/VI browser-driven localization with contextual login routing
- ✅ Website master preview shipped with dynamic theme presets, schema examples, runtime tenant adapter, and form wiring for booking/contact/membership
- ✅ Website master boot now renders from embedded source first and hydrates runtime payload/presets in parallel for much faster perceived load
- ✅ Shared full-height mobile drawer shipped across website-master routes; luxury A/B navigation polish is live
- ✅ Restaurant Admin now includes a tenant-facing website content and opening-hours editor
- ✅ Wildcard tenant subdomains and demo-payment signup walkthrough verified live on gooddining.app
- ✅ Staff-mobile Phase 2 Wave 1 is live: triage queue, hot queue, one-tap actions, optimistic stage updates, and focused smoke coverage
- ✅ Staff-mobile Phase 2 Wave 2 is underway: quick walk-ins, richer walk-in fields, smarter defaults, direct pending-queue insertion, and transient new-booking highlighting
- 🔄 Remaining platform blockers are live board HTML cache freshness, production Stripe account setup, and Founder/KC production OTP follow-up

**Verified** (latest local runtime + focused tests):
- Platform site + signup provisioning live on localhost
- Platform landing/signup pricing updates live: Service POS + German checkout, Repeat Guests SMS + loyal guest messaging
- Public booking form renders; localhost `company_id` override submit works
- Staff create booking from board → all systems updated
- Staff-mobile Wave 1 focused tests pass for success, hot-queue semantics, and invalid-stage rejection
- Staff-mobile Wave 2 focused tests pass for quick walk-in shell and onsite booking creation
- Website payload now includes structured `opening_hours_schedule` while preserving legacy open/close values
- Tenant subdomain host-based website payload resolution verified live on wildcard routing
- Per-tenant data isolation working
- Vitest: focused staff-mobile Wave tests are passing locally; broader platform suite remains available via `npm test`

---

## 📦 Core Modules

| Module | Status | Purpose |
|--------|--------|---------|
| **Auth** | ✅ | Identity auth for admin surfaces plus board-scoped staff PIN for onsite operations |
| **Booking** | ✅ | Online reservations, stage management, staff mobile triage, and quick walk-ins |
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
| **CP-4: Staff Mobile** | ⏳ ACTIVE BUILD | Mobile-first triage live; Wave 2 quick walk-ins in progress |
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
