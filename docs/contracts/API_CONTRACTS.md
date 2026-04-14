# API Contracts — Restaurant OS

**Purpose**: Define all Worker endpoints, request/response shapes, and error handling.

**Principle**: Contracts are the source of truth for API design. All implementations must conform.

---

## Contract Framework

### Endpoint definition

```
Method: GET|POST|PUT|DELETE
Path: /api/{module}/{resource}
Auth: none|pin|session|session_or_pin|token
Tenant: required|optional
Rate limit: n req/min
Latency target: nnn ms
```

### Request/Response shapes

```javascript
{
  "request": { /* JSON body or FormData */ },
  "response": { "ok": true, "data": {...} },
  "errors": [
    { "code": "error_code", "status": 400, "message": "..." }
  ]
}
```

---

## Core Endpoints

### 🌐 PLATFORM Module (no tenant required)

#### GET /api/platform/plans

**Purpose**: Return public pricing tier definitions

```javascript
// Response (200 OK)
{
  "ok": true,
  "plans": [
    {
      "id": "core",
      "name": "Core",
      "price_eur_monthly": 29,
      "features": [
        "Tenant website (1 template)",
        "Contact form",
        "Online booking form",
        "Booking email notifications",
        "Basic admin UI",
        "Website builder starter setup"
      ]
    },
    {
      "id": "commerce",
      "name": "Commerce",
      "price_eur_monthly": 69,
      "features": ["Everything in Core", "Onsite booking + walk-ins", "Booking board + stage management", "SMS notifications", "Staff PIN app", "POS + payment methods: cash, PayPal, debit/credit card, Apple Pay", "Stripe as optional payment gateway", "TSE receipts"]
    },
    {
      "id": "growth",
      "name": "Repeat Guests",
      "price_eur_monthly": 89,
      "features": ["Everything in Service", "Offers for previous guests", "Simple return campaigns", "Repeat-guest overview"]
    },
    {
      "id": "enterprise",
      "name": "Groups",
      "price_eur_monthly": null,
      "features": ["Everything in Repeat Guests", "Multi-location", "Custom integrations", "SLA support"]
    }
  ]
}
```

**Tenant**: Not required  
**Auth**: None  
**Rate limit**: 60 req/min  
**Latency**: < 100ms (cached)

---

#### GET /api/platform/signup/check-subdomain

**Purpose**: Check if a subdomain slug is available

```javascript
// Request
GET /api/platform/signup/check-subdomain?slug=trattoria-roma

// Response (200 OK)
{
  "ok": true,
  "available": true,
  "slug": "trattoria-roma",
  "url": "trattoria-roma.gooddining.app"
}

// Response (409 if taken)
{
  "ok": false,
  "code": "subdomain_taken",
  "suggestion": "trattoria-roma-2"
}
```

**Tenant**: Not required  
**Auth**: None  
**Rate limit**: 30 req/min per IP  
**Latency**: < 200ms

---

#### POST /api/platform/signup

**Purpose**: Create a new restaurant account and provision a tenant

```javascript
// Request
{
  "restaurant_name": "Trattoria Roma",
  "owner_email": "owner@roma.de",
  "owner_phone": "+49123456789",   // optional
  "subdomain": "trattoria-roma",
  "plan": "core",                   // core | commerce | growth | enterprise
  "country": "DE",
  "board_pin": "1234"               // required 4-digit board PIN for the seeded operational admin/staff record
}

// Response (201 Created)
{
  "ok": true,
  "message": "Workspace created. Complete owner identity verification to continue.",
  "company_id": 21,
  "organization_id": 7,
  "subdomain": "trattoria-roma",
  "website_url": "https://trattoria-roma.gooddining.app",
  "preview_admin_url": "/admin?company_id=21",
  "preview_board_url": "/board?company_id=21",
  "board_pin_hint": "1234",
  "auth": {
    "scope": "restaurant_admin",
    "email": "owner@roma.de",
    "redirect_path": "/admin?company_id=21",
    "expires_in_seconds": 900,
    "delivery": "email",
    "preview_verify_url": "https://.../auth/email/callback?token=..."
  },
  "status": "pending_identity_verification"
}

// Errors
// 409 subdomain_taken | 400 validation_failed | 409 email_already_registered | 429 rate_limit_exceeded
```

**Tenant**: Not required  
**Auth**: None (public signup)  
**Rate limit**: 5 signups/hour per IP (prevent abuse)  
**Latency**: < 1s  
**Side effect**: Creates tenant bootstrap, seeds owner identity plus memberships, and starts owner identity verification

---

#### POST /api/platform/signup/verify-email

**Purpose**: Verify owner email address and activate the trial

```javascript
// Request
{
  "token": "tok_abc123xyz"
}

// Response (200 OK)
{
  "ok": true,
  "tenant_id": "trattoria-roma",
  "status": "trial_active",
  "redirect_url": "https://trattoria-roma.gooddining.app/admin/setup"
}

// Errors
// 400 token_invalid | 400 token_expired | 409 already_verified
```

**Tenant**: Not required  
**Auth**: Token in body  
**Rate limit**: 10 req/min per IP  
**Latency**: < 500ms

---

### ✅ AUTH Module

#### POST /api/auth/email/request-link

**Purpose**: Start email magic-link login for Restaurant Admin or SaaS Admin

```javascript
// Request
{
  "email": "owner@roma.de",
  "scope": "restaurant_admin",   // restaurant_admin | platform_admin
  "company_id": 21,               // required for restaurant_admin when caller wants a specific tenant
  "redirect_path": "/admin?company_id=21"
}

// Response (200 OK)
{
  "ok": true,
  "scope": "restaurant_admin",
  "challenge_id": "challenge_abc123",
  "delivery": "email",
  "expires_in_seconds": 900,
  "preview_url": "https://.../auth/email/callback?token=..." // only on dev/workers.dev preview-capable hosts
}

// Errors
// 400 validation_failed | 404 auth_membership_not_found | 503 auth_email_not_configured
```

**Tenant**: Optional  
**Auth**: None  
**Rate limit**: 5 req/15 min per email + IP  
**Latency**: < 500ms

#### GET /auth/email/callback

**Purpose**: Consume a magic-link token, establish an admin session, and redirect to the requested admin surface

```javascript
// Request
GET /auth/email/callback?token=token_opaque

// Response (302 Found)
// Sets HttpOnly session cookie and redirects to /admin or /platform/admin.html
```

**Tenant**: Optional  
**Auth**: Token in query  
**Rate limit**: 10 req/min per IP  
**Latency**: < 500ms

#### GET /auth/google/start

**Purpose**: Start Google OAuth login for Restaurant Admin or SaaS Admin

```javascript
// Request
GET /auth/google/start?scope=restaurant_admin&company_id=21&redirect_path=/admin?company_id=21

// Response (302 Found)
// Redirect to Google OAuth consent screen
```

**Tenant**: Optional  
**Auth**: None  
**Rate limit**: 10 req/min per IP  
**Latency**: < 300ms

#### GET /auth/google/callback

**Purpose**: Complete Google OAuth, bind or resolve the user identity, establish a session, and redirect to admin

```javascript
// Request
GET /auth/google/callback?code=google_auth_code&state=opaque_state

// Response (302 Found)
// Sets HttpOnly session cookie and redirects to /admin or /platform/admin.html
```

**Tenant**: Optional  
**Auth**: Google OAuth callback params  
**Rate limit**: 10 req/min per IP  
**Latency**: < 2s

#### GET /api/auth/session

**Purpose**: Return the current admin session, if present

```javascript
// Response (200 OK, authenticated)
{
  "ok": true,
  "authenticated": true,
  "scope": "restaurant_admin",
  "company_id": 21,
  "user": {
    "id": "user_abc",
    "email": "owner@roma.de",
    "display_name": "Trattoria Roma Owner",
    "role": "admin"
  }
}

// Response (200 OK, anonymous)
{
  "ok": true,
  "authenticated": false
}
```

**Tenant**: Optional  
**Auth**: Session cookie  
**Rate limit**: 30 req/min  
**Latency**: < 200ms

#### POST /api/auth/logout

**Purpose**: Revoke the current admin session and clear the auth cookie

```javascript
// Response (200 OK)
{
  "ok": true,
  "logged_out": true
}
```

**Tenant**: Optional  
**Auth**: Session cookie  
**Rate limit**: 20 req/min  
**Latency**: < 200ms

#### GET /api/staff/auth

**Purpose**: Booking Board onsite PIN authentication only

```javascript
// Request
GET /api/staff/auth?pin=1234&company_id=21

// Response (200 OK)
{
  "success": true,
  "staffId": "staff_123",
  "staffName": "Hostess Anna",
  "role": "hostess",
  "companyId": 21
}

// Errors
{
  "ok": false,
  "code": "invalid_pin",
  "message": "PIN incorrect"
  // Status: 401
}
```

**Tenant**: Required  
**Auth**: PIN  
**Rate limit**: 5 req/min per IP  
**Latency**: < 200ms

**Important**:
- This endpoint is for Booking Board onsite and other explicitly board-scoped operational flows only.
- It must not be treated as a general login path.
- Restaurant Admin, SaaS Admin, signup, and other non-board surfaces must use identity sign-in instead of PIN.

---

### ✅ BOOKING Module

#### POST /api/bookings/create

**Purpose**: Guest submits booking form

```javascript
// Request (FormData)
{
  "name": "Max Müller",
  "phone": "+49123456789",
  "email": "max@example.com",
  "date": "2026-03-22",
  "time": "19:00",
  "pax": 4,
  "area": "indoor",
  "cf_token": "0x4AAAA..."  // Turnstile token
}

// Response (200 OK)
{
  "ok": true,
  "booking_id": "booking_abc123",
  "redirect_url": "/danke-reservierung?id=booking_abc123&date=2026-03-22&time=19:00&pax=4"
}

// Errors
{
  "ok": false,
  "code": "turnstile_failed",
  "message": "CAPTCHA verification failed"
  // Status: 403
}
```

**Tenant**: From subdomain or `?company_id=` override (localhost only)  
**Auth**: None (CAPTCHA is gate)  
**Rate limit**: 10 req/min per IP  
**Latency**: < 500ms  

**Validation**:
- Phone: E.164 format
- Date: >= today, <= 60 days
- Time: 15-min slots, within business hours
- Pax: 1-12
- Area: enum (indoor|outdoor|garden|bar)

---

#### GET /api/bookings

**Purpose**: List bookings for a date (board view)

```javascript
// Request
GET /api/bookings?date=2026-03-22&area=indoor

// Response (200 OK)
{
  "ok": true,
  "company_id": 1,
  "date": "2026-03-22",
  "data": [
    {
      "id": "booking_abc",
      "company_id": 1,
      "contact_name": "Max Müller",
      "phone": "+49123456789",
      "guests_pax": 4,
      "booking_time": "19:00",
      "booking_datetime": "2026-03-22T19:00:00Z",
      "area": "indoor",
      "stage": "pending",  // pending|confirmed|arrived|done|cancelled|noshow
      "stage_id": 1,
      "source": "web",  // web|phone|onsite
      "submitted_at": "2026-03-22T18:45:00Z",
      "updated_at": "2026-03-22T18:45:00Z"
    }
  ]
}

// Errors
{
  "ok": false,
  "code": "tenant_required",
  "message": "Tenant context not found"
  // Status: 400
}
```

**Tenant**: Required  
**Auth**: session_or_pin or none (depends on host and surface)  
**Rate limit**: 30 req/min  
**Latency**: < 1s  

**Query params**:
- `date` (required): YYYY-MM-DD
- `area` (optional): Filter by area
- `stage` (optional): Filter by stage

---

#### POST /api/bookings/{id}/stage

**Purpose**: Staff updates booking stage (confirm, arrive, done, cancel)

```javascript
// Request
{
  "stage": "confirmed",  // confirmed|arrived|done|cancelled|noshow
  "notes": "Early arrival, seat at table 5",
  "staff_id": "staff_123"  // from auth context
}

// Response (200 OK)
{
  "ok": true,
  "booking_id": "booking_abc",
  "old_stage": "pending",
  "new_stage": "confirmed",
  "timestamp": "2026-03-22T20:15:00Z"
}

// Errors
{
  "ok": false,
  "code": "booking_not_found",
  "message": "Booking not found"
  // Status: 404
}
```

**Tenant**: Required  
**Auth**: session_or_pin  
**Rate limit**: 60 req/min  
**Latency**: < 200ms  

**Validation**:
- Stage: enum (confirmed|arrived|done|cancelled|noshow)
- Booking exists and belongs to tenant
- Stage transition valid (e.g., pending → confirmed)

---

#### GET /api/notifications/stream

**Purpose**: Real-time Server-Sent Events (SSE) for live updates

```
GET /api/notifications/stream?company_id=1

Response (200, Content-Type: text/event-stream):

event: booking
data: {"id":"booking_abc","contact_name":"Max","stage":"pending"}

event: stage-update
data: {"booking_id":"booking_abc","new_stage":"confirmed"}

event: order-update
data: {"order_id":"order_xyz","status":"sent_to_kitchen"}
```

**Tenant**: Required  
**Auth**: None (open stream from same domain)  
**Connections**: Unlimited per tenant  
**Latency**: < 200ms per event  

**Events**:
- `booking` — New booking created
- `stage-update` — Booking stage changed
- `order-update` — POS order status changed
- `payment` — Payment processed
- `notification` — Alert sent

---

### ⏳ POS Module (Phase 3)

#### GET /api/pos/tables

**Purpose**: List all tables with status

```javascript
// Response
{
  "ok": true,
  "tables": [
    {
      "id": "table_1",
      "number": 1,
      "area": "indoor",
      "capacity": 4,
      "status": "free",  // free|occupied|reserved|closed
      "current_order_id": null,
      "current_guests": null
    },
    {
      "id": "table_2",
      "number": 2,
      "area": "indoor",
      "capacity": 6,
      "status": "occupied",
      "current_order_id": "order_abc",
      "current_guests": "Smith party"
    }
  ]
}
```

**Tenant**: Required  
**Auth**: PIN required  
**Latency**: < 500ms  

---

#### POST /api/pos/orders

**Purpose**: Create order from booking or table

```javascript
// Request
{
  "booking_id": "booking_abc",  // or
  "table_id": "table_5",
  "items": [
    { "product_id": "schnitzel_1", "qty": 1, "price": 18.50 },
    { "product_id": "beer_1", "qty": 2, "price": 5.00 }
  ]
}

// Response
{
  "ok": true,
  "order_id": "order_xyz",
  "table_id": "table_5",
  "total": 28.50,
  "status": "open",
  "created_at": "2026-03-22T20:15:00Z"
}
```

**Tenant**: Required  
**Auth**: PIN required  
**Latency**: < 1s  

---

#### POST /api/pos/orders/{id}/payment

**Purpose**: Process payment (card, cash, split)

```javascript
// Request
{
  "amount": 28.50,
  "currency": "EUR",
  "method": "card",  // card|cash|split
  "stripe_token": "tok_visa",
  "tip": 2.50
}

// Response
{
  "ok": true,
  "transaction_id": "txn_abc123",
  "amount": 28.50,
  "tip": 2.50,
  "total": 31.00,
  "status": "completed",
  "receipt_url": "/receipts/txn_abc123.pdf"
}
```

**Tenant**: Required  
**Auth**: PIN required  
**Latency**: < 3s  

---

### ⏳ ADMIN Module (Phase 1)

#### GET /api/admin/settings

**Purpose**: Retrieve restaurant configuration

```javascript
// Response
{
  "ok": true,
  "settings": {
    "name": "Restaurant Esskultur",
    "address": "Hauptstr. 1, 10115 Berlin",
    "phone": "+49301234567",
    "website": "https://esskultur.de",
    "business_hours": {
      "mon": { "open": "10:00", "close": "22:00" },
      "tue": { "open": "10:00", "close": "22:00" },
      // ...
      "sun": { "open": "11:00", "close": "21:00" }
    },
    "areas": ["indoor", "outdoor", "garden", "bar"],
    "payment_methods": ["card", "cash"],
    "modules_enabled": ["booking", "pos", "payment"]
  }
}
```

**Tenant**: Required  
**Auth**: Admin PIN only  
**Latency**: < 200ms  

---

#### PUT /api/admin/settings

**Purpose**: Update restaurant configuration

```javascript
// Request
{
  "name": "Restaurant Esskultur",
  "address": "Hauptstr. 1, 10115 Berlin",
  "phone": "+49301234567",
  "business_hours": { /* same shape */ },
  "areas": ["indoor", "outdoor"],
  "payment_methods": ["card", "cash", "paypal"]
}

// Response
{
  "ok": true,
  "message": "Settings updated"
}

// Errors
{
  "ok": false,
  "code": "validation_failed",
  "errors": [
    { "field": "phone", "message": "Invalid phone format" }
  ]
  // Status: 400
}
```

**Tenant**: Required  
**Auth**: Admin PIN only  
**Latency**: < 200ms  

---

#### GET /api/admin/staff

**Purpose**: List staff users

```javascript
// Response
{
  "ok": true,
  "staff": [
    {
      "id": "staff_1",
      "name": "Hostess Anna",
      "pin": "1111",
      "role": "hostess",
      "is_active": true,
      "created_at": "2026-01-15T10:00:00Z"
    }
  ]
}
```

**Tenant**: Required  
**Auth**: Admin PIN only  
**Latency**: < 200ms  

---

#### POST /api/admin/staff

**Purpose**: Add staff user

```javascript
// Request
{
  "name": "Bartender Tom",
  "role": "bartender",  // hostess|bartender|manager|admin
  "pin": "2222"
}

// Response
{
  "ok": true,
  "staff_id": "staff_2",
  "message": "Staff added"
}
```

