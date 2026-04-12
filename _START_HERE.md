# 🚀 START HERE — Restaurant OS Hand-Off System

**Purpose**: For AI agents (and humans) to understand project status instantly.

**Your time commitment**:
- ⚡ **5 min** → [QUICKSTART.md](./QUICKSTART.md) (orientation)
- 📊 **3 min** → [STATUS.md](./STATUS.md) (live dashboard)
- 🎯 **15 min** → [HANDOFF.md](./HANDOFF.md) (full overview)
- 📚 **5-10 min** → [Relevant contract](./docs/contracts/INDEX.md) (specs)

**Total**: 30 min to full understanding

---

## 🎯 Pick Your Entry Point

### "I need to understand the project RIGHT NOW"
→ Read **[QUICKSTART.md](./QUICKSTART.md)** (5 min)

Summary: You're building Restaurant OS (vertical SaaS). Phase 1 (Booking + Platform Entry) is 98% done. Moderation/review queue, tenant host gating, enriched custom-domain ops, and tenant website publish/release QA are live; production Stripe is on hold pending account setup, and final beta validation remains.

### "I need to know what's blocked / what to work on?"
→ Read **[STATUS.md](./STATUS.md)** (3 min)

Live dashboard showing:
- What's done ✅
- What's in progress 🔄
- What's blocked 🚨
- What's next (with owners + ETA)

### "I need the full picture"
→ Read **[HANDOFF.md](./HANDOFF.md)** (15 min)

Complete project overview including:
- What's complete
- What's in progress
- Checkpoints + metrics
- Blockers + resolution
- Phase timeline
- Team roles
- Hand-off procedures

### "I need to build a feature / understand a spec"
→ Read **[docs/contracts/INDEX.md](./docs/contracts/INDEX.md)** (5 min)

Then read the specific contract:
- API endpoints → [API_CONTRACTS.md](./docs/contracts/API_CONTRACTS.md)
- Database schema → [DATA_CONTRACTS.md](./docs/contracts/DATA_CONTRACTS.md)
- Module structure → [MODULE_CONTRACTS.md](./docs/contracts/MODULE_CONTRACTS.md)
- External APIs → [INTEGRATION_CONTRACTS.md](./docs/contracts/INTEGRATION_CONTRACTS.md)
- Authentication → [SECURITY_CONTRACTS.md](./docs/contracts/SECURITY_CONTRACTS.md)
- Error handling → [ERROR_CONTRACTS.md](./docs/contracts/ERROR_CONTRACTS.md)

### "I need business / timeline context"
→ Read **[ROADMAP.md](./ROADMAP.md)** (5 min)

5 phases, 16 months timeline with phases, deliverables, and dependencies.

### "I need to verify progress"
→ Read **[CHECKPOINTS.md](./CHECKPOINTS.md)** (10 min)

8 checkpoints across 5 phases with verification scripts. Shows success criteria.

### "I need this week's status"
→ Read **[CHECKPOINT_PROGRESS.md](./CHECKPOINT_PROGRESS.md)** (5 min)

Weekly tracker updated every session. Shows % complete per checkpoint.

---

## 🗺️ Document Ecosystem

### For Getting Oriented (Start Here)

```
Navigation Entry Points
├── QUICKSTART.md ⭐ (5 min orientation)
├── STATUS.md (3 min live state)
├── HANDOFF.md (15 min full overview)
└── docs/contracts/INDEX.md (contract navigation)
```

### For Understanding the Project

```
Business & Vision
├── PRODUCT.md (what we build)
├── BUSINESS_MODEL.md (pricing, revenue)
├── ROADMAP.md (phase timeline)
└── DECISIONS.md (why we decided X)

Technical Design
├── ARCHITECTURE.md (system design, database)
├── docs/contracts/ (6 contract systems)
└── MODULE_CATALOG.md (module descriptions)

Progress Tracking
├── CHECKPOINTS.md (8 checkpoints per phase)
├── CHECKPOINT_PROGRESS.md (weekly tracker)
└── STATUS.md (live dashboard)

This File
└── _START_HERE.md (you are here)
```

### For Building (By Role)

```
If building an API endpoint
├── docs/contracts/API_CONTRACTS.md (endpoint spec)
├── docs/contracts/ERROR_CONTRACTS.md (error codes)
└── tests/ (see examples)

If building database queries
├── docs/contracts/DATA_CONTRACTS.md (schema + validation)
├── docs/contracts/SECURITY_CONTRACTS.md (tenant isolation rule)
└── src/index.js + src/db/ (current runtime implementation)

If creating a new module
├── docs/contracts/MODULE_CONTRACTS.md (module structure)
├── src/index.js (current runtime entry) + public/ (UI surfaces)
└── tests/ (>80% coverage required)

If integrating external service
├── docs/contracts/INTEGRATION_CONTRACTS.md (API specs)
├── docs/contracts/SECURITY_CONTRACTS.md (secrets management)
└── src/index.js + src/utils/ (current runtime integration points)
```

