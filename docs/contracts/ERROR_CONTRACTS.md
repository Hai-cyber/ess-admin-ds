# Error Contracts — Restaurant OS

**Purpose**: Standardized error codes and messages for all endpoints.

**Principle**: Every error is machine-readable and actionable.

---

## Error Response Format

### Standard shape

All errors return:

```json
HTTP 4xx or 5xx
{
  "ok": false,
  "code": "error_code",
  "message": "Human-readable message",
  "details": {
    "field": "specific_detail"
  }
}
```

### Example

```javascript
// Request
POST /api/bookings/create
name: ""
date: "2020-01-01"

// Response (400 Bad Request)
{
  "ok": false,
  "code": "validation_failed",
  "message": "Validation errors",
  "details": {
    "errors": [
      { "field": "name", "message": "Name is required" },
      { "field": "date", "message": "Date must be in future" }
    ]
  }
}
```

---

## Standard Error Codes

### Authentication & Authorization (4xx)

| Code | Status | Meaning | Recovery |
|------|--------|---------|----------|
| `auth_required` | 401 | PIN authentication required | Retry with PIN |
| `invalid_pin` | 401 | PIN incorrect | Verify PIN, retry |
| `permission_denied` | 403 | User lacks permission | Contact admin |
| `rate_limit_exceeded` | 429 | Too many attempts | Wait and retry |
| `token_expired` | 401 | Session/token expired | Re-authenticate |

---

### Validation (4xx)

| Code | Status | Meaning | Recovery |
|------|--------|---------|----------|
| `validation_failed` | 400 | Input validation failed | Fix fields, retry |
| `invalid_phone_format` | 400 | Phone not E.164 format | Use format: +49xxx |
| `invalid_date_format` | 400 | Date not YYYY-MM-DD | Use correct format |
| `date_in_past` | 400 | Booking date is past | Pick future date |
| `date_too_far` | 400 | Booking > 60 days future | Pick earlier date |
| `invalid_time_slot` | 400 | Time not within business hours | Pick valid time |
| `pax_out_of_range` | 400 | Guest count outside 1-12 | Pick 1-12 guests |
| `conflicting_booking` | 409 | Table/time already booked | Pick different slot |

---

### Resource Not Found (4xx)

| Code | Status | Meaning | Recovery |
|------|--------|---------|----------|
| `not_found` | 404 | Resource doesn't exist | Check ID, retry |
| `booking_not_found` | 404 | Booking ID doesn't exist | Check ID |
| `tenant_not_found` | 404 | Tenant ID doesn't exist | Check subdomain |
| `customer_not_found` | 404 | Customer phone not found | Create customer first |
| `table_not_found` | 404 | Table ID invalid | Check table number |

---

### Tenant/Security (400, 403)

| Code | Status | Meaning | Recovery |
|------|--------|---------|----------|
| `tenant_required` | 400 | Tenant context missing | Add subdomain or ?company_id= |
| `tenant_subdomain_not_found` | 404 | Subdomain not registered | Check spelling |
| `company_id_override_not_allowed` | 403 | Override attempted on prod | Use subdomain only |
| `no_tenant_context` | 400 | Cannot resolve tenant | Check host/subdomain |

---

### External Integration (502, 503)

| Code | Status | Meaning | Recovery |
|------|--------|---------|----------|
| `stripe_unavailable` | 503 | Stripe API down | Retry automatically |
| `twilio_unavailable` | 503 | Twilio API down | Queue for retry |
| `sendgrid_unavailable` | 503 | SendGrid API down | Queue for retry |
| `fiskaly_unavailable` | 503 | Fiskaly TSE unavailable | Retry with fallback |
| `payment_failed` | 402 | Card declined | Try different card |
| `charge_duplicate` | 409 | Duplicate charge attempt | Don't retry |

---

### Server Errors (5xx)

| Code | Status | Meaning | Recovery |
|------|--------|---------|----------|
| `database_error` | 500 | D1 database error | Retry (auto-handled) |
| `internal_error` | 500 | Unexpected server error | Contact support |
| `service_unavailable` | 503 | Worker overloaded | Retry (auto-handled) |
| `operation_timeout` | 504 | Request took too long | Retry |

---

## Error Code Directory

### Booking-specific errors

```javascript
// When creating booking
{
  "ok": false,
  "code": "conflict_time",
  "details": { "table_id": "table_5", "conflicting_booking": "booking_abc" }
}

// When confirming booking
{
  "ok": false,
  "code": "invalid_stage_transition",
  "details": { "current": "pending", "attempted": "done", "valid": ["confirmed", "cancelled"] }
}

// When cancelling
{
  "ok": false,
  "code": "booking_already_completed",
  "details": { "completed_at": "2026-03-22T20:30:00Z" }
}
```

### POS-specific errors

```javascript
// When creating order
{
  "ok": false,
  "code": "table_already_occupied",
  "details": { "table_id": "table_5", "current_order": "order_xyz" }
}

// When closing table
{
  "ok": false,
  "code": "unpaid_orders_exist",
  "details": { "pending_amount": 45.50, "orders": [ "order_1", "order_2" ] }
}
```