**Tenant**: Required  
**Auth**: Admin PIN only  
**Latency**: < 200ms  

---

### 📋 Error Response Format

All endpoints return consistent error format:

```javascript
{
  "ok": false,
  "code": "error_code",  // machine-readable
  "message": "Human readable message",
  "status": 400,  // HTTP status
  "details": { /* optional debug info */ }
}
```

**Standard error codes**:

| Code | Status | Meaning |
|------|--------|---------|
| `tenant_required` | 400 | Tenant context not resolved |
| `auth_required` | 401 | PIN authentication required |
| `invalid_pin` | 401 | PIN incorrect |
| `permission_denied` | 403 | User lacks permission |
| `not_found` | 404 | Resource not found |
| `validation_failed` | 400 | Input validation failed |
| `conflict` | 409 | Booking/order conflict (e.g., table occupied) |
| `payment_failed` | 402 | Payment processing failed |
| `rate_limit_exceeded` | 429 | Too many requests |
| `dependency_failed` | 503 | External service unavailable (Stripe, Twilio) |
| `db_error` | 500 | Database error |
| `internal_error` | 500 | Unexpected error |

---

## Response Envelope

All successful responses use:

```javascript
{
  "ok": true,
  "data": { /* endpoint-specific */ }
}
```

All errors use:

```javascript
{
  "ok": false,
  "code": "error_code",
  "message": "description"
}
```

**Why**: Clients check `ok` first, then parse `data` or `code`.

---

## Performance SLAs

| Operation | Target | Acceptable |
|-----------|--------|-----------|
| Auth login | < 200ms | < 500ms |
| Booking create | < 500ms | < 1s |
| Booking list | < 1s | < 2s |
| Stage update | < 200ms | < 500ms |
| SSE event | < 200ms | < 500ms |
| POS order create | < 1s | < 2s |
| Payment process | < 3s | < 5s |

---

## Rate Limiting

**Per IP**:
- Auth: 5 req/min (prevent PIN bruteforce)
- Booking create: 10 req/min (prevent spam)
- General: 60 req/min (default)

**Response header** (when limited):
```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1711186320
```

---

## Versioning

Current API version: `v1`

**Path**: `/api/v1/bookings/create` (future)  
**Currently**: `/api/bookings/create` (implicit v1)

**Breaking changes**:
- Require version bump to `/api/v2/...`
- Keep v1 alive for 6 months (deprecation notice)
- Notify restaurants 30 days before sunset

---

## Pagination (Future)

Once dataset sizes grow:

```javascript
GET /api/bookings?date=2026-03-22&page=1&limit=50

Response:
{
  "ok": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

---

## Testing

All endpoints have test cases in `test/`:

```bash
test/auth.spec.js
test/booking.spec.js
test/pos.spec.js
test/admin.spec.js
test/error-handling.spec.js
```

Run:
```bash
npm run test
```

---

## Contract Compliance

Before deploying:

1. ✅ All endpoints match this contract
2. ✅ Request/response shapes match
3. ✅ Error codes match
4. ✅ Performance targets met
5. ✅ Rate limits active
6. ✅ Tests passing
7. ✅ No tenant data leaks

---

## Founder/KC Legacy Compatibility (Reference Mode)

Purpose: Preserve migration-safe API assumptions for future Founder/KC reactivation without adding current core dependency.

### Current Mode

- Founder/KC forms are reference assets only in current phases.
- No new core flow should depend on legacy external orchestration.
- Reactivation work must follow this compatibility section plus active contracts.

### Canonical API Mapping (Placeholder Table)

| Legacy Flow | Legacy Field | Canonical API Field | Transform Rule | Required |
|---|---|---|---|---|
| founder/register | `phone` | `phone` | normalize E.164 | yes |
| founder/register | `name` | `contact_name` | trim + collapse spaces | yes |
| founder/register | `channel` | `otp_channel` | enum map to `sms|whatsapp` | yes |
| founder/verify | `otp` | `otp_code` | numeric 4-8 chars | yes |
| kc/register | `phone` | `phone` | normalize E.164 | yes |
| kc/register | `name` | `contact_name` | trim + collapse spaces | yes |
| kc/verify | `otp` | `otp_code` | numeric 4-8 chars | yes |

### Reactivation Guardrails

- Enforce OTP cooldown and expiry semantics from legacy behavior.
- Keep both `sms` and `whatsapp` support where OTP is involved.
- Keep tenant isolation intact on all founder/KC endpoints.
- Keep error envelope aligned with `ERROR_CONTRACTS.md`.
