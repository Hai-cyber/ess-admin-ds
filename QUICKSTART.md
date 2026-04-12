# Quick Start Guide — AI Agent Orientation (5min)

**For**: AI agents (or developers) joining mid-project  
**Time**: 5 minutes to full orientation  
**Goal**: Understand what's done, where we are, what's next

---

## 🎯 The 30-Second Version

**What we're building**: Restaurant OS (vertical SaaS for restaurant bookings, POS, payments)

**Where we are**: Phase 1 of 5 (Booking system) — 75% complete

**What's working**:
- ✅ Guests can book online (form → confirmation)
- ✅ Staff see bookings on live board (real-time updates)
- ✅ Multi-restaurant isolation (no cross-tenant data leaks)

**What's blocked**: Admin UI setup wizard (refactoring, ETA Mar 31)

**What's next**: Complete admin UI, beta with 2-3 restaurants, GA launch (Apr 15)

---

## 📍 Where Am I? (The Map)

```
Restaurant OS Project (2026)
├── Phase 1: Booking ✅97% (ends Apr 20)
│   ├── CP-1: Tenant isolation ✅ DONE
│   ├── CP-2: Booking MVP ✅ DONE
│   └── CP-3/CP-10: Platform + Admin 🔄 97% (YOUR FOCUS)
├── Phase 2: Staff mobile (May-Jun)
├── Phase 3: POS + Payment (Aug-Oct)
├── Phase 4: Odoo removal (Jan 2027)
└── Phase 5: Growth (Apr-Jun 2027)

You are here: Phase 1, finishing production hardening
```

---

## ✅ What's Already Done

### Core System
- ✅ Tenant isolation (verified: no data leaks)
- ✅ PIN authentication (staff login)
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
- Identity auth (email magic link + Google), session-first Restaurant Admin and SaaS Admin
- Website publish/release state machine (`draft → pending_review → approved → published → rolled_back`)
- R2 publish storage confirmed live; binding wired in production
- Local bank-card Stripe checkout working via `STRIPE_MODE=mock`
- Founder/KC OTP local stub: register returns `otp_debug_code` for instant local verify
- All production PIN fallback flags disabled; board PIN scoped to board-only operations
- 65/65 tests passing

**What's needed to ship Phase 1**:
1. Production Stripe secrets (`STRIPE_API_KEY` + `STRIPE_WEBHOOK_SECRET`)
2. Legacy admin PIN fallback code removal (flags already off, code cleanup remains)
3. Board-launch UX entry point from Restaurant Admin (closes CP-3F)
4. Custom-domain enrichment (transfer-out, cutover indicator)

**Est. time to complete**: 1 week

**Files to edit**:
- `src/index.js` — PIN fallback code removal
- `public/admin.html` — board-launch UX
- `wrangler.jsonc` — already updated

**How to verify you're done**:
```bash
npm test  # 65/65 pass
npx wrangler dev --config wrangler.jsonc  # local smoke test
npx wrangler deploy --env production      # ship it
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
1. [ ] `wrangler secret put STRIPE_API_KEY --env production`
2. [ ] `wrangler secret put STRIPE_WEBHOOK_SECRET --env production`
3. [ ] Remove legacy PIN fallback code from `src/index.js` (flags already off)
4. [ ] Add board-launch UX entry point in `public/admin.html`
5. [ ] Extend custom-domain BYOD workflow (transfer-out + cutover ops)
6. [ ] Run `npm test` (must stay 65/65)
7. [ ] Deploy: `npx wrangler deploy --env production`
8. [ ] Smoke test `prod.gooddining.app`

**When you get stuck**:
1. Check [STATUS.md](./STATUS.md) for blockers
2. Check [knowledge/runbooks/](./knowledge/runbooks/) for deploy + domain runbooks
3. Check relevant contract in `docs/contracts/`

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
