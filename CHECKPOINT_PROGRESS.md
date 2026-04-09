# Checkpoint Progress Tracker

**Purpose**: Track checkpoint completion as you move through phases. Update this weekly.

**Last Updated**: 2026-04-09  
**Current Phase**: Phase 1 (Booking + Platform Entry) — 93% complete

---

## Phase 1: Booking System + Platform Entry

**ETA**: Q2 2026  
**Status**: ⏳ IN PROGRESS (93% complete)

| Checkpoint | Component | Status | Evidence | Owner | ETA |
|-----------|-----------|--------|----------|-------|-----|
| CP-1 | Tenant Isolation | ✅ DONE | E2E_TEST_SUMMARY.md | Team | ✅ Done |
| CP-2 | Booking MVP | ✅ DONE | Local runtime verified: booking form render, board, staff-create, booking list, stage updates | Team | ✅ Done |
| CP-3 | Admin UI Setup | ⏳ 97% | Tenant admin now uses a role-aware Restaurant Admin shell with grouped setup navigation, explicit release/go-live workflow, and cleaner section visibility, while SaaS admin includes operator workflow overview and blocker inspection; remaining work is now mostly storage/custom-domain hardening | @dev-lead | Apr 12 |
| CP-10 | Platform Site + Self-Service Signup | ⏳ 99% | Live runtime verified, wildcard tenant subdomains resolve, moderation/release workflow is now explicit end to end, public tenant payload serves latest published release snapshots, and signup remains subdomain-first | @dev-lead | Apr 12 |
| **Phase 1 Total** | — | **93%** | — | — | **Apr 15** |

### CP-1 Evidence ✅

```bash
✅ Run: npm run check:cp-tenant-isolation
✅ Result: All SELECT queries include tenant_id
✅ Result: No hardcoded fallback tenants
✅ Result: E2E test passed (Tenant A ≠ Tenant B data)
```

### CP-2 Evidence ✅

```bash
✅ Run: npm test
✅ Result: booking isolation and SSE tests still pass locally
✅ Run: wrangler dev + manual smoke test on 2026-03-30
✅ Result: booking form renders for tenant host
✅ Result: localhost public booking submit works with `company_id` override
✅ Result: staff-create booking and stage transitions persist live
```

### CP-3/CP-10 Status ⏳

