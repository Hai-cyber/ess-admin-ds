# Hand-Off System — Restaurant OS Progress Tracking

**Purpose**: Enable any AI agent or developer to catch up instantly on project status without reading full context.

**Frequency**: Update every session completion

**Machine-readable**: Yes (YAML + structured markdown for parsing)

---

## 📊 CURRENT PROJECT STATUS (As of 2026-04-08)

### Runtime Odoo Status (2026-04-08)

- Active Odoo runtime paths have been removed from both worker entrypoints.
- Founder/KC, booking-stage, and admin profile save flows are internal-first and no longer rely on Odoo in the critical path.
- The outer duplicate app tree was collapsed into a single root repository and the broken nested gitlink was removed.
- Moderation review queue, operator actions, Telegram review links, and host-based tenant website gating now run in the active runtime.
- The explicit `production` Wrangler environment deploys successfully to Cloudflare, but public ingress for that env still needs a real route because workers.dev returns `1050`.
- Schema/init and legacy utility artifacts still contain Odoo-era references and are intentionally left as follow-up cleanup, not active dependencies.

### ✅ What's Complete

#### Documentation (100%)
- [x] Product vision (PRODUCT.md)
- [x] Business model (BUSINESS_MODEL.md)
- [x] Architecture design (ARCHITECTURE.md)
- [x] Roadmap (ROADMAP.md)
- [x] Module catalog (MODULE_CATALOG.md)
- [x] AI Copilot spec (COPILOT_SPECIFICATION.md)
- [x] 9 Checkpoints defined (CHECKPOINTS.md, including CP-9 future readiness)
- [x] 6 Contract systems redesigned (API, Data, Module, Integration, Security, Error)
- [x] Transition plan (TRANSITION.md)
- [x] Decision records (DECISIONS.md)
- [x] Legacy reference policy formalized (Founder/KC retained as reference assets)

#### Implementation (91%)
- [x] Tenant isolation (CP-1) ✅ VERIFIED
- [x] Booking MVP (CP-2) ✅ VERIFIED
- [x] Booking form live
- [x] Booking board with real-time SSE
- [x] Stage engine (pending → confirmed → arrived → done)
- [x] Staff PIN authentication
- [x] Tenant guard middleware
- [x] Local runtime verified for platform home/plans/contact, signup provisioning, board, admin config, staff auth, booking create, and stage updates
- [x] Vitest baseline is now clean on the root repo: 29/29 passing
- [x] Platform UX/copy pass shipped locally: signup redesign, contextual login modal, browser-language detection, and localized pricing/add-on messaging
- [x] Website master runtime preview shipped in `public/website-master/` with a universal tenant template, preset-driven content, and runtime-shaped source payload examples
- [x] Website master now wires booking, contact, and founder/KC membership forms to current runtime endpoints with automatic preview-safe tenant injection
- [x] New public contact route `/api/contact/create` stores website-originated submissions in the existing `contacts` table
- [x] Active local runtime verification on port `8790` confirmed website master render, booking create/readback, and founder register/verify persistence
- [x] Website master boot now renders from embedded source immediately and hydrates runtime payload plus theme presets in parallel
- [x] Shared mobile drawer navigation now replaces the old mobile tab strip across the website-master page set
- [x] Luxury A/B polish shipped: luxury B light-surface menu contrast fixed and luxury A secondary header items removed from the active runtime path
- [x] Restaurant Admin now includes a tenant-facing Website Content & Opening Hours editor for presentation-only website fields
- [x] Restaurant Admin now includes a backend-driven go-live readiness checklist in the Website Release & Go Live panel
- [x] Restaurant Admin now includes release history and rollback controls backed by published website snapshots
- [x] Platform signup and tenant admin now support demo payment methods for PayPal, bank card, cash, and pick up at store
- [x] SaaS Admin now includes platform-level payment method toggles that enforce which signup and tenant payment methods are allowed
- [x] Tenant Admin payment setup now shows methods disabled by SaaS policy directly in the UI
- [x] Bank card signup now creates a Stripe test checkout session when `STRIPE_API_KEY` is configured or `STRIPE_MODE=mock`
- [x] Bank card signup now has a post-checkout confirmation path that moves `stripe_checkout_pending` to `stripe_paid`
- [x] Stripe webhook endpoint now updates signup payment lifecycle for completed and expired checkout sessions
- [x] SaaS Admin signup rows now show payment status, method, reference, and confirmation timestamp
- [x] Payment lifecycle events now persist in `payment_events` and render as an audit timeline in SaaS Admin
- [x] Failed or expired Stripe checkout sessions can now generate a new retry checkout from SaaS Admin and tenant admin
- [x] Stripe webhook testing now includes a signed payload path using `stripe-signature`
- [x] Product direction is now subdomain-first: custom domain is no longer a signup prerequisite and should ship as a later upgrade flow
- [x] Managed domain registration is now treated as an optional convenience product after BYOD custom-domain upgrade is stable
- [x] Structured `opening_hours_schedule` now reaches the public website payload alongside legacy open/close fallback values
- [x] Wildcard tenant subdomains on `gooddining.app` and demo-payment signup walkthrough have been verified live end to end
- [x] Active Odoo runtime/helper paths removed from both worker entrypoints; active public/admin surfaces updated to first-party CRM wording
- [x] Duplicate outer app tree collapsed into one clean root repository
- [x] Full repo hygiene pass completed; lint is clean and CI now checks repo hygiene explicitly
- [x] Publish moderation and operator review flow now exists in runtime and SaaS Admin
- [x] Local smoke verification completed for health, plans, contact, signup policy, publish review, suspend, quarantine, and host-based tenant blocking
- [x] Explicit `production` Wrangler env deployed against a real D1 database id
- [ ] Founder/KC OTP runtime still fails locally without Twilio credentials
- [ ] Admin UI setup wizard / go-live flow still incomplete (89% complete)