### Related Project Docs

```
/docs/
├── checkpoints/ (old checkpoint notes)
├── contracts/ (6 contract systems)
├── legacies/ (code we're replacing)
└── [other context]
```

---

## ⏱️ Time to Understand by Role

| Role | Time | Path |
|------|------|------|
| **AI Agent** (new) | 30 min | QUICKSTART.md → STATUS.md → HANDOFF.md → contract |
| **Developer** (joining) | 45 min | QUICKSTART.md → ROADMAP.md → CHECKPOINTS.md → contract |
| **Product Manager** | 30 min | PRODUCT.md → BUSINESS_MODEL.md → ROADMAP.md → STATUS.md |
| **QA Engineer** | 30 min | CHECKPOINTS.md → CHECKPOINT_PROGRESS.md → API_CONTRACTS.md |
| **DevOps** | 20 min | ARCHITECTURE.md → ROADMAP.md → STATUS.md |

---

## 🚨 The One Critical Rule

**Before coding ANY feature:**

### Every database query MUST filter by company_id in the current runtime

```javascript
// ✅ CORRECT
SELECT * FROM bookings WHERE company_id = ? AND ...

// ❌ WRONG (data leak!)
SELECT * FROM bookings WHERE ...
```

Multi-tenant system = restaurants are isolated. One restaurant can't see another's data.

**This is enforced in code review.**

---

## 📊 Current Status (Right Now)

**Phase**: 1 of 5 (Booking System)  
**Progress**: 98% complete  
**ETA**: April 20, 2026  
**Status**: 🟡 ON TRACK (remaining: production Stripe account setup, final beta validation, founder/KC OTP production delivery follow-up)

**What's done**:
- ✅ Tenant isolation (verified)
- ✅ Booking MVP (live form + board)
- ✅ Staff authentication (PIN login)
- ✅ Real-time notifications (SSE)
- ✅ Platform site, SaaS admin, and self-service signup verified locally on 2026-03-30
- ✅ Platform login/signup/pricing experience now includes browser-language auto-detect, contextual login, and localized pricing/add-on messaging
- ✅ Website master preview now exists under `public/website-master/` with preset-driven content, runtime form wiring, and automatic preview tenant injection
- ✅ Moderation gate now evaluates tenant website publish attempts, writes review records, and exposes operator approve/reject/suspend/quarantine actions in SaaS Admin
- ✅ Host-based public gating now blocks suspended websites and quarantined subdomains on tenant-facing routes
- ✅ Managed-domain reminder, renewal completion, and snooze workflows are now available in SaaS Admin
- ✅ Tenant website editor content now has end-to-end save/reload/publish/public-payload regression coverage
- ✅ Repository hygiene pass completed: nested gitlink removed, lint clean, formatter checks pass, and CI now includes repo hygiene

**What's in progress** (your focus):
- 🔄 Production Stripe work is on hold pending Stripe account setup
- 🔄 Founder/KC OTP runtime hardening
- 🔄 Optional managed-domain resale follow-up
- 🔄 Final production beta validation on the live custom-domain ingress

**What's next**:
1. Re-check production admin HTML after cache purge on the custom domain
2. Validate Booking Board launch from Restaurant Admin on production-like tenant URLs
3. Decide whether managed-domain resale belongs in Phase 1 or later
4. Fix founder/KC OTP production delivery follow-up and rerun targeted checks
5. Resume production Stripe activation after a Stripe account exists

**For full details** → Read [STATUS.md](./STATUS.md)

---

## 🎯 Your First Task (If You Don't Know What to Do)

**Task**: Finish Beta Validation While Stripe Is On Hold

**What to do**:
1. Read [QUICKSTART.md](./QUICKSTART.md) (5 min)
2. Read [STATUS.md](./STATUS.md) → "What Happens Next" (3 min)
3. Read [docs/contracts/API_CONTRACTS.md](./docs/contracts/API_CONTRACTS.md) → search "admin", "board", and "website" (5 min)
4. Start in `src/index.js`, `public/admin.html`, and `public/platform/admin.html`
5. Validate with `npm test` and production smoke checks on `prod.gooddining.app`

**Est. time**: 3-4 days

**Blocker**: Stripe account creation, Twilio credential wiring, plus final beta validation

**Questions?** → Read relevant contract or ask in PR comments

---

## ✅ Before You Start Working

- [ ] Read [QUICKSTART.md](./QUICKSTART.md)
- [ ] Read [STATUS.md](./STATUS.md)
- [ ] Understand the tenant_id rule
- [ ] Know which contract applies to your task
- [ ] Run `npm run dev` to start local dev
- [ ] Run `npm run test` to verify setup

When all checked → **START CODING**

---

## 📖 Full Document Index

Click to jump to any document:

### Navigation
- [_START_HERE.md](./_START_HERE.md) ← You are here
- [QUICKSTART.md](./QUICKSTART.md) — 5-min orientation
- [STATUS.md](./STATUS.md) — Live dashboard
- [HANDOFF.md](./HANDOFF.md) — Full overview
- [docs/contracts/INDEX.md](./docs/contracts/INDEX.md) — Contract navigation