```bash
✅ Platform marketing site deployed on Cloudflare
✅ SaaS admin and restaurant admin split (separate routes and APIs)
✅ Signup endpoint provisions organization/company/admin staff user
✅ Platform contact form and admin dashboard verified live locally
✅ Demo payment flow and billable staff auto-recalc hook implemented
✅ Website master preview delivered with theme presets, schema examples, runtime adapter, and tenant injection
✅ Website-style booking flow and founder verify flow confirmed on active local runtime port `8790`
✅ Fixed-skin website template contract documented for the 8-skin approach
✅ Pre-publish validation contract documented for tenant website versions
✅ Website master boot now renders from embedded source first and hydrates runtime payload/presets in parallel, eliminating the branded master flash on first load
✅ Shared full-height mobile drawer shipped across all website-master routes; the old mobile tab strip is no longer the active navigation shell
✅ Restaurant Admin now exposes a website content editor for presentation-surface fields: text, photos, button labels, address, and opening hours
✅ Structured `opening_hours_schedule` now reaches the public website payload while keeping legacy open/close fallbacks intact
✅ Wildcard `*.gooddining.app` tenant routing and host-based payload resolution verified live
✅ Demo-payment self-service signup walkthrough verified live end to end with tenant provisioning and tenant subdomain access
✅ Tenant admin now includes a website release/go-live panel with preview URL, published URL, latest review state, and operator queue hand-off
✅ Tenant admin now renders a backend-driven go-live readiness checklist from `platform-config` so missing setup items are explicit before publish
✅ Tenant admin now shows release history and can roll back public website output to an older published snapshot
✅ Platform signup and tenant admin now support demo payment methods: PayPal, bank card, cash, and pick up at store
✅ SaaS Admin now controls payment method availability with platform-level toggles that enforce signup choices
✅ Tenant admin payment setup now shows which methods are disabled by SaaS policy, instead of silently clamping them
✅ Bank card signup can now open Stripe test checkout when `STRIPE_API_KEY` is configured or `STRIPE_MODE=mock`
✅ Post-checkout confirmation path now turns `stripe_checkout_pending` into `stripe_paid` and stores confirmation state in both signup records and tenant settings
✅ Stripe webhook endpoint now supports lifecycle updates for checkout completion and expiry without depending on browser redirect
✅ SaaS Admin signup list now shows payment lifecycle clearly: pending, paid, expired, method, reference, and confirmation time
✅ Payment audit timeline now persists in `payment_events` and is rendered inside SaaS Admin signup rows
✅ Failed or expired Stripe checkout sessions can now be remediated with retry checkout actions from SaaS Admin and tenant admin
✅ Stripe webhook coverage now includes a signed-payload test path, not only `mock` mode behavior
✅ Tenant admin can now submit a custom-domain upgrade request and mark DNS ready for operator review
✅ SaaS Admin now has a custom-domain request queue with approve, verify, activate, and reject actions
✅ Managed domain registration billing spec and operator workflow runbook now exist as separate project documents
✅ Custom-domain activation now persists a health check result and event log entry after operator activation
✅ Managed-registration requests now persist renewal tracking defaults for later reminder/billing workflows
✅ SaaS Admin domain queue now supports search/filter for open, active, renewal, and health-issue requests
✅ Public tenant resolution now supports custom-domain hosts directly and activation checks validate tenant website payload resolution on those hosts
✅ Managed domain renewal reminder job design is documented for future cron/queue automation
✅ Managed domain renewal reminder flow now has manual operator trigger + scheduled execution path
✅ Production env now targets a real custom-domain ingress path at `prod.gooddining.app`
✅ `prod.gooddining.app` verified live with `200` responses for `/api/health` and `/api/platform/plans`
✅ Renewal operator flow now supports preview, forced overdue escalation, and digest delivery channels
✅ Production ingress strategy has been simplified to a single hostname `prod.gooddining.app`
⚠️ Cloudflare dashboard still shows `Event Triggers` empty for `ess-admin-ds-prod`, but Wrangler CLI confirms the cron trigger is attached
✅ SaaS Admin moderation queue now has summary/filter/refresh controls on top of approve/reject/suspend/quarantine actions
✅ CP-3A go-live console gating is now wired into the tenant admin release panel with actionable blocker summaries
✅ CP-3B publish/release workflow is now an explicit state machine: `draft -> pending_review -> approved -> published -> rolled_back`
✅ Tenant admin now separates release submission from live publish, and approved releases must be published through a dedicated action
✅ SaaS Admin now renders workflow-oriented release status, hints, and mini timelines instead of a raw review list only
✅ SaaS Admin now includes a tenant workflow overview card layer and operator-only go-live blocker inspection per tenant
✅ Restaurant Admin shell now uses product-correct naming, grouped setup navigation, and role-aware section visibility for manager/admin scopes
✅ Runtime now supports storage-backed publish artifacts for live website releases when a `WEBSITE_PUBLISH_R2` binding is provisioned
✅ Custom-domain activation now requires an already-published release and blocks conflicting reserved/active domains before cutover
✅ Local smoke verification now covers `/api/contact/create`, platform contact, publish review, suspend, quarantine, and host-based public blocking
✅ Explicit `production` env now deploys against a real D1 database id
⏳ Production public ingress still blocked by Cloudflare `1050` until a real route is attached
⏳ Tenant website publish-to-storage still needs real bucket provisioning/binding plus deployment validation in the target environment
⏳ Tenant custom-domain upgrade workflow still needs richer reminder/cutover ops beyond the newly hardened activation guards
⏳ Founder/KC OTP runtime blocked locally by missing Twilio credentials or a local OTP stub decision
**Blockers**: storage bucket provisioning/deployment validation, richer custom-domain ops beyond activation hardening, Stripe test credentials, and Twilio credentials or a local OTP stub

**Next checkpoint steps**:
1. Publish tenant website output + assets to deployment storage and validate the subdomain-first public serving path.
2. Harden the tenant custom-domain upgrade workflow beyond the current MVP.
5. Keep subdomain-first signup as the default and add entitlement-based custom-domain upgrade requests.
6. Decide Twilio strategy for founder/KC locally, then close the OTP runtime gap.
7. Trust CLI trigger state over the empty dashboard `Event Triggers` panel unless Wrangler stops reporting `schedule: 0 9 * * *`.
8. Keep production on `prod.gooddining.app` unless there is a later, explicit need to split API or platform traffic to separate hostnames.

---

## Phase 2: Staff Mobile UI Ready

**ETA**: Q3 2026 (June-Aug)  
**Status**: 📋 PLANNED (Design phase)

| Checkpoint | Component | Status | Owner | ETA |
|-----------|-----------|--------|-------|-----|
| CP-4 | Staff Mobile | 📋 Design | @mobile-dev | May 1 |

### CP-4 Planned Work

```
- Redesign staff app for mobile-first (44x44px touch targets)
- Implement Service Worker (offline mode)
- Test battery drain (8h use target)
- E2E tests for mobile workflow
- Beta with 2 restaurants (May)
- GA (June)
```

---

## Phase 3: POS + Payment + TSE

**ETA**: Q4 2026 (Oct-Dec)  
**Status**: ❌ NOT STARTED (Depends on Phase 1 & 2)

| Checkpoint | Component | Status | Owner | ETA |
|-----------|-----------|--------|-------|-----|
| CP-5 | POS System | ❌ Planned | @pos-dev | Aug 1 |
| CP-6 | Payment Integration | ❌ Planned | @payment-dev | Aug 1 |

### CP-5 Planned Work

```
- Design table layout UI
- Implement order flow (dine-in → kitchen → serve → close)
- Integrate Stripe
- Kitchen Display System (KDS)
- Multiple orders per table
- E2E tests
- Beta (Sep), GA (Oct)
```

### CP-6 Planned Work

```
- Setup Stripe account
- Implement card payment flow
- Handle declined cards
- Refund support
- Split bill support
- Fiskally TSE integration
- Audit trail
- E2E tests
- Beta (Oct), GA (Nov)
```

---

## Phase 4: Odoo Removal

**ETA**: Q1 2027 (Jan-Mar)  
**Status**: ❌ NOT STARTED (Depends on Phase 3)

| Checkpoint | Component | Status | Owner | ETA |
|-----------|-----------|--------|-------|-----|
| CP-7 | Odoo Removed | ❌ Planned | @infra-lead | Jan 1 |

### CP-7 Planned Work

```
- Disable Odoo sync in booking flow
- Disable Make.com webhooks
- Archive Odoo-dependent code
- Verify zero Odoo API calls in critical path
- Cancel Odoo license
- Update runbooks (Odoo section removed)
- Final migration test
```

---

## Phase 5: Growth Features

**ETA**: Q2 2027 (Apr-Jun)  
**Status**: ❌ NOT STARTED (Depends on Phase 4)

| Checkpoint | Component | Status | Owner | ETA |
|-----------|-----------|--------|-------|-----|
| CP-8 | Growth Features | ❌ Planned | TBD | Apr 1 |

### CP-8 Planned Work

```
- Loyalty program (points, tiers)
- Ecommerce shop
- Marketing campaigns
- 50+ active restaurants
- NPS > 50
- Per-tenant revenue tracking
- Advanced reporting
```

---

## Future Readiness: Founder/KC Reactivation

**Status**: 📋 REFERENCE MODE ACTIVE

| Checkpoint | Component | Status | Owner | ETA |
|-----------|-----------|--------|-------|-----|
| CP-9 | Founder/KC Reactivation Readiness | 📋 Planned | TBD | Before Founder/KC reactivation sprint |

### CP-9 Planned Work

```
- Keep Founder and KC legacy assets indexed in docs/legacies/README.md
- Maintain API compatibility mapping in API_CONTRACTS.md
- Maintain data mapping in DATA_CONTRACTS.md
- Preserve OTP semantics (sms + whatsapp, cooldown, expiry)
- Add reactivation tests when implementation sprint starts
```

---

## Weekly Checkpoint Report Template

Use this template for weekly status updates:

```
## Week of [DATE]

