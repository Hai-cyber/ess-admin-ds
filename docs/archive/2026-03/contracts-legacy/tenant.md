# Tenant Resolution Contract (Archived)

**Status**: SUPERSEDED by [SECURITY_CONTRACTS.md](./SECURITY_CONTRACTS.md) (authentication & authorization)

## Historical Reference

This file documented the tenant resolution logic. All current authentication and tenant resolution is now in [SECURITY_CONTRACTS.md](./SECURITY_CONTRACTS.md) with:

- Tenant resolution priority (subdomain → override → error)
- PIN authentication logic
- Rate limiting on PIN bruteforce
- RBAC (role-based access control)
- OAuth (planned Phase 5+)
- Audit logging

## Current Tenant Resolution (Updated)

### Resolution sources (priority order)

1. **Subdomain** (primary): `tenant_abc.restaurantos.app` → `tenant_id = tenant_abc`
2. **Query override** (dev only): `?company_id=1` (localhost/workers.dev only)
3. **None**: Returns `400 tenant_required`

### Tenant resolution function

Implemented in [SECURITY_CONTRACTS.md - Tenant Resolution](./SECURITY_CONTRACTS.md#tenant-resolution)

### Override rules (same as before)

- `?company_id=` allowed only on localhost/loopback or `*.workers.dev`
- Override tenant must exist and be active
- Production hosts reject override (fail-closed)
- Resolution order: override → subdomain → error
