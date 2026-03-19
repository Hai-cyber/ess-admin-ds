# Tenant Resolution Contract

## Source Anchors
- Resolver + override policy: #codebase src/index.js:466-542
- Bootstrap resolution state: #codebase src/index.js:1538-1552

## Return Shape
`resolveActiveCompanyId(env, tenant, url)` returns one of:

```js
{ ok: true, companyId: number }
{ ok: false, reason: string }
```

## Reason Codes
- `db_unavailable`: D1 binding missing.
- `companies_table_missing`: resolver could not query `companies` table.
- `override_not_allowed`: `?company_id=` used on disallowed host.
- `override_company_not_found`: override company does not exist or is inactive.
- `tenant_company_not_found`: `tenant.companyId` exists but is not active in `companies`.
- `tenant_subdomain_not_found`: subdomain provided but no active company match.
- `no_tenant_context`: no override, no tenant company, and no tenant subdomain.
- `unresolved`: bootstrap sentinel before resolver call.
- `resolution_error`: bootstrap catch-all when resolver throws.

## Override Rules
- Allowed hosts are only those matched by `canOverrideCompanyIdForHost`:
  - `*.workers.dev`
  - `localhost*`, `127.0.0.1`, `[::1]`
- On allowed hosts, `company_id` override is accepted only if the company exists and `is_active = 1`.
- On all other hosts, `company_id` override returns a non-OK resolver result (`override_not_allowed`).

## Bootstrap Contract
- Worker bootstrap stores resolver output in `activeCompanyResolution`.
- `activeCompanyId` is assigned only when `activeCompanyResolution.ok === true`.
- There is no fallback-to-company-1 path.