### Phase 1 Progress
- [ ] CP-1: Tenant Isolation — [Status]
- [ ] CP-2: Booking MVP — [Status]
- [ ] CP-3: Admin UI Setup — [Status] ([X]% complete)

### Blockers
- [Issue]: [Resolution]
- [Issue]: [Resolution]

### Next Week
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Overall Progress
- Phase 1: [X]% complete (target [Y]%)
- On track for [ETA]? [YES / NO / AT RISK]
```

---

## Checkpoint Metrics

Track these metrics per phase:

### Phase 1 Metrics

```
Booking latency: < 500ms ✅
Board updates: < 1s ✅
SSE notifications: < 200ms ✅
Cross-tenant data leak: 0 ✅
Success rate: 99.5% ✅
Lint clean: yes ✅
Vitest root suite: 29/29 ✅
```

### Phase 2 Metrics (TBD)

```
Touch target size: >= 44x44px [TBD]
Battery drain (8h): < 20% [TBD]
Offline mode: working [TBD]
Action completion: < 5s [TBD]
Mobile E2E: passing [TBD]
```

### Phase 3 Metrics (TBD)

```
Table load: full board < 1s [TBD]
Kitchen display: < 500ms updates [TBD]
Payment processing: < 3s [TBD]
Order close: < 3s [TBD]
TSE receipt: < 5s [TBD]
```

---

## Checkpoint Verification Checklist

Before marking checkpoint DONE:

- [ ] Code review passed
- [ ] All tests passing (`npm run test`)
- [ ] Checkpoint script passes (`npm run check:cp-X`)
- [ ] E2E test passes
- [ ] Performance meets targets
- [ ] Tenant isolation verified (if applicable)
- [ ] Documentation updated
- [ ] 2 restaurants tested live (if applicable)
- [ ] No regressions in existing features
- [ ] Deployment successful

---

## How to Update This File

1. **Weekly**: Update checkpoint %complete and blockers
2. **When checkpoint completes**: Update status to ✅, add evidence link
3. **When blocker resolved**: Remove from list, note resolution
4. **Quarterly**: Review targets, adjust ETA if needed

Example status progression:
```
CP-X: ❌ NOT STARTED
↓
CP-X: 📋 PLANNED (design phase)
↓
CP-X: 🔄 IN PROGRESS ([X]% complete)
↓
CP-X: ✅ DONE (evidence: E2E passed)
```

---

## Historical Progress

### Completed Phases

None yet (Phase 1 in progress)

### Past Blocking Issues (Resolved)

None yet (new project)

### Lessons Learned

None yet (new project)

---

## Links

- [Full Checkpoint Definitions](./CHECKPOINTS.md)
- [Roadmap](./ROADMAP.md)
- [Architecture](./ARCHITECTURE.md)
- [Module Catalog](./MODULE_CATALOG.md)
