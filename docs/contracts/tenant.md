# Tenant Resolution Contract

Code anchors:
- #codebase src/index.js:467-556
- #codebase src/utils/tenant-guard.js:1-31

## Return

`resolveActiveCompanyId(env, tenant, url)` returns:

```js
{ ok: true, companyId }
{ ok: false, reason }
```

## Reasons

| reason | semantics | typical status/error |
|---|---|---|
| `db_unavailable` | DB binding missing | `503 db_unavailable` |
| `companies_table_missing` | `companies` table unavailable | `503 tenant_table_missing` |
| `override_not_allowed` | `?company_id=` used on disallowed host | `403 company_id_override_not_allowed` |
| `override_company_not_found` | override company missing/inactive | `404 company_not_found` |
| `tenant_company_not_found` | tenant company id not found/inactive | `404 tenant_company_not_found` |
| `tenant_subdomain_not_found` | subdomain not mapped to active company | `404 tenant_subdomain_not_found` |
| `no_tenant_context` | no valid override and no tenant context | `400 tenant_required` |
| `unresolved` | bootstrap sentinel before resolve | `400 tenant_required` |
| `resolution_error` | unexpected resolver failure | `500 tenant_resolution_error` |

## Override rules

- `?company_id=` is allowed only when host is localhost/loopback or `*.workers.dev`.
- If override host is allowed, company must exist and be active.
- On tenant/main production hosts, override is rejected (`override_not_allowed`).
- Resolution order is: valid override -> tenant.companyId -> tenant.subdomain -> `no_tenant_context`.
