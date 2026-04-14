# Quick Start Guide — AI Agent Orientation (5min)

**For**: AI agents (or developers) joining mid-project  
**Time**: 5 minutes to full orientation  
**Goal**: Understand what's done, where we are, what's next

---

## 🎯 The 30-Second Version

**What we're building**: Restaurant OS (vertical SaaS for restaurant bookings, POS, payments)

**Where we are**: Phase 1 of 5 (Booking + Platform Entry) — 97% complete

**What's working**:
- ✅ Guests can book online (form → confirmation)
- ✅ Staff see bookings on live board (real-time updates)
- ✅ Multi-restaurant isolation (no cross-tenant data leaks)
- ✅ Restaurant Admin and SaaS Admin use email or Google session auth
- ✅ Signup bootstraps owner identity and verification handoff
- ✅ Founder and KC local OTP can run through the built-in dev stub

**What's blocked**: production Stripe secrets plus richer custom-domain operations

**What's next**: validate the board-launch handoff, provision production Stripe secrets, then start beta onboarding

---

## 📍 Where Am I? (The Map)

```
Restaurant OS Project (2026)
├── Phase 1: Booking + Platform Entry ✅97% (ends Apr 20)
│   ├── CP-1: Tenant isolation ✅ DONE
│   ├── CP-2: Booking MVP ✅ DONE
│   └── CP-3/CP-10: Platform + Admin 🔄 97% (YOUR FOCUS)
├── Phase 2: Staff mobile (May-Jun)
├── Phase 3: POS + Payment (Aug-Oct)
├── Phase 4: Odoo removal (Jan 2027)
└── Phase 5: Growth (Apr-Jun 2027)

You are here: Phase 1, production hardening + beta readiness
```

---

## ✅ What's Already Done

### Core System
- ✅ Tenant isolation (verified: no data leaks)
- ✅ Booking Board onsite PIN authentication (staff login)
- ✅ Booking form (online reservations)
- ✅ Booking board (real-time, staff view)
- ✅ Stage engine (pending → confirmed → arrived → done)
- ✅ Notifications (SSE streaming to staff)