#### Contracts & Specifications (100%)
- [x] API Contracts (all endpoints defined)
- [x] Data Contracts (D1 schema complete)
- [x] Module Contracts (structure + interfaces)
- [x] Integration Contracts (Stripe, Twilio, Fiskaly)
- [x] Security Contracts (auth, isolation, RBAC)
- [x] Error Contracts (standardized codes)

---

### 🔄 In Progress (Current Sprint)

#### CP-3: Admin UI Setup (89% complete)

**What's done**:
- [x] Restaurant admin page + platform-config API + staff API are live
- [x] SaaS admin dashboard/config routes are live
- [x] Tenant signup endpoint provisions organization/company/admin staff user
- [x] Platform landing and signup pricing copy now reflects Service POS/German checkout and Repeat Guests SMS/loyal-guest positioning in EN/DE/VI
- [x] Included/add-on pricing notes and signup commercial summary are now language-aware instead of hardcoded English
- [x] Website master preview can consume runtime-shaped website settings and preview tenant/company context without hardcoded tenant pages
- [x] Tenant website editor now exists inside Restaurant Admin for text, images, button labels, navigation labels, career copy, and opening hours schedule
- [x] Website payload now includes structured opening hours for future reuse by shop and online-order availability
- [x] Website Release & Go Live panel now includes a backend-driven readiness checklist for missing setup items
- [x] Public tenant payload now serves the latest published release snapshot, and tenant admin can roll back to an older published snapshot
- [x] Payment setup now includes Stripe account id, accepted payment methods, and demo payment method selection
- [x] Platform operator pricing config now also controls allowed payment methods with global toggles
- [x] Signup flow now has a Stripe checkout-session path for bank card instead of only demo-paid simulation
- [x] Signup/payment state now persists `payment_method`, `payment_reference`, and `payment_confirmed_at` for Stripe confirmation
- [x] Stripe payment lifecycle no longer depends solely on frontend redirect; webhook and post-checkout confirmation both update the same persisted state
- [x] Payment remediation now includes retry checkout plus a persisted audit trail across checkout creation, retry, confirmation, and webhook updates
- [ ] Restaurant config form (email/phone/hours/areas)
- [ ] Staff PIN setup
- [ ] Payment integration setup
- [ ] "Go Live" verification

