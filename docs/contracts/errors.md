# Tenant Resolution Errors Contract

## Source Anchors
- Resolver reasons: #codebase src/index.js:476-542
- Guard error mapping: #codebase src/utils/tenant-guard.js:1-31
- Existing route-level override 403 responses: #codebase src/index.js:2675-2691 #codebase src/index.js:2840-2856

## Canonical Failure Modes
| Failure mode | Resolver reason(s) | HTTP status | Response error code |
|---|---|---:|---|
| `tenant_required` | `no_tenant_context`, `unresolved` | 400 | `tenant_required` |
| `tenant_not_found` | `override_company_not_found`, `tenant_company_not_found`, `tenant_subdomain_not_found` | 404 | `company_not_found` or tenant-specific not-found codes |
| `override_not_allowed` | `override_not_allowed` | 403 | `company_id_override_not_allowed` |
| `tenant_table_missing` | `companies_table_missing` | 503 | `tenant_table_missing` |
| `db_unavailable` | `db_unavailable` | 503 | `db_unavailable` |
| `tenant_resolution_error` | `resolution_error` | 500 | `tenant_resolution_error` |

## Current Guard Mapping (Authoritative)
`requireTenant` currently maps unresolved tenant reasons to:
- `db_unavailable` -> `503 db_unavailable`
- `companies_table_missing` -> `503 tenant_table_missing`
- `resolution_error` -> `500 tenant_resolution_error`
- `override_not_allowed` -> `403 company_id_override_not_allowed`
- `override_company_not_found` -> `404 company_not_found`
- `tenant_company_not_found` -> `404 tenant_company_not_found`
- `tenant_subdomain_not_found` -> `404 tenant_subdomain_not_found`
- `no_tenant_context`, `unresolved` -> `400 tenant_required`
- Unknown reason -> `400 <reason>`

## Notes
- Existing booking/SSE route code also returns a host-level override error message today when override is disallowed.
- Step-2 route wiring should normalize tenant-required errors via `requireTenant` before route logic.
