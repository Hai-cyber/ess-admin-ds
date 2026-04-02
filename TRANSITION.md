# Migration Plan — Odoo to Cloudflare-Native

**Status: IN PROGRESS (Phase 1: Booking System)**

---

## Problem Statement

### Current limitations (Odoo-centric architecture)

- **Latency**: Real-time operations blocked by Odoo sync delays (Make.com webhooks)
- **Incompatible workflows**: Odoo is CRM-first (leads, deals, stages), not operations-first (tables, orders, real-time)
- **Make.com dependency**: Business logic split between Odoo and Make.com (brittle, hard to debug)
- **Limited control**: Logic lives outside Cloudflare (need external vendor maintenance)
- **Blocker**: Staff cannot conduct fast dinner service with CRM-style delays

### Example: Real impact to users

```
Current flow (broken):
1. Guest books via form
2. Form hits Make.com (3-5s)
3. Make.com → Odoo (5-10s)
4. Odoo → webhook → Cloudflare (2-3s)
5. Staff sees notification (15-25s latency)

New flow (fast):
1. Guest books via form
2. Form hits Cloudflare Worker (< 500ms)
3. D1 write (< 100ms)
4. SSE notification to staff (< 200ms total)
RESULT: 25x faster
```

---

## Decision

✅ **Migrate to Cloudflare-native platform**

✅ **Cut Odoo entirely — no optional mirror, no sync path**

✅ **Build first-party CRM module** to replace Odoo's customer/contact tracking

### New operating model

```
Cloudflare Workers = business logic
Cloudflare D1 = source of truth
External systems (Stripe, Twilio, Fiskaly, SendGrid) = payment/messaging only
Odoo/Make.com = REMOVED
```

### Key implication

- Restaurants run on Cloudflare, not Odoo
- Odoo is hard-removed (not optional, not a mirror)
- Online and onsite booking flows remain fully operational throughout the migration
- Stage management (pending → confirmed → arrived → done) stays untouched
- CRM module (Phase 4) replaces all customer-tracking Odoo was doing
- Make.com removed from all flows

---

## Target Architecture

```
Website / Staff App / POS UI
              ↓
    Cloudflare Workers
    (business logic)
              ↓
       Cloudflare D1
       (single source)
              ↓
    External Integrations (messaging + payment only):
    ├─ Stripe (payment)
    ├─ Twilio (SMS/WhatsApp)
    ├─ Fiskaly (TSE)
    ├─ SendGrid (email)
    └─ [Odoo REMOVED — replaced by native CRM module]
```

---

## Migration Strategy

### Phase 1 (NOW): Booking system fully on Cloudflare

- Online booking form → D1 → SSE staff notification ✅
- Onsite booking (staff-created) → same D1 path ✅
- Stage management: pending → confirmed → arrived → done ✅
- Legacy Odoo webhook code is being removed from active runtime paths
- Make.com automations are out of the booking and ops path

**Outcomes**:
- Booking and ops flows are stable and production-ready
- No Make.com or Odoo in the critical path

---

### Phase 2: Staff Mobile + POS

- Mobile-first staff UI, offline support
- POS: table layout, order flow, kitchen display
- All data written to D1, not Odoo

---

### Phase 3: Payment + TSE

- Stripe integration for card payments
- Fiskaly TSE for signed German receipts
- Transactions logged in D1 payments table

---

### Phase 4: CRM Module + Odoo Hard Cut

- Build native CRM module: guest profiles, booking history, notes, tags, segments
- Archive all Odoo sync code and Make.com webhook integrations
- Cancel Odoo license
- Verify: `grep -r 'ODOO\|odoo' src/ --include='*.js'` returns zero runtime calls

**Non-negotiable**: Online and onsite booking flows continue operating unchanged throughout this phase.

**Outcomes**:
- Staff can look up any guest, see history, add notes — all from native UI
- Zero external CRM dependencies
- 40%+ latency improvement (no sync overhead)
- Odoo license cancelled

---

### Phase 5: Growth Features

- Loyalty program, shop, marketing campaigns
- CRM feeds audience targeting for campaigns
- 50+ restaurants active

---

## Critical Rules (Must follow)

### ✅ MUST

1. **All business logic in Workers**
   - Booking creation, stage changes, payment flows
   - Online and onsite booking flows are kept operational at all times

2. **All state in D1**
   - Restaurant config, staff, bookings, orders, customer CRM data
   - D1 is the only source of truth — no external mirror

3. **UI independent from any external system**
   - Staff app works with no dependency on Odoo or Make.com
   - Website forms post to Cloudflare Workers only