**What's blocked**: production route attachment, final publish/release workflow completion, custom-domain upgrade workflow, plus founder/KC OTP runtime depending on Twilio credentials

**Entry points**: `src/index.js`, `public/admin.html`, `public/platform/admin.html`, `public/website-master/index.html`

### Domain Strategy Proposal (Approved Direction)

- Keep signup and first go-live on the managed subdomain by default.
- Treat custom domain as a later upgrade capability, not as a signup prerequisite.
- Separate commercial approval from DNS verification and activation.
- Keep the managed subdomain alive after custom-domain activation for preview, rollback, and support.
- Ship bring-your-own-domain first; defer managed domain registration until the upgrade flow is stable.

### Domain Program Dev Stages

1. **Stage 0 — Subdomain-first baseline**
   New tenants launch on `{subdomain}.gooddining.app` with no custom-domain dependency.
2. **Stage 1 — Upgrade request**
   Tenant admin adds `Request custom domain upgrade` and SaaS Admin gets an approval queue.
3. **Stage 2 — DNS onboarding**
   Show exact DNS instructions, ownership verification, and activation state.
4. **Stage 3 — Domain activation**
   Route the live site to the verified custom domain while keeping the managed subdomain as fallback.
5. **Stage 4 — Managed registration**
   Offer platform-handled domain purchase and renewal only after BYOD upgrade is operationally stable.

### Commercial Recommendation

- Do not compete with Cloudflare on raw domain price.
- Use managed subdomain as the default included host.
- Charge separately for custom-domain capability, DNS/setup work, and later managed registration/renewal handling.
- If managed registration is offered, keep pricing at pass-through or slight markup plus explicit support value, rather than hiding ops cost in the base plan.

---

### ❌ Not Started Yet

#### Phase 2: Staff Mobile UI (May launch)
- 📋 CP-4 defined (specification ready)
- Design phase starts after CP-3 completes

#### Phase 3: POS + Payment (Aug launch)
- 📋 CP-5 defined (table management, orders)
- 📋 CP-6 defined (Stripe integration)
- Design phase starts after Phase 2

#### Phase 4: Odoo Removal (Jan 2027)
- ❌ Not started
- Depends on Phase 3 completion

#### Phase 5: Growth Features (Apr 2027)
- ❌ Not started
- Loyalty, shop, marketing modules

---

## 🎯 Current Phase: Phase 1 (Booking System)

**Status**: 91% complete  
**ETA**: April 15, 2026  
**Owner**: Development team

| Checkpoint | Status | Evidence | Blockers |
|-----------|--------|----------|----------|
| CP-1: Tenant Isolation | ✅ DONE | E2E_TEST_SUMMARY.md | None |
| CP-2: Booking MVP | ✅ DONE | Local runtime verified on 2026-03-30 | None |
| CP-3: Admin UI Setup | 🔄 84% | Admin routes/UI live; website content editor and structured hours added; go-live flow still incomplete | UX completion |
| CP-10: Platform Site + Self-Service Signup | 🔄 96% | Platform home/contact/admin/signup verified live; wildcard tenant subdomains resolve; demo-payment walkthrough works; moderation/review queue and host gating are active; fixed-skin website contract and validator added | Production ingress + Stripe + publish/release workflow + Twilio for founder/KC |
| **Phase 1 Total** | **🔄 91%** | — | **Platform/founder finalization** |

---

## 📍 What Needs to Happen Next

### Immediate (This week - Apr 2-5)

**Task 1**: Complete Admin UI setup wizard
- Validate and harden the new website content editor end to end on live tenant subdomains
- Finish the new tenant-side website release panel and operator moderation loop end to end
- Implement remaining restaurant config form gaps (name, address, phone, hours)
- Add staff PIN setup (hostess, bartender, manager)
- Add payment integration screen (Stripe account linking)
- Add "Setup Complete" → "Go Live" button
- Time estimate: 3-4 days
- Owner: @dev-lead
- Files: `src/index.js` + `public/admin.html`

