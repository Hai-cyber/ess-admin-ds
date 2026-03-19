Tenant checkpoint for future Copilot sessions:

- Step-1 is done: tenant resolution is structured and fail-closed at resolver level. `resolveActiveCompanyId` returns `{ ok:true, companyId }` or `{ ok:false, reason }` with no company-1 fallback.
- Override policy is strict: `company_id` query override is allowed only on localhost / workers.dev and only for existing active companies.
- Bootstrap now tracks `activeCompanyResolution`; `activeCompanyId` is assigned only when resolution is OK.
- `requireTenant` helper exists and defines reason->HTTP mappings (`tenant_required`, `company_not_found`, `company_id_override_not_allowed`, etc.).
- Booking/staff/SSE isolation already validated by tests: tenant-specific booking reads, same-PIN staff isolation by host, cross-tenant stage-update override block, and per-company SSE event routing.
- Step-2 (next code task): wire tenant guard across every tenant-required route block before module checks, auth, DB queries, SSE registration, and sync side effects.
- Step-3 (next test task): add explicit tenant-resolution failure coverage (main-domain tenant-required routes, unknown subdomain, override_not_allowed normalization, localhost override success when company exists).