### Business & Vision
- [PRODUCT.md](./PRODUCT.md) — What we build
- [BUSINESS_MODEL.md](./BUSINESS_MODEL.md) — Pricing & revenue
- [ROADMAP.md](./ROADMAP.md) — Phase timeline
- [DECISIONS.md](./DECISIONS.md) — Architecture decisions

### Technical
- [ARCHITECTURE.md](./ARCHITECTURE.md) — System design
- [MODULE_CATALOG.md](./MODULE_CATALOG.md) — Module descriptions
- [COPILOT_SPECIFICATION.md](./COPILOT_SPECIFICATION.md) — AI assistant spec
- [TRANSITION.md](./TRANSITION.md) — Odoo migration

### Contracts (Pick by use case)
- [docs/contracts/API_CONTRACTS.md](./docs/contracts/API_CONTRACTS.md) — API endpoints
- [docs/contracts/DATA_CONTRACTS.md](./docs/contracts/DATA_CONTRACTS.md) — Database schema
- [docs/contracts/MODULE_CONTRACTS.md](./docs/contracts/MODULE_CONTRACTS.md) — Module structure
- [docs/contracts/INTEGRATION_CONTRACTS.md](./docs/contracts/INTEGRATION_CONTRACTS.md) — External APIs
- [docs/contracts/SECURITY_CONTRACTS.md](./docs/contracts/SECURITY_CONTRACTS.md) — Auth & isolation
- [docs/contracts/ERROR_CONTRACTS.md](./docs/contracts/ERROR_CONTRACTS.md) — Error codes

### Progress Tracking
- [CHECKPOINTS.md](./CHECKPOINTS.md) — 8 checkpoints with specs
- [CHECKPOINT_PROGRESS.md](./CHECKPOINT_PROGRESS.md) — Weekly tracker

### Deprecated (Old, kept for reference)
- [docs/archive/2026-03/checkpoints-legacy/tenant-checkpoint.md](./docs/archive/2026-03/checkpoints-legacy/tenant-checkpoint.md) — Use SECURITY_CONTRACTS.md instead
- [docs/archive/2026-03/contracts-legacy/routes.md](./docs/archive/2026-03/contracts-legacy/routes.md) — Use API_CONTRACTS.md instead
- [docs/archive/2026-03/contracts-legacy/db-schema.md](./docs/archive/2026-03/contracts-legacy/db-schema.md) → Use DATA_CONTRACTS.md instead

---

## 🚀 Quick Commands

```bash
# Start development
npm run dev

# Run all tests
npm run test

# Run checkpoints
npm run check:cp-all              # All checkpoints
npm run check:cp-admin-setup      # Specific checkpoint

# Deploy
npm run deploy
```

---

## 🤝 Need Help?

| Question | Answer |
|----------|--------|
| **What should I work on?** | Open [STATUS.md](./STATUS.md) → "What Happens Next" |
| **Can you explain the architecture?** | Read [ARCHITECTURE.md](./ARCHITECTURE.md) |
| **What's the DB schema?** | Read [docs/contracts/DATA_CONTRACTS.md](./docs/contracts/DATA_CONTRACTS.md) |
| **How do I build a new API endpoint?** | Read [docs/contracts/API_CONTRACTS.md](./docs/contracts/API_CONTRACTS.md) |
| **What's blocking us?** | Read [HANDOFF.md](./HANDOFF.md) → "Known Issues & Blockers" |
| **When does Phase 1 launch?** | April 15, 2026 (see [ROADMAP.md](./ROADMAP.md)) |
| **Why can't I hardcode X?** | Read [docs/contracts/SECURITY_CONTRACTS.md](./docs/contracts/SECURITY_CONTRACTS.md) |
| **What error code should I use?** | Read [docs/contracts/ERROR_CONTRACTS.md](./docs/contracts/ERROR_CONTRACTS.md) |

---

## 📝 Session Log

Each session should update this:

- **Session 1** (Mar 22): Documentation redesign + checkpoints
- **Session 2**: [TBD]
- **Session 3**: [TBD]

See [HANDOFF.md](./HANDOFF.md) for full session logs.

---

## ✨ This Hand-Off System

**What makes it special**:
- ✅ Instant project state (STATUS.md — 3 min read)
- ✅ Full context (HANDOFF.md — 15 min read)
- ✅ Quick start (QUICKSTART.md — 5 min read)
- ✅ Spec library (contracts/ — searchable)
- ✅ Progress tracking (checkpoints)
- ✅ Next steps clear (owners + ETA)
- ✅ No ambiguity (every task assigned)

**Goal**: Any AI agent should understand project state in 30 minutes, no context needed.

---

**Ready to get started?**

→ Open [QUICKSTART.md](./QUICKSTART.md) (5 minutes)

Then start building! 🚀