**Task 2**: Test CP-3 end-to-end
- Run signup flow (tenant creation)
- Fill in all config fields
- Click "Go Live"
- Verify booking form now works
- Time estimate: 1 day
- Owner: QA
- Verification path: `npm test` + `wrangler dev --config wrangler.jsonc` + manual smoke tests

**Task 3**: Complete subdomain-first publish/domain-upgrade workflow
- Attach a real production route for `ess-admin-ds-prod`
- Keep managed subdomain as the default live host for all new tenants
- Add custom-domain upgrade request + operator approval + DNS verification flow
- Defer managed domain registration until the BYOD upgrade path is stable
- Re-test tenant release/review state from Restaurant Admin to SaaS Admin to live tenant URL
- Time estimate: 2-3 days

**Task 4**: Fix founder/KC OTP local runtime
- Configure Twilio test credentials or add an explicit development stub
- Re-run founder/KC registration tests and localhost flow
- Time estimate: Half day

### Next Week (Mar 29-Apr 5)

**Task 4**: Beta with 2-3 restaurants
- Deploy CP-3 to staging
- Onboard 2-3 real restaurants
- Collect feedback
- Fix bugs
- Time estimate: 3-4 days

---

## 🔗 Where Everything Lives

### Documentation Hub

```
/docs/
├── PRODUCT.md              -- What we build (Restaurant OS)
├── BUSINESS_MODEL.md       -- Pricing, revenue (€29-€99/month)
├── ARCHITECTURE.md         -- System design (Cloudflare + D1)
├── ROADMAP.md              -- Phases timeline
├── MODULE_CATALOG.md       -- 10 modules defined
├── CHECKPOINTS.md          -- 8 checkpoints per phase
├── CHECKPOINT_PROGRESS.md  -- Weekly status tracker (UPDATE THIS)
├── TRANSITION.md           -- Odoo migration plan
├── DECISIONS.md            -- ADRs (2 key decisions)
├── AI_CONTEXT.md           -- AI instruction guard rails
│
├── contracts/
│   ├── INDEX.md            -- Master contract index
│   ├── API_CONTRACTS.md    -- All HTTP endpoints
│   ├── DATA_CONTRACTS.md   -- D1 schema
│   ├── MODULE_CONTRACTS.md -- Module structure
│   ├── INTEGRATION_CONTRACTS.md -- External APIs
│   ├── SECURITY_CONTRACTS.md -- Auth & isolation
│   └── ERROR_CONTRACTS.md  -- Error codes
│
└── checkpoints/
   ├── ../archive/2026-03/checkpoints-legacy/tenant-checkpoint.md -- Tenant isolation (archived)
    └── [CP-specific details if needed]
```

### Code Hub

```
/src/
├── index.js                -- Main Worker entry
├── db/                     -- D1 access helpers
├── utils/                  -- Tenant/runtime helpers
└── ...

/public/
├── admin.html             -- Restaurant admin UI
├── platform/              -- SaaS platform pages/admin
├── booking-form.html      -- Public booking entry
├── founder-form.html      -- Founder/KC legacy-compatible entry
└── website-master/        -- Universal website master preview + schema/presets/examples
```

### Key Files to Know

