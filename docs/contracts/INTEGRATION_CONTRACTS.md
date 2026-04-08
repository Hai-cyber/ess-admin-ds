# Integration Contracts — Restaurant OS

**Purpose**: Define how external systems connect to Restaurant OS.

**Principle**: All integrations are optional and must not block core operations.

---

## Integration Categories

1. **Payment**: Stripe, PayPal (required for Phase 3)
2. **SMS/Messaging**: Twilio, WhatsApp (required for Phase 1)
3. **Email**: SendGrid, mailgun (required for Phase 2+)
4. **TSE**: Fiskaly (required for Germany, Phase 3)
5. **Legacy**: Odoo API (optional, being removed)
6. **Analytics**: (optional, Phase 5)

---

## Payment Integration Contract

### Stripe

**When**: Enabled on tenant signup (Phase 3)

**Environment variables**:
```
STRIPE_API_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Endpoints used**:

```
POST https://api.stripe.com/v1/payment_intents
Create payment intent for order

BODY:
{
  "amount": 2850,  // cents
  "currency": "eur",
  "payment_method": "pm_...",
  "confirm": true
}

RESPONSE:
{
  "id": "pi_12345",
  "status": "succeeded",
  "amount": 2850,
  "currency": "eur"
}
```

**Error handling**:
```javascript
try {
  const payment = await stripe.paymentIntents.create({...});
  // Save payment.id to payments table
} catch (err) {
  if (err.code === 'card_declined') {
    return { ok: false, code: 'payment_failed', message: 'Card declined' };
  }
  // Retry logic: exponential backoff queue
}
```

**Fallback**: If Stripe unavailable (rare), staff can take cash payment manually.

---

## SMS/Messaging Integration Contract

### Twilio

**When**: Booking confirmed, arrival reminder, access codes

**Environment variables**:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxx
TWILIO_AUTH_TOKEN=your_token
TWILIO_FROM_NUMBER=+4912345678
```

**Endpoints used**:

```
POST https://api.twilio.com/2010-04-01/Accounts/{ACCOUNT_SID}/Messages
Send SMS

BODY:
{
  "From": "+4912345678",
  "To": "+49123456789",
  "Body": "Your booking for 25.12 at 19:00 confirmed. Code: XXXXX"
}

RESPONSE:
{
  "sid": "SM123456",
  "status": "queued"  // or "delivered", "failed"
}
```

**Retry logic**: D1 queue stores failed messages, retries every 5min for 24h.

**Error codes**:
```
21211 — Invalid phone number
21401 — Account suspended
20003 — Internal error (retry)
```

## Operator Review Notification Contract

### Telegram

**When**: Moderation queue events for subdomain review, website publish review, abuse escalation, or emergency suspension

**Purpose**: Notify platform operators that manual review or emergency action is required

**Environment variables**:
```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_REVIEW_CHAT_ID=...
```

**Endpoint used**:

```
POST https://api.telegram.org/bot{BOT_TOKEN}/sendMessage
```

**Payload shape**:

```json
{
  "chat_id": "-1001234567890",
  "text": "Review required: tenant website publish\nTenant: company_123 / Roma Trattoria\nHost: roma.gooddining.app\nDecision: review\nRisk score: 67\nReasons: suspicious_external_link, political_sensitive_copy\nPreview: https://platform.example/review/preview/abc\nAdmin: https://platform.example/admin/moderation/reviews/review_abc",
  "disable_web_page_preview": true
}
```

**Required event fields**:

- moderation record id
- company id
- tenant display name
- host or subdomain
- decision (`review`, `block`, `suspended`)
- reason codes
- risk score
- preview link
- admin decision link

**Delivery rules**:

- Telegram is notification-only in the first iteration
- final approve or reject action must write through the platform backend
- retry transient Telegram failures with bounded backoff
- moderation decision must not depend on Telegram delivery success

**Failure handling**:

```javascript
try {
  await sendTelegramReviewAlert(event);
} catch (error) {
  console.error('telegram_review_alert_failed', {
    review_id: event.review_id,
    error: error.message
  });
  // Never unblock a blocked publish because Telegram failed.
  // Persist the review and surface it in operator admin.
}
```

**Security rules**:

- never expose Telegram bot token to browser clients
- only send internal review links intended for operator access
- verify callback signatures if interactive Telegram buttons are added later

---

## Email Integration Contract

### SendGrid (Phase 2+)

**When**: Campaign emails, booking confirmations

**Environment variables**:
```
SENDGRID_API_KEY=SG_...
SENDGRID_FROM_EMAIL=noreply@restaurantos.app
```

**Endpoints used**:

```
POST https://api.sendgrid.com/v3/mail/send
Send transactional email

BODY:
{
  "personalizations": [{
    "to": [{ "email": "guest@example.com" }],
    "dynamic_template_data": {
      "booking_id": "123",
      "booking_date": "2026-03-22"
    }
  }],
  "from": { "email": "noreply@restaurantos.app" },
  "template_id": "d-123456"
}

RESPONSE:
{
  "message_id": "<msg_id@sendgrid.net>"
}
```

---

## TSE Integration Contract (Germany)

### Fiskaly

**When**: Payment processed (Germany only, Phase 3)

**Environment variables**:
```
FISKALY_API_KEY=...
FISKALY_CLIENT_ID=...
FISKALY_TSE_ID=...
```

**Endpoints used**:

