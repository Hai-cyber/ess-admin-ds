# Tenant Checkpoint (Primer)

Resolver is fail-closed: `resolveActiveCompanyId` returns `{ ok:true, companyId }` or `{ ok:false, reason }` (#codebase src/index.js:477-556). No company-1 fallback exists.

Guard contract: tenant-required routes are wrapped by `runTenantRoute`/`requireTenant`; unresolved tenant context returns mapped JSON errors before route logic (#codebase src/index.js:1555-1562, #codebase src/utils/tenant-guard.js:1-31).

Route split:
- Tenant-agnostic: `/api/health`, `/admin`, `/app`, `/danke-reservierung`, `/kc*` redirect.
- Tenant-required: booking/founder/staff/admin/contact/media/SSE/customer APIs.

Override rules:
- `?company_id=` allowed only on localhost/loopback or `*.workers.dev`.
- Disallowed on tenant/main production hosts (`company_id_override_not_allowed`).

Essential tests already present:
- Main-domain tenant-required -> `400 tenant_required`.
- Unknown subdomain -> `404 tenant_subdomain_not_found`.
- Main-domain SSE blocked (no stream).
- localhost/workers override succeeds for existing company.
- Tenant host mismatched override -> `403 company_id_override_not_allowed`.