| File | What It Is | Update When |
|------|-----------|-------------|
| **CHECKPOINT_PROGRESS.md** | Weekly status tracker | Every session (THIS ONE!) |
| **HANDOFF.md** (this file) | Project state snapshot | After each major task |
| **STATUS.md** | Live status dashboard | Before/after session |
| **ROADMAP.md** | Phase timeline | When timeline changes |
| **DECISIONS.md** | Past decisions (don't repeat) | When making big decision |

---

## 🧠 Quick Orientation for New Agent

### If you're joining NOW

1. **Read 20 min**:
   - This file (HANDOFF.md) — you're reading it
   - [ROADMAP.md](../../ROADMAP.md) — timeline (5 min)
   - [CHECKPOINTS.md](../../CHECKPOINTS.md) — what success looks like (10 min)

2. **Understand context 10 min**:
   - We're building Restaurant OS (vertical SaaS for restaurants)
   - Currently in Phase 1 (Booking system) at 88% complete
   - Using Cloudflare Workers + D1 (no Odoo in critical path)
   - Multi-tenant system (restaurants = tenants)

3. **Know the rules 5 min**:
   - ✅ EVERY query filters by `tenant_id` (DATA_CONTRACTS.md)
   - ✅ EVERY endpoint has auth (SECURITY_CONTRACTS.md)
   - ✅ EVERY error uses standard codes (ERROR_CONTRACTS.md)
   - ✅ Read contracts FIRST before coding

4. **Start working 5 min**:
   - Check CHECKPOINT_PROGRESS.md for what's blocked
   - Pick next task from "What Needs to Happen Next" (above)
   - Cite relevant contract when implementing
   - Run checkpoints before PR

### If you're handing OFF to me

1. **Leave this file updated** (HANDOFF.md)
2. **Update STATUS.md** with current blockers
3. **Link to latest session notes** (in /memories/session/)
4. **Clear TODO list** (manage_todo_list) showing what's in-progress

---

## 📈 Progress Metrics

### Phase 1 (Booking System)

```
Checkpoint Completion:
┌─────────────────────────────────────┐
│ CP-1: Tenant Isolation  ████████ 100% ✅
│ CP-2: Booking MVP       ████████ 100% ✅
│ CP-3: Admin UI Setup    ██████░░  75% 🔄
│ CP-4: Staff Mobile      ░░░░░░░░   0% 📋
│ CP-5: POS System        ░░░░░░░░   0% 📋
│ CP-6: Payment           ░░░░░░░░   0% 📋
│ CP-7: Odoo Removed      ░░░░░░░░   0% ❌
│ CP-8: Growth Features   ░░░░░░░░   0% ❌
└─────────────────────────────────────┘
Phase 1 Overall: 88%
On track for Apr 15 GA? YES
```

### Code Quality

```
Test Coverage:
- Tenant isolation: 100% ✅
- Booking API: 95% ✅
- Admin API: 60% 🔄
- POS API: 0% (not started)

Linting:
- No errors ✅
- No hardcoded secrets ✅
- All queries have tenant_id ✅

Performance:
- Booking create: 450ms avg (target < 500ms) ✅
- Board load: 800ms avg (target < 1s) ✅
- SSE: 150ms latency (target < 200ms) ✅
```

---

## 🚨 Known Issues & Blockers

### Current Blockers

**Blocker 1**: Admin UI go-live completion
- **What**: Setup wizard still needs the last config, payment, and go-live screens
- **Why**: Core routes exist, but the operator finish path is still incomplete
- **Impact**: CP-3 blocked (75% → 100%)
- **ETA**: Mar 31
- **Owner**: @dev-lead
- **Resolution**: Finish admin form flow and validate with a full self-serve tenant go-live pass

**Blocker 2**: Stripe test account setup
- **What**: Staging needs real Stripe test account
- **Why**: Payment endpoint can't be tested with mocks only
- **Impact**: CP-6 (Phase 3) testing delayed
**Blocker 3**: Website publish/domain flow completion
- **What**: Website master runtime preview is working, but publish-to-storage and custom-domain serving are not complete yet
- **Why**: Current implementation proves rendering/runtime wiring, not the full go-live delivery pipeline
- **Impact**: CP-10 remains partial
- **ETA**: Mar 31
- **Owner**: @dev-lead
- **Resolution**: Bind Website Builder Studio settings into publish output, reload worker, and validate custom-domain path plus `/api/contact/create`
- **ETA**: Will be resolved by Phase 3 start (Aug 1)
- **Owner**: @infra-lead
- **Resolution**: Set up Stripe Connect in staging by Jul 15

### Past Issues (Resolved)

| Issue | Resolution | Date |
|-------|-----------|------|
| Odoo dependency in critical path | Removed, now optional | Mar 20 |
| Generic multi-tenant docs | Redesigned for Restaurant OS | Mar 22 |
| Missing checkpoints | Created 8 comprehensive checkpoints | Mar 22 |

---

## 🔄 Session Hand-Off Template

**Use this when completing a session:**

```markdown
## Session: [Date] — [Topic]

### What was done
- ✅ Task 1: ... (2 hours)
- ✅ Task 2: ... (1.5 hours)

### What's blocked
- Issue 1: ... (ETA: Mar XX)
- Issue 2: ... (waiting for @person)

### Current stage
- CP-3 Admin UI: 60% → 70% (progress: +10%)
- Phase 1 overall: 75%

### Next steps (in order)
1. [Task] — Est: X hours — Owner: @person
2. [Task] — Est: Y hours — Owner: @person
3. [Task] — Est: Z hours — Owner: @person

### Context links
- Relevant PR: #123
- Related docs: [CONTRACTS.md](...)
- Latest checkpoint run: [output]

### Entry point for next agent
- Start at: src/modules/admin/...
- Check this first: CHECKPOINT_PROGRESS.md
- Run this: npm run check:cp-admin-setup
```

---

## 🎓 Critical Knowledge (Don't Forget!)

### Restaurant OS Principles

1. **Cloudflare-native**: All logic in Workers, data in D1. Odoo is optional mirror only.
2. **Vertical SaaS**: Built FOR restaurants, not generic. Every feature serves daily operations.
3. **Multi-tenant**: Every table has `tenant_id`. Queries MUST filter by it. No exceptions.
4. **Real-time**: SSE streaming, < 1s latency. Staff need instant updates during service.
5. **Fail-closed**: No shortcuts. No hardcoded globals. Tenant mismatch = 400/403 error.

### Legacy Forms Reference Policy

- Founder and KC forms remain relevant for future restaurant operations.
- For current phases, treat them as reference assets, not active core runtime dependencies.
- Preserve mapping assumptions for future reactivation work.
- Primary reference registry: `docs/legacies/README.md`.

### Phase 1 Complete Definition

**What must be true before Phase 2 starts**:
- ✅ Guests can book online (form works)
- ✅ Staff can see bookings (board works)
- ✅ Staff can update stages (confirm, arrive, done)
- ✅ Notifications work (SSE streaming)
- ✅ Admin can configure restaurant (setup wizard)
- ✅ Zero cross-tenant data leaks (verified)
- ✅ Odoo sync optional, not required
- ✅ 2+ restaurants tested live

**Metrics for success**:
- Booking latency < 500ms ✅
- Staff satisfaction (NPS > 40) — TBD
- Uptime > 99.5% ✅
- Zero security incidents ✅

### Contracts (Non-negotiable)

Before coding ANY feature, read these:

```
Feature type          → Read contract
Building API endpoint → API_CONTRACTS.md
Writing D1 query      → DATA_CONTRACTS.md + SECURITY_CONTRACTS.md
Creating module       → MODULE_CONTRACTS.md
Handling error        → ERROR_CONTRACTS.md
Integrating service   → INTEGRATION_CONTRACTS.md
Auth/tenant logic     → SECURITY_CONTRACTS.md
```

---

## 📞 Quick Answers

### "What's the status?"
→ Read CHECKPOINT_PROGRESS.md (10 sec) + this file (5 min)

### "What should I work on?"
→ See "What Needs to Happen Next" section (above)

### "Is X already done?"
→ Search HANDOFF.md for "✅" + check CHECKPOINT_PROGRESS.md

### "What's the spec for Y?"
→ Read relevant contract (INDEX.md for links)

### "Why did we decide Z?"
→ Check DECISIONS.md (all major decisions recorded)

### "What's blocking us?"
→ See "Known Issues & Blockers" section (above)

### "How do I test my changes?"
→ Run: `npm run check:cp-all && npm run test && npm run deploy`

### "Can I hardcode X?"
→ NO. Read SECURITY_CONTRACTS.md (Secrets Management section)

### "Do I need to filter by tenant_id?"
→ YES. ALWAYS. Non-negotiable. DATA_CONTRACTS.md.

---

## 📅 Timeline at a Glance

```
Phase 1: Booking System
├─ 2026-03-15: Landed booking MVP
├─ 2026-03-22: Redesigned docs + contracts (TODAY)
├─ 2026-03-31: Admin UI complete (NEXT)
├─ 2026-04-05: Beta with 2-3 restaurants
└─ 2026-04-15: GA launch ← Phase 1 DONE

Phase 2: Staff Mobile UI
├─ 2026-05-01: Design starts (depends on Phase 1)
├─ 2026-06-01: Beta
└─ 2026-06-30: GA launch

Phase 3: POS + Payment
├─ 2026-08-01: Design starts
├─ 2026-09-01: Beta (Stripe, TSE, KDS)
├─ 2026-10-01: Payment live
└─ 2026-10-31: GA launch

Phase 4: Odoo Removal
├─ 2027-01-01: Archive Odoo integrations
└─ 2027-01-31: Odoo optional only

Phase 5: Growth Features
├─ 2027-04-01: Loyalty, shop, marketing
└─ 2027-06-30: 50+ restaurants, NPS > 50
```

---

## 🔑 Key People & Roles

| Role | Current Owner | Backup |
|------|---------------|--------|
| Project Lead | @founder | TBD |
| Dev Lead | @dev-lead | @senior-dev |
| QA Lead | @qa | @tester |
| Product | @founder | TBD |
| DevOps | @infra-lead | TBD |
| AI Context | (this doc) | @founder |

---

## ✅ Verification Checklist for New Agent

Before starting ANY task:

- [ ] Read this HANDOFF.md (you're here)
- [ ] Read CHECKPOINT_PROGRESS.md (live status)
- [ ] Check ROADMAP.md (timeline context)
- [ ] Skim DECISIONS.md (what we already decided)
- [ ] Identify which contract applies to my task
- [ ] Understand tenant_id isolation rule
- [ ] Know how to run checkpoints: `npm run check:cp-X`
- [ ] Know how to test locally: `npm run dev`
- [ ] Know how to verify changes: `npm run test`

---

## 🎯 Success Criteria

**Project is "good to hand off" when:**

- [ ] This HANDOFF.md is < 24h old
- [ ] STATUS.md shows all blockers
- [ ] CHECKPOINT_PROGRESS.md updated this week
- [ ] No ambiguous "in progress" tasks (all have clear owner + ETA)
- [ ] All decisions documented (DECISIONS.md)
- [ ] All contracts updated (INDEX.md + 6 contract files)
- [ ] All tests passing (`npm run test`)
- [ ] All checkpoints visible (`npm run check:cp-all`)

**If any of above are FALSE:**
→ Session is incomplete. Finish checklist before handing off.

---

## 📝 Last Updated

**Date**: 2026-03-22  
**Session**: Documentation redesign (contracts + checkpoints)  
**By**: AI Agent  
**Status**: Ready for hand-off to next agent

**Next hand-off due**: 2026-03-29 (or when Admin UI reaches 90%)

---

## 🚀 How to Use This File

1. **Daily check-in** (5 min):
   - Read "What's Complete" + "What's In Progress"
   - Check if any blockers changed
   - Verify you know today's focus

2. **Before starting work** (10 min):
   - Read "What Needs to Happen Next"
   - Verify task owner + ETA
   - Check relevant contract
   - Pick YOUR task from the list

3. **When handling off** (30 min):
   - Update all progress sections
   - Add new blockers + resolutions
   - Update "What Needs to Happen Next"
   - Leave STATUS.md updated
   - Link to relevant contracts/PRs

4. **When completely lost** (20 min):
   - Read this file top-to-bottom
   - Read CHECKPOINT_PROGRESS.md
   - Read ROADMAP.md
   - Read relevant contract (INDEX.md for links)
   - You'll know what to do

---

**Questions? Check [HANDOFF_FAQ.md](./HANDOFF_FAQ.md) (if it exists, or ask in PR comments)**
