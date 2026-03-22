# Current Structure, Status, and Orientation Export

Date: 2026-03-21
Repository: ess-admin-ds

## 1) Current Structure

### Top-level architecture

- `cloudflare/`:
  - Target runtime structure for Workers, Durable Objects, Queues, Schemas, and Cloudflare test setup.
- `knowledge/`:
  - Long-term architecture docs, ADRs, specs, APIs, runbooks, standards.
- `src/` + `public/`:
  - Active production implementation surface for current app flows.
- `docs/`:
  - Contracts, migration notes, secrets setup, checkpoints, and archived legacy references.
- `test/`:
  - Test suite for current implementation.

### Parallel legacy workspace

- External folder `make.com legacies/` still exists and contains historical Make.com blueprints.
- Internal archive references exist under `docs/legacies/` and explicitly keep originals unchanged.

## 2) Current Status

### Delivery state

- Transition status: IN PROGRESS (Odoo -> Cloudflare-native migration).
- Current phase: Phase 1 (booking system stabilization).
- Confirmed focus now:
  - booking system
  - admin UI
  - staff mobile UI

### Implemented and verified signals

- Booking flow implemented through Worker endpoints and form pages.
- E2E summary reports complete flow coverage for:
  - online booking form -> board -> staff app
  - staff create flow
  - stage transitions
  - realtime SSE updates
- Odoo direct sync is documented as optional/placeholder-token dependent in current test summary.

### Repository working state

- Newly added strategic docs are present and currently uncommitted:
  - `AI_CONTEXT.md`
  - `ARCHITECTURE.md`
  - `DECISIONS.md`
  - `ROADMAP.md`
  - `TRANSITION.md`
- Nested subproject marker indicates dirty state for `ess-admin-ds` subproject pointer.

## 3) Strategic Orientation

### Canonical direction (latest docs)

- Business logic: Cloudflare Workers.
- Source of truth: Cloudflare D1.
- Odoo/Make.com: integration-only, non-core.
- Product framing: vertical SaaS for restaurant operations, not generic ERP.

### Explicit non-goals

- No business logic in Odoo.
- No dependency on Make.com for core flow.
- No generic ERP feature expansion.

### Roadmap orientation

- Phase 1: booking + admin UI
- Phase 2: staff mobile UI
- Phase 3: POS + TSE
- Phase 4: remove Odoo
- Phase 5: optional modules (inventory, invoicing, HR)

## 4) Decision Register Snapshot

- ADR-001: D1 is the source of truth.
- ADR-002: Odoo is legacy integration only.
- ADR-003: Do not build generic ERP features.

## 5) Alignment Notes

- Existing foundational docs already support Cloudflare-first architecture and tenant isolation.
- New docs sharpen orientation away from Odoo-centric operations.
- There is no hard conflict with multi-tenant direction; current framing is narrower: restaurant vertical SaaS with Cloudflare-native execution.

## 6) Practical Conclusion

Current program state is coherent around a Cloudflare-native migration path:

- Operational core is moving into Workers + D1.
- Booking domain is the active stabilization surface.
- Odoo remains transitional and should be treated as mirror/integration only.
- POS + TSE are the next architectural expansion after admin/staff UI stabilization.
