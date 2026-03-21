# Routes Contract

Code anchors:
- #codebase src/index.js:1565-3075
- #codebase src/index.js:1555-1562

## Tenant-agnostic

- `GET /api/health`
- `GET /admin`, `/admin/`
- `GET /app`, `/app/`
- `GET /danke-reservierung`, `/danke-reservierung.html`
- `GET /kc`, `/kc-form`, `/kc-form.html` (redirect route)

## Tenant-required (wrapped by `runTenantRoute`)

- Booking pages: `/booking-form`, `/booking-form.html`, `/reservierung`, `/reservierung.html`
- Founder/KC pages + APIs:
  - `/founder`, `/founder-form`, `/founder-form.html`
  - `/api/founder/register`, `/api/kc/register`
  - `/api/founder/resend-otp`, `/api/kc/resend-otp`
  - `/api/founder/verify`, `/api/kc/verify`
  - `/webhooks/twilio/founder-otp`, `/api/webhooks/twilio/founder-otp`
- Staff/admin/contact/media APIs:
  - `/api/staff/auth`
  - `/api/contacts`
  - `/api/contacts/:id/push`
  - `/api/admin/integration-config` (GET/POST)
  - `/api/admin/platform-config` (GET/POST)
  - `/api/admin/staff` (GET/POST)
  - `/api/admin/media-assets` (GET/POST)
- Booking/SSE/customer APIs:
  - `/api/notifications/stream`
  - `/api/bookings/create`
  - `/api/bookings/:id/stage`
  - `/api/bookings`
  - `/api/test/booking/create`
  - `/api/customers`
