# Route Tenantization Contract

## Source Anchors
- Route block inventory: #codebase src/index.js:1517-3003
- Resolver bootstrap state: #codebase src/index.js:1538-1552
- Guard helper contract: #codebase src/utils/tenant-guard.js:1-31

## Tenant-Agnostic Routes
These routes must not require tenant resolution:

- `GET /api/health` #codebase src/index.js:1517-1524
- `GET /admin` (UI shell) #codebase src/index.js:1526-1531
- `GET /app` (UI shell) #codebase src/index.js:1533-1538
- `GET /danke-reservierung` #codebase src/index.js:1572-1577
- `GET /kc` compatibility redirect #codebase src/index.js:1579-1588

## Tenant-Required Routes
These routes require a valid `{ ok:true, companyId }` before business logic:

- Booking pages:
  - `/booking-form(.html)` #codebase src/index.js:1540-1554
  - `/reservierung(.html)` #codebase src/index.js:1556-1569
- Founder/KC flows:
  - `/founder(.html)` #codebase src/index.js:1590-1615
  - `/api/founder|kc/register` #codebase src/index.js:1617-1835
  - `/api/founder|kc/resend-otp` #codebase src/index.js:1837-1931
  - `/webhooks/twilio/founder-otp` #codebase src/index.js:1933-1937
  - `/api/founder|kc/verify` #codebase src/index.js:1939-1943
- Staff/admin APIs:
  - `/api/staff/auth` #codebase src/index.js:1945-1984
  - `/api/contacts` + push #codebase src/index.js:1986-2070
  - `/api/admin/integration-config` #codebase src/index.js:2072-2215
  - `/api/admin/platform-config` #codebase src/index.js:2217-2345
  - `/api/admin/staff` #codebase src/index.js:2347-2466
  - `/api/admin/media-assets` #codebase src/index.js:2468-2637
- Booking/SSE/customer APIs:
  - `/api/notifications/stream` #codebase src/index.js:2639-2698
  - `/api/bookings/create` #codebase src/index.js:2701-2798
  - `/api/bookings/:id/stage` #codebase src/index.js:2800-2893
  - `/api/bookings` #codebase src/index.js:2895-2924
  - `/api/test/booking/create` #codebase src/index.js:2926-2980
  - `/api/customers` #codebase src/index.js:2982-3001

## Fail-Closed Rules
- If tenant resolution is not OK, tenant-required routes must return an error response before module/auth/DB logic.
- No route may treat unresolved tenant context as company 1.
- `company_id` override is evaluated only under allowed hosts and still requires company existence.

## Guard Ordering (Step-2 Wiring Contract)
1. Resolve tenant once at bootstrap.
2. For tenant-required routes, apply `requireTenant` first.
3. Only then execute module gate checks, staff/admin auth, DB queries, SSE registration, and sync side effects.

Current status: `requireTenant` is implemented as a helper contract and is the target mechanism for uniform route wiring.
