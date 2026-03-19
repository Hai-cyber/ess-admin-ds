Tenant checkpoint (Step-1 complete, Step-2 contract staged):

- Resolver now returns structured results only: `{ ok:true, companyId }` or `{ ok:false, reason }`; no fallback to company 1 remains. Source: #codebase src/index.js:476-542 and bootstrap state #codebase src/index.js:1538-1552.
- `company_id` override is allowed only on localhost/workers.dev and must reference an active company.
- `requireTenant` exists as the fail-closed guard contract with reason->HTTP mappings. Source: #codebase src/utils/tenant-guard.js:1-31.
- Route inventory is split conceptually into tenant-agnostic vs tenant-required; Step-2 wiring still needs guard-first enforcement across all tenant-required blocks.
- Isolation already proven for booking reads, staff PIN, stage update override blocking, and SSE per-company routing. Source: #codebase test/index.spec.js:383-609.
- Step-3 should add tenant-resolution failure tests (tenant_required, tenant_not_found, override_not_allowed) and guard-ordering assertions before module/auth/DB logic.