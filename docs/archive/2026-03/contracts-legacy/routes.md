# Routes Contract (Archived)

**Status**: SUPERSEDED by [API_CONTRACTS.md](./API_CONTRACTS.md) (comprehensive API specification)

## Historical Reference

This file documented the route split before the Restaurant OS redesign. All current routes are now defined in [API_CONTRACTS.md](./API_CONTRACTS.md) with:

- Full endpoint specifications (method, path, auth, params)
- Request/response schemas
- Error codes
- Performance SLAs
- Rate limiting

## Route Categories (Updated)

### Tenant-agnostic
- `GET /api/health` — Health check
- `GET /admin` — Admin dashboard
- `GET /app` — Staff app (redirect to login)

### Tenant-required
- **Booking**: `POST /api/bookings/create`, `GET /api/bookings`, `POST /api/bookings/{id}/stage`
- **Auth**: `POST /auth/login`, `POST /auth/logout`
- **Admin**: `GET /api/admin/settings`, `PUT /api/admin/settings`, `GET /api/admin/staff`
- **Notifications**: `GET /api/notifications/stream` (SSE)
- **POS** (Phase 3): `GET /api/pos/tables`, `POST /api/pos/orders`, `POST /api/pos/orders/{id}/payment`

See [API_CONTRACTS.md](./API_CONTRACTS.md) for full details.
