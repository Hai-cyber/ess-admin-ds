# Test Coverage Summary

## Tenant Isolation Tests (Implemented)

### Booking & Staff PIN Isolation

**Location:** [test/index.spec.js:383-466](../../test/index.spec.js#L383)

Tests:
- ✅ Different subdomains create separate bookings
- ✅ Company1 read sees only Company1 bookings
- ✅ Company2 read sees only Company2 bookings
- ✅ Same PIN in different companies returns different staff

### Cross-Tenant Stage Update Blocking

**Location:** [test/index.spec.js:467-514](../../test/index.spec.js#L467)

Tests:
- ✅ Body `companyId` override on tenant host returns 403
- ✅ Booking stage remains unchanged after reject

### SSE Event Routing Per Company

**Location:** [test/index.spec.js:515-609](../../test/index.spec.js#L515)

Tests:
- ✅ SSE stream opens on `/api/notifications/stream`
- ✅ Connected event received
- ✅ Company1 booking create sends event to Company1 stream only
- ✅ Company1 stage update sends event to Company1 stream only
- ✅ Company2 events do not leak to Company1 stream

### Module Gating

**Location:** [test/index.spec.js:715-750](../../test/index.spec.js#L715)

Tests:
- ✅ Booking create rejected when `module_booking_management` disabled
- ✅ Returns 403 with appropriate error message

---

## Tenant Resolution Tests (Implemented)

**Location:** [test/index.spec.js:610-695](../../test/index.spec.js#L610)

### Main Domain Blocking

Tests:
- ✅ `/api/bookings` on main domain returns 400 `tenant_required`
- ✅ `/api/staff/auth?pin=1111` on main domain returns 400 `tenant_required`

### Unknown Subdomain Blocking

Tests:
- ✅ `/booking-form` on unknown subdomain returns 404 `tenant_subdomain_not_found`
- ✅ `/founder` on unknown subdomain returns 404 `tenant_subdomain_not_found`

### SSE Tenant Guard

Tests:
- ✅ `/api/notifications/stream` on main domain returns 400 `tenant_required` (no SSE opens)

### Query Override Authorization

Tests:
- ✅ `localhost:8787?company_id=2` succeeds (returns company2 data)
- ✅ `tenant-preview.workers.dev?company_id=2` succeeds
- ✅ `restaurant1.quan-esskultur.de?company_id=2` returns 403 `company_id_override_not_allowed`

---

## Test Implementation Status

| Category | Covered | Missing | Priority |
|----------|---------|---------|----------|
| Tenant resolution (Step-3) | ✅ All core cases | — | N/A |
| Booking isolation | ✅ Read/create/update | — | — |
| SSE isolation | ✅ Event routing | Timeout edge cases | Low |
| Staff PIN isolation | ✅ Subdomain routing | — | — |
| Module gating | ✅ Enable/disable | — | — |
| Override authorization | ✅ Allowed/blocked hosts | Invalid company_id | Low |

---

## Running Tests

```bash
# Run all tenant tests
npm run test

# Run specific suite
npm run test -- --grep "tenant isolation"
npm run test -- --grep "SSE"
npm run test -- --grep "Override"
```

## Fixture Data

All tests use database initialization via `initializeDatabase(env.DB)`:
- **Organization 1** & **Organization 2**: Pre-seeded
- **Company 1** (`restaurant1`) & **Company 2** (`restaurant2`)
- **Staff pins**: `1111` (hostess), `1234` (admin), `8888` (manager)
- **Booking module**: Enabled by default on all companies

See [src/db/init.js](../../src/db/init.js) for seeding details.