### ❌ MUST NOT

1. **Add anything new to Odoo**
   - Odoo is being removed; never add new Odoo-bound logic

2. **Depend on Make.com for any flow**
   - Make.com is fully decommissioned from booking, CRM, and ops paths

3. **Treat Odoo as a backup or mirror**
   - Odoo has no role going forward; all data lives in D1

---

## Current Phase Progress

### Phase 1: Booking System (NOW)

**Status: IN PROGRESS (75% COMPLETE)**

|Component|Status|Evidence|
|---------|------|--------|
|Booking API|✅ DONE|POST /api/bookings/create works, tested with 5+ restaurants|
|Form UI|✅ DONE|booking-form.html, danke-reservierung.html live|
|Booking Board|✅ DONE|Real-time table layout, stage buttons working|
|Staff App|✅ DONE|PIN login, booking list, notifications|
|Stage Engine|✅ DONE|pending → confirmed → arrived → done flows|
|SSE (Real-time)|✅ DONE|Notifications streaming to board + app|
|Tenant Isolation|✅ DONE|Per-restaurant data verified separate|
|Admin UI|🔄 DRAFT|Setup wizard framework, needs refinement|
|Migration from Odoo|✅ DONE|Booking creation bypasses Odoo, direct D1 write|

**Odoo Integration Status**:
- Booking sync to Odoo: code exists but not active — will be archived in Phase 4
- Make.com workflows: DISABLED for all critical paths
- Business logic: 100% in Cloudflare Workers
- CRM data: will move to native CRM module (Phase 4)

**Go-live ready**: Yes (with caveat: admin UI refinement pending)

---

## Next Steps (After Phase 1)

### Phase 2: Staff mobile UI (Q3 2026)

- Rebuild staff app for touch/mobile-first
- Offline support (cache booking data)
- Shift management

### Phase 3: POS + Payment (Q4 2026)

- Table layout (drag-drop, split tables)
- Order flow (dine-in → kitchen → serve → close)
- Stripe payment integration
- Fiskally TSE integration (signed receipts)

### Phase 4: CRM Module + Odoo Hard Cut (Q1 2027)

- Build native CRM module (booking history, guest profiles, notes, tags)
- Archive and remove all Odoo sync code
- Cancel Odoo license
- Verify: zero runtime Odoo calls in codebase

### Phase 5: Growth modules (Q2+ 2027)

- Loyalty program
- Ecommerce shop
- Marketing automation (fed by CRM segments)
- Multi-location support

---

## Risks & Mitigation

### Risk 1: Data loss during transition

**Mitigation**:
- D1 remains the single source of truth throughout the cutover
- Nightly verification on bookings, customers, and stage transitions
- Backups and export tooling replace any Odoo rollback assumption

### Risk 2: Staff adoption (learning new platform)

**Mitigation**:
- Onboarding calls per restaurant
- Video tutorials (staff app, POS)
- AI Copilot (step-by-step guidance)
- Support ticket response < 2h

### Risk 3: External system failure (Stripe, Twilio)

**Mitigation**:
- Graceful degradation (cash payments as backup)
- Fallback SMS provider (queue-based retry)
- D1 as source of truth (no data loss)

---

## Success Metrics

|Metric|Target|Phase|Evidence|
|------|------|-----|--------|
|Booking latency|< 500ms|1|API endpoint timing < 200ms|
|Staff notification|< 1s|1|SSE delivery confirmed|
|Booking-to-KDS|< 2s|2|Order on kitchen display|
|Payment processing|< 3s|3|Stripe response time|
|Platform uptime|99.9%|All|Cloudflare SLA met|
|Staff adoption|> 90% daily use|2|Usage analytics|
|Support tickets|< 5/week|All|Support dashboard|

---

## Communication Plan

### For restaurant owners

**Message**: "Your bookings work faster (25x), staff happier, zero data loss."

- Email: "We're upgrading to faster booking system"
- Demo: Show booking speed (old vs new)
- Promise: "No downtime, everything keeps working"

### For staff

**Message**: "Simpler app, works on phone, faster responses."

- In-app tutorial
- Onboarding call
- AI Copilot (on-screen helper)

### For team

**Message**: "Odoo is no longer blocking restaurant operations."

- Weekly sync: phase progress, blockers
- Technical design review: new module APIs
- Celebration: Phase 1 launch event

---

## Decision Record

- **Decision**: Migrate to Cloudflare-native platform
- **Author**: Product team
- **Date**: 2026-03-21
- **Status**: APPROVED
- **Replaces**: Previous multi-year Odoo+Make.com roadmap
