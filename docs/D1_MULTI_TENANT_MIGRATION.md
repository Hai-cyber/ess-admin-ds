# D1 Multi-Tenant Migration Guide

## Scope
This document tracks migration status for tenant isolation in D1 + Worker routing.

Current code anchors:
- Resolver + override policy: #codebase src/index.js:466-542
- Bootstrap resolution state: #codebase src/index.js:1538-1552
- Guard helper contract: #codebase src/utils/tenant-guard.js:1-31

## Tenant Resolution Contract

`resolveActiveCompanyId(env, tenant, url)` now returns a structured shape:

```js
{ ok: true, companyId }
{ ok: false, reason }
```

Behavior summary:
- No DB binding: `db_unavailable`.
- `company_id` query override is considered only when host is localhost / workers.dev.
- Override is accepted only if company exists and is active.
- Tenant hostname/company/subdomain values are validated against `companies` existence.
- No fallback-to-company-1 path remains in resolver.

Reference: #codebase src/index.js:476-542

## Tenant Guard Contract

`requireTenant(handler)` is the fail-closed guard helper for tenant-required routes.

Semantics:
- Reads `activeCompanyResolution`.
- Rejects unresolved tenant context with mapped HTTP status + error code.
- Calls downstream handler only when `{ ok: true, companyId }`.

Current mapping source:
- #codebase src/utils/tenant-guard.js:1-31

Current status:
- Guard helper exists.
- Route-wide guard wiring is the next refactor stage.

## Migration Notes: Booking, Staff PIN, SSE Isolation

### Booking Isolation
- Create/read/update booking flows are company-scoped.
- Cross-tenant body override is blocked on non-local/non-workers hosts.
- SSE booking and stage-update events are keyed by company channel.

Code anchors:
- Booking create/read/update + SSE override checks: #codebase src/index.js:2639-2991

### Staff PIN Isolation
- Staff auth resolves by `(company_id, pin)`.
- Same PIN can exist in multiple tenants; each subdomain resolves to its own staff record.

Code anchor:
- #codebase src/index.js:1945-1984

### SSE Isolation
- SSE streams are stored in per-company client sets.
- Booking and stage events are sent only to the matching company stream.

Code anchor:
- #codebase src/index.js:2639-2698

## Migration Checklist (Codebase-Accurate)

- [x] Schema updated with `company_id` and tenant indexes.
- [x] `companies` seeding and tenant metadata utilities are in place.
- [x] Structured tenant resolver introduced (Step-1).
- [ ] Route tenantization guard refactor completed across all tenant-required route blocks (Step-2 wiring).
- [x] Tenant-scoped booking/staff/SSE isolation behaviors implemented.
- [x] Staff login validates tenant access.
- [x] Odoo sync uses company-scoped webhook settings.
- [x] Tests cover booking/staff/SSE tenant isolation.
- [ ] Add explicit Step-3 tests for tenant-resolution failure modes and guard ordering.

## Test Coverage Added So Far

- Tenant booking + staff PIN isolation by subdomain:
  - #codebase test/index.spec.js:383-466
- Cross-tenant stage update override rejection:
  - #codebase test/index.spec.js:467-514
- SSE booking/stage event routing by company:
  - #codebase test/index.spec.js:515-609
- Booking module gate rejection:
  - #codebase test/index.spec.js:715-750

## Next Migration Step

Complete Step-2 wiring:
- Apply `requireTenant` (or equivalent fail-closed guard) consistently to every tenant-required route block.
- Enforce guard-before-module-check and guard-before-DB-call ordering.