### Tech
- ✅ Cloudflare Workers (no traditional servers)
- ✅ D1 database (Cloudflare's SQLite)
- ✅ Multi-tenant architecture (every query filters by tenant_id)

### Documentation
- ✅ Product vision (PRODUCT.md)
- ✅ Business model (BUSINESS_MODEL.md)
- ✅ System architecture (ARCHITECTURE.md)
- ✅ 8 checkpoints with verification scripts
- ✅ 6 contract systems (API, data, modules, security, errors, integrations)

---

## 🔄 What's In Progress (You Are Here)

### Production Hardening + Beta Readiness (97% → ship)

**What works**:
- Identity auth is live for Restaurant Admin and SaaS Admin
- Booking Board stays staff-PIN only and now launches with explicit Restaurant Admin context
- Signup seeds owner identity and verification handoff
- Founder and KC local OTP can be verified immediately with `OTP_STUB_ENABLED=true`
- R2 publish storage is wired for production
- Vitest passes end to end

**What's needed** (to finish Phase 1):
1. Provision `STRIPE_API_KEY` and `STRIPE_WEBHOOK_SECRET` in production
2. Smoke-test bank-card signup on `prod.gooddining.app`
3. Validate Restaurant Admin → Booking Board launch on real tenant URLs
4. Extend custom-domain cutover, reminder, and renewal operator workflows
5. Start beta with 2-3 restaurants

**Est. time to complete**: about 1 week

**Files to edit**:
- `src/index.js` — auth, signup, payments, domain ops
- `public/admin.html` — Restaurant Admin shell + board launch
- `public/board.html` — board entry flow
- `knowledge/runbooks/r2-publish-and-custom-domain-deploy.md` — deploy and domain validation

**How to verify you're done**:
```bash
npm test
npx wrangler dev --config wrangler.jsonc
# Then run production smoke tests once Stripe secrets exist
```

---

## 🚨 The One Rule

**Before writing ANY code:**

### Every database query MUST filter by tenant_id

```javascript
// ✅ CORRECT
SELECT * FROM bookings WHERE tenant_id = ? AND booking_date = ?

// ❌ WRONG (will leak cross-tenant data)
SELECT * FROM bookings WHERE booking_date = ?
```

Why? Multi-tenant system. One restaurant ≠ sees other restaurants' data.

**This is non-negotiable. Code review will reject violations.**

---

## 📚 Documents You Need

| Document | Read This First | Then Read |
|----------|-----------------|-----------|
| **ROADMAP.md** | Timeline + phases | CHECKPOINTS.md |
| **CHECKPOINTS.md** | Success criteria for this phase | STATUS.md |
| **STATUS.md** | Current state (live) | HANDOFF.md |
| **HANDOFF.md** | Project overview + blockers | contracts/INDEX.md |
| **contracts/INDEX.md** | Which contract to read? | [specific contract] |
| **API_CONTRACTS.md** | Endpoint spec | DATA_CONTRACTS.md |
| **DATA_CONTRACTS.md** | Database schema + validation | SECURITY_CONTRACTS.md |
| **SECURITY_CONTRACTS.md** | Auth + tenant isolation | — |

**Read order if new** (30 min):
1. This file (5 min) ← you're here
2. ROADMAP.md (5 min)
3. CHECKPOINTS.md (10 min)
4. STATUS.md (3 min)
5. Relevant contract (5-10 min)

---

## 🎯 Your Task (If You're Assigned)

### Task: Finish Phase 1 — Production Hardening

**Time estimate**: 1 week  
**Owner**: @dev-lead

**Step-by-step**:
1. [ ] Set `STRIPE_API_KEY` in production
2. [ ] Set `STRIPE_WEBHOOK_SECRET` in production
3. [ ] Deploy with `npx wrangler deploy --env production`
4. [ ] Smoke-test bank-card signup on `prod.gooddining.app`
5. [ ] Validate Restaurant Admin → Booking Board launch on a real tenant URL
6. [ ] Extend custom-domain ops beyond activation
7. [ ] Re-run `npm test`
8. [ ] Start beta onboarding

**How to test as you go**:
```bash
npm test
npx wrangler dev --config wrangler.jsonc
npx wrangler deploy --env production
```

**When you get stuck**:
1. Check STATUS.md for the current blocker list
2. Check `knowledge/runbooks/` for deploy and custom-domain steps
3. Read the relevant contract in `docs/contracts/`

---

## 🚀 How to Start

### Right Now (5 min)

```bash
# 1. Get oriented
cd /Users/nguyennhathai/ess-admin-ds
cat ROADMAP.md         # 5 min timeline
cat STATUS.md          # Live snapshot
```

### Next (Pick your task)

```bash
# 2. Understand the task
cat docs/contracts/API_CONTRACTS.md    # Find your endpoint spec
cat docs/contracts/DATA_CONTRACTS.md   # Find your database schema

# 3. Start working
npm run dev                            # Start dev server
# (edit src/modules/admin/...)         # Build your feature

# 4. Test
npm run test                           # Run tests
npm run check:cp-admin-setup          # Run checkpoint
```

---

## ❓ Common Questions

### "Where's the code?"
→ `/src/modules/` (one folder per module)

### "How do I find the endpoint spec?"
→ Read `docs/contracts/API_CONTRACTS.md` (search for your endpoint)

### "Where's the database schema?"
→ Read `docs/contracts/DATA_CONTRACTS.md` (all tables defined there)

### "When do I need to filter by tenant_id?"
→ ALWAYS. Read SECURITY_CONTRACTS.md (mandatory rule)

### "What error codes should I use?"
→ Read `docs/contracts/ERROR_CONTRACTS.md` (standardized codes)

### "How do I add a new API endpoint?"
→ Read `docs/contracts/MODULE_CONTRACTS.md` (module structure)

### "Why are there so many docs?"
→ Because we're building seriously. Read the one relevant to YOUR task.

### "Is there a video tutorial?"
→ No. Read the contracts (they're the tutorial).

### "I'm stuck. What do I do?"
→ (1) Read the relevant contract. (2) Search HANDOFF.md. (3) Ask in PR comments.

---

## 📈 Progress (Right Now)

```
Phase 1 Progress
┌──────────────────┐
│ ████████░░ 75%   │
└──────────────────┘

✅ Done: Tenant isolation, Booking MVP, Tech stack
🔄 In Progress: Admin UI setup (60% complete)
📋 Planned: Phases 2-5

Phase 1 Launch Date: April 15, 2026
On Track? 🟡 Yes (minor blocker: admin UI refactoring)
```

---

## 🔄 Hand-Off Chain

**How this project stays organized:**

1. **Before you start**: Read this file (5 min) + read STATUS.md
2. **When you finish a task**: Update STATUS.md with progress
3. **When you hand off**: Update HANDOFF.md with blockers + next steps
4. **Next agent reads**: HANDOFF.md (15 min overview) + STATUS.md (live state)

This way, no one repeats context.

---

## ✅ You're Ready If...

- [ ] You understand the project (Restaurant OS booking system)
- [ ] You know where we are (Phase 1, 75% complete)
- [ ] You know the blocker (Admin UI refactoring)
- [ ] You know your task (Complete admin setup wizard)
- [ ] You know the rule (Every query filters by tenant_id)
- [ ] You know where to find specs (contracts/INDEX.md)
- [ ] You know how to test (npm run check:cp-admin-setup)

**If all checked boxes**: START WORKING

**If any unchecked**: Re-read this file + relevant contract

---

## 🎓 Pro Tips

1. **Always read the contract first** (before coding)
2. **Filter by tenant_id** (non-negotiable)
3. **Run tests before PR** (`npm run test`)
4. **Check the checkpoint** (`npm run check:cp-X`)
5. **Link to contracts in your PR** (for reviewers)
6. **Update STATUS.md** (when you finish)
7. **Leave HANDOFF.md notes** (for next agent)

---

## 📞 You Need Help With...

| Issue | Solution |
|-------|----------|
| Don't understand architecture | Read ARCHITECTURE.md (15 min) |
| Don't understand Auth | Read SECURITY_CONTRACTS.md |
| Don't understand database | Read DATA_CONTRACTS.md |
| Need endpoint spec | Read API_CONTRACTS.md (search endpoint) |
| ERROR: tenant_id missing | Add WHERE tenant_id = ? to query |
| Don't know what to work on | Read STATUS.md (What Happens Next) |
| Can't find error code | Read ERROR_CONTRACTS.md |
| Stuck on task | Read relevant contract + ask in Slack |

---

## 🎯 Bottom Line

- **Project**: Restaurant OS (vertical SaaS for restaurants)
- **Phase**: 1 of 5 (Booking) — 75% complete
- **Issue**: Admin UI needs completion (3-4 days work)
- **Rule**: Filter by tenant_id (ALWAYS)
- **Action**: Start with ROADMAP.md → contracts → code
- **Done when**: Admin setup wizard works + CP-3 checkpoint passes

**Questions?** → Read HANDOFF.md or ask in PR comments.

**Ready?** → `npm run dev` and start building!

---

**Last updated**: 2026-03-22  
**By**: AI Agent  
**For**: Next AI agent joining project