### Payment-specific errors

```javascript
// When charging
{
  "ok": false,
  "code": "payment_failed",
  "message": "Card declined",
  "details": {
    "stripe_error_code": "card_declined",
    "card_last_4": "4242",
    "decline_reason": "generic_decline"
  }
}

// When refunding
{
  "ok": false,
  "code": "refund_already_processed",
  "details": { "refund_id": "re_123", "original_charge": "ch_456" }
}
```

---

## HTTP Status Codes

Map error codes to HTTP status:

```javascript
const STATUS_CODES = {
  // 400 — Bad Request (client error, fixable)
  'validation_failed': 400,
  'invalid_phone_format': 400,
  'invalid_date_format': 400,
  'tenant_required': 400,
  
  // 401 — Unauthorized (auth required)
  'auth_required': 401,
  'invalid_pin': 401,
  'token_expired': 401,
  
  // 402 — Payment Required
  'payment_failed': 402,
  
  // 403 — Forbidden (auth succeeded, but denied)
  'permission_denied': 403,
  'company_id_override_not_allowed': 403,
  
  // 404 — Not Found
  'not_found': 404,
  'booking_not_found': 404,
  'tenant_not_found': 404,
  
  // 409 — Conflict (state conflict)
  'conflicting_booking': 409,
  'conflict_time': 409,
  'charge_duplicate': 409,
  
  // 429 — Too Many Requests
  'rate_limit_exceeded': 429,
  
  // 500 — Internal Server Error
  'database_error': 500,
  'internal_error': 500,
  
  // 503 — Service Unavailable
  'stripe_unavailable': 503,
  'twilio_unavailable': 503,
  'service_unavailable': 503
};
```

---

## Localization

Error messages support i18n:

```javascript
const ERROR_MESSAGES = {
  'validation_failed': {
    'en': 'Validation errors',
    'de': 'Validierungsfehler',
    'vi': 'Lỗi xác thực'
  },
  'invalid_pin': {
    'en': 'PIN incorrect',
    'de': 'PIN falsch',
    'vi': 'Mã PIN không đúng'
  }
};

function getErrorMessage(code, language = 'en') {
  return ERROR_MESSAGES[code]?.[language] ||
         ERROR_MESSAGES[code]?.['en'] ||
         code;
}
```

---

## Client Handling Examples

### JavaScript (FE)

```javascript
async function submitBooking(data) {
  const response = await fetch('/api/bookings/create', {
    method: 'POST',
    body: new FormData(data)
  });
  
  const result = await response.json();
  
  if (!result.ok) {
    // Show error to user
    switch (result.code) {
      case 'validation_failed':
        showValidationErrors(result.details.errors);
        break;
      case 'date_in_past':
        showAlert('Please pick a future date');
        break;
      case 'conflicting_booking':
        showAlert('This time slot is already booked');
        break;
      default:
        showAlert(result.message);
    }
    return;
  }
  
  // Handle success
  window.location.href = result.data.redirect_url;
}
```

### Python (Integration)

```python
import requests

try:
    response = requests.post(
        'https://api.restaurantos.app/api/bookings/create',
        data=booking_data,
        timeout=5
    )
    result = response.json()
    
    if not result.get('ok'):
        error_code = result.get('code')
        if error_code == 'conflicting_booking':
            # Retry with different time
            pass
        elif error_code in ['stripe_unavailable', 'payment_failed']:
            # Queue for retry
            queue_retry(booking_data)
        else:
            # Log error
            log_error(result)
except requests.Timeout:
    queue_retry(booking_data)
except Exception as e:
    log_error(e)
```

---

## Error Tracking & Monitoring

### Errors above threshold trigger alert

```
stripe_unavailable: > 10 errors/5min → ops alert
internal_error: > 5 errors/1min → ops alert
rate_limit_exceeded: > 1000/5min → DDoS suspected
```

### Error dashboard shows

- Error rate by code (past 24h)
- Top affected tenants
- Error correlation with external APIs
- Mitigation recommendations

---

## Error Budget

Track error budget per SLA:

```
API Availability SLA: 99.9%
= Max 43 seconds downtime/day

Current budget:
- Used this month: 250 seconds
- Remaining: 900 seconds
```

When error budget exhausted → auto-alert, escalate to on-call.

---

## Testing Errors

All error codes must have tests:

```javascript
test('POST /api/bookings/create rejects invalid phone', () => {
  const response = submitBooking({ phone: 'invalid' });
  expect(response.code).toBe('invalid_phone_format');
  expect(response.status).toBe(400);
});

test('POST /api/bookings/create returns conflict for booked time', () => {
  createExistingBooking({ table: 5, time: '19:00' });
  const response = submitBooking({ table: 5, time: '19:00' });
  expect(response.code).toBe('conflicting_booking');
  expect(response.status).toBe(409);
});

test('POST /api/bookings/create handles stripe timeout gracefully', () => {
  mockStripeTimeout();
  const response = submitBooking({ ... });
  expect(response.code).toBe('stripe_unavailable');
  expect(response.status).toBe(503);
});
```