```
POST https://api.fiskaly.com/v0/transactions
Create TSE transaction (signed receipt)

BODY:
{
  "tse_id": "...",
  "state": "ACTIVE",
  "receipt": {
    "items": [
      { "name": "Schnitzel", "price": 1850, "vat_rate": 1900, "quantity": 1 }
    ],
    "payment_methods": ["CASH"],
    "total": 1850
  }
}

RESPONSE:
{
  "transaction_number": "123",
  "signature": "<base64_signature>",
  "receipt": { ... }
}
```

**Compliance**: Every payment receipt must include TSE signature for German law.

---

## Legacy: Odoo Integration Contract (Being phased out)

**Status**: Optional mirror, being removed (Phase 4)

**When**: Booking created (currently sends webhook)

**What gets synced**:
```
Booking → Odoo CRM Lead
├─ contact_name → Lead name
├─ phone → Phone
├─ guests_pax → Description
└─ booking_datetime → Expected close date
```

**Webhook format**:
```javascript
POST {ODOO_WEBHOOK_URL}
{
  "event": "booking.created",
  "booking_id": "booking_abc",
  "phone": "+49123456789",
  "name": "Max Müller",
  "date": "2026-03-22",
  "time": "19:00",
  "pax": 4
}
```

**Error handling**: If webhook fails, queue for retry. Never block booking creation.

**Phase 4 action**: Remove this webhook, Odoo becomes optional only.

---

## Analytics Integration Contract (Phase 5+)

### Google Analytics 4

**Events sent**:
```
event: booking_created
parameters:
  - restaurant_id
  - guests_pax
  - area
  
event: payment_processed
parameters:
  - amount
  - currency
  - method
```

**Endpoint**: Google Analytics Measurement Protocol

---

## External API Error Handling

### Universal pattern

```javascript
async function callExternalAPI(integration, payload) {
  try {
    // 1. Call API with timeout (5s)
    const response = await fetch(url, {
      timeout: 5000,  // 5 seconds max
      ...payload
    });
    
    if (!response.ok) {
      // 2. Check if retryable
      if (response.status >= 500) {
        // Queue for retry
        await queueRetry(integration, payload, response.status);
        return { ok: false, code: 'temporary_failure' };
      }
      
      if (response.status === 429) {
        // Rate limited
        const retryAfter = response.headers.get('Retry-After');
        await queueRetry(integration, payload, 429, retryAfter);
        return { ok: false, code: 'rate_limited' };
      }
      
      // 3. Non-retryable error
      return { ok: false, code: 'permanent_failure' };
    }
    
    // 4. Success
    return { ok: true, data: await response.json() };
    
  } catch (err) {
    // Network timeout or error
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      await queueRetry(integration, payload);
    }
    return { ok: false, code: 'network_error' };
  }
}
```

### Retry queue logic

```
Attempt 1: Immediate failure
  ↓ Wait 5 seconds
Attempt 2: Fail (if still failing)
  ↓ Wait 1 minute
Attempt 3: Fail
  ↓ Wait 5 minutes
...
Attempt 10+: Give up, alert admin
```

---

## Graceful Degradation

### Core operations don't require integrations

| Operation | Without Stripe | Without Twilio | Without Sendgrid |
|-----------|---|---|---|
| Create booking | ✅ Works (no payment) | ❌ Blocks (SMS confirmation) | ✅ Works (no email) |
| Confirm booking | ✅ Works | ⚠️ Manual SMS | ✅ Works |
| Take payment | ❌ Cash only | ✅ Works | ✅ Works |
| Send receipt | ✅ PDF only | ✅ Print | ⚠️ Manual email |

**Rule**: Bookings work without any integration. SMS/email are "nice-to-have".

---

## Integration Testing

### Mock integrations (test environment)

```javascript
// test setup
env.STRIPE_MODE = 'mock';
env.TWILIO_MODE = 'mock';

// Production test cards
const testCards = {
  success: '4242 4242 4242 4242',
  decline: '4000 0000 0000 0002',
  require_auth: '4000 0025 0000 3155'
};
```

### Real integration tests (staging)

Run against real Stripe test account, real Twilio test account.

---

## Integration Monitoring

### Alerts (when integration fails)

```
🚨 Stripe API unavailable
   → Bookings still work (no charge yet)
   → Alert payment_team@restaurantos.app
   → Retry every 5 minutes
   → Auto-resolve when service recovers

🚨 Twilio quota exceeded
   → SMS not sent
   → Queue for retry
   → Alert ops_team@restaurantos.app
```

### Metrics tracked

```
stripe_api_latency: < 3s target
stripe_success_rate: > 99%
twilio_delivery_rate: > 95%
twilio_latency: < 2s target
fiskaly_uptime: > 99.9%
```

---

## Integration Onboarding

### For new restaurant (Phase 3):

1. **Stripe**: Connect Stripe account (OAuth)
   - Redirect to Stripe Connect
   - Store connected account ID
   - Test with small charge

2. **Twilio**: Enter account SID + auth token
   - Verify with test SMS
   - Save to encrypted settings

3. **Fiskaly** (if Germany): Optional
   - Enter API key
   - Test TSE signing

4. **Verification**: Run integration test
   - Fake booking creation
   - Confirm SMS received
   - Charge test card (€1.00)
   - Refund test charge
   - ✅ All integrations working

---

## Dependency Pinning

All external SDKs pinned in package.json:

```json
{
  "dependencies": {
    "stripe": "14.15.0",
    "twilio": "4.10.0",
    "@sendgrid/mail": "8.0.0"
  }
}
```

**Why**: Prevent breaking changes in external libraries.

**Update policy**: Review security updates monthly, update on patch/minor versions.
