# Execution Roadmap — ESSKULTUR Restaurant OS

## Phase 1: Booking System + Platform Foundation (NOW → Q2 2026)

**Goal**: Restaurants can book online, manage bookings in real-time; new restaurants can self-serve sign up.

### Deliverables

- ✅ Online booking form (form → D1 → guest + operator alert)
- ✅ Onsite booking (staff-created, same D1 path)
- ✅ Booking board (real-time table layout, stage management)
- ✅ Staff app (PIN login, stage actions, basic order flow)
- Admin UI (setup wizard, config, reporting)
- Multi-tenant infrastructure (tenant isolation verified)
- **Platform marketing site** (`restaurantos.app`): features overview, pricing tiers, signup CTA
- **Self-service signup + onboarding**: restaurant creates account → tenant provisioned → setup wizard
- **Tenant template website**: restaurant gets their own hosted site at `{subdomain}.restaurantos.app` (3 templates: Minimal, Modern, Premium)

### Definition of Done

- Booking form working for 5+ test restaurants (online + onsite)
- Platform site live at `restaurantos.app` with pricing + working signup
- Restaurant can self-serve: sign up → subdomain chosen → template live → booking form active
- E2E tests passing (booking → confirmation → staff notification)
- D1 schema optimized, indexes in place
- < 500ms API latency for all endpoints
- SSE updates in real-time

### Key Metrics

- Booking creation: < 2s
- Guest-to-staff notification: < 1s
- Page load: < 1s

---

## Phase 2: Staff Mobile UI & Operations (Q2 → Q3 2026)

**Goal**: Staff works 100% on mobile phone (no tablet/desktop needed).

### Deliverables

- Staff app redesign (mobile-first, touch UI)
- Quick actions (confirm booking, send SMS, print label)
- Kitchen display system (KDS) integration
- Shift management (start/end shift, break tracking)
- Order aggregation (online + phone + walk-in)

### Definition of Done

- Staff can handle 50+ bookings/day from phone
- Touch targets for all buttons (no misclicks)
- Offline support (cache last 24h data)
- Battery test: 8h continuous use

### Key Metrics

- Average task time: < 5s
- Task completion rate: > 95%

---

## Phase 3: POS + Payment + TSE (Q3 → Q4 2026)

**Goal**: Complete restaurant operations on the platform (no external POS needed).

### Deliverables

- POS table layout (drag-drop tables, move/split tables)
- Order flow (dine-in → send to kitchen → serve → close table)
- Item management (categories, variants, modifiers, prices)
- Kitchen workflow (screen display, prep times, mark ready)
- Payment processing (Stripe, card, cash, split bill, tip)
- FiskFally TSE integration (signed receipt, audit trail)

### Definition of Done

- Handle 200+ orders per day
- Kitchen display updates < 500ms
- Payment processing: < 3s
- Receipt printing with TSE signature
- Full audit trail for compliance

### Key Metrics

- Average bill close time: < 3 min
- Payment success rate: > 99%
- TSE compliance: 100%

---

## Phase 4: CRM Module + Odoo Cut (Q4 2026 → Q1 2027)

**Goal**: Replace Odoo with a first-party CRM module. Hard-cut all Odoo integrations. Online and onsite booking flows remain fully operational throughout.

### Deliverables

- **CRM module** (built in-house):
  - Customer profiles (name, phone, email, notes, tags)
  - Full booking history per customer
  - Communication log (SMS/email sent)
  - Membership/segment tracking (VIP, Founder, KC, etc.)
  - Staff-facing customer search + notes
- Archive all Odoo sync code (webhooks, Make.com automations)
- Ensure zero Odoo API calls anywhere in codebase
- Decommission Make.com booking/CRM workflows

### Definition of Done

- CRM module live and staff-accessible
- Zero Odoo API calls in codebase (grep-verified)
- All customer data searchable from native CRM
- Booking flows unchanged (online + onsite still fully operational)
- E2E tests passing for CRM CRUD + booking-to-customer linkage

### Key Metrics

- Customer lookup: < 200ms
- Booking-to-profile linkage: automatic on booking creation
- Operational latency reduced 40% (no external sync)

---

## Phase 5: Growth Module Rollout (Q1 → Q3 2027)

**Goal**: Add revenue-generating features (loyalty, shop, marketing).

### Deliverables

- Loyalty program (points, tiers, rewards)
- Ecommerce shop (menu items for preorder/delivery)
- Discount & voucher system
- Marketing automation (email, SMS campaigns)
- Reporting & analytics dashboard
- Multi-location support

### Definition of Done

- 50+ restaurants active
- < 5 support tickets per week
- Net Promoter Score (NPS) > 50

### Key Metrics

- Customer retention: > 80%
- Expansion revenue: 30% of base

---

## Phase 6 (Backlog): Advanced Features

- Custom integrations API
- Menu sync with Stripe/Uber Eats
- Staff scheduling & shift planning
- Inventory management
- Membership/pre-order fulfillment
- Multi-language support

---

## Success Criteria (All Phases)

| Criteria | Target | Phase |
|----------|--------|-------|
| Onboarding time | < 1 hour | 1 |
| Time to first booking | < 30 min | 1 |
| Staff adoption | > 90% daily use | 2 |
| POS revenue | < 3s close | 3 |
| Uptime | 99.9% | All |
| Support tickets | < 5/week | All |
| NPS | > 50 | All |

---

## Dependencies

### External

- Stripe account (Phase 3)
- Fiskally test account (Phase 3)
- SMS provider (Phase 2)
- Email provider for marketing (Phase 5)

### Internal

- Phase 1 must complete before Phase 2 (staff needs booking data)
- Phase 3 depends on Phase 2 (staff uses POS on mobile)
- Phase 4 can run parallel to Phase 3 (just requires feature flag)
