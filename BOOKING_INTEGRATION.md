# Booking Form Integration Guide

## Quick Start

### 1. URLs Available

| Purpose | URL | Type |
|---------|-----|------|
| Standalone page | `https://your-domain/reservierung` | HTML page |
| Embedded iframe | `https://your-domain/booking-form.html` | Lightweight form |
| API endpoint | `https://your-domain/api/bookings/create` | POST endpoint |
| Thank you page | `https://your-domain/danke-reservierung?id=X&date=Y&time=Z` | Confirmation page |

### 2. Odoo Embedding

**Option A: Embedded in Odoo Website**

Add to your Odoo website using a Button/Link to:
```
https://your-domain/reservierung
```

**Option B: Embedded in iframe**

In Odoo Custom HTML block or CRM Lead form:
```html
<iframe 
  src="https://your-domain/booking-form.html" 
  style="width:100%; height:750px; border:none; border-radius:12px;"
  scrolling="no">
</iframe>
```

**Option C: Popup/Modal**

```html
<button onclick="openBookingForm()">Tisch reservieren</button>

<script>
function openBookingForm() {
  window.open(
    'https://your-domain/reservierung',
    'booking',
    'width=800,height=900,scrollbars=yes'
  );
}
</script>
```

## Form Configuration

### Update Worker URL

Edit `/public/booking-form.html` line ~280:
```javascript
// Before:
const webhookUrl = 'https://your-worker-url.workers.dev/api/bookings/create?_t=' + Date.now();

// After:
const webhookUrl = 'https://esskultur.workers.dev/api/bookings/create?_t=' + Date.now();
```

### Customize Form Text

All German labels can be changed in booking-form.html:
- Title: `<h2 class="form-title">Reservierung</h2>`
- Subtitle: `<p class="form-subtitle">Tisch buchen</p>`
- Button text: `<button id="submit-btn" ...>RESERVIERUNG BESTÄTIGEN</button>`

### Customize Colors & Branding

Search for `#A54A7B` in booking-form.html and replace with your brand color:
```css
.form-title { color: #A54A7B; } /* Primary color */
.btn-submit { background-color: #A54A7B; } /* Button */
```

### Customize Time Slots

Edit `generateTimeSlots()` function (lines ~305):
```javascript
const startHour = 10;  // Open time
const endHour = 22;    // Close time
m += 15;               // Slot interval (15 min)
```

### Customize Area Options

Edit area dropdown in booking-form.html:
```html
<select id="area" name="area">
  <option value="indoor">Indoor</option>
  <option value="outdoor">Outdoor</option>
  <option value="garden">Garden</option>
  <option value="bar">Bar</option>
</select>
```

## API Response Format

### Success Response (200 OK)
```json
{
  "ok": true,
  "message": "Booking created successfully",
  "booking_id": "123e4567-e89b-12d3-a456-426614174000",
  "booking_datetime": "2024-12-25T19:00:00.000Z",
  "pax": 4,
  "area": "indoor",
  "phone": "+49123456789",
  "redirect_url": "/danke-reservierung?id=123e4567...&date=2024-12-25&time=19:00&pax=4"
}
```

### Error Response (400/403/500)
```json
{
  "ok": false,
  "error": "CAPTCHA verification failed"
}
```

### Error Messages

| Condition | HTTP | Message |
|-----------|------|---------|
| No CAPTCHA | 400 | "CAPTCHA verification failed" |
| Invalid CAPTCHA | 403 | "CAPTCHA verification failed" |
| Missing fields | 400 | "Missing required fields" |
| Server error | 500 | "Database error: ..." |

## Data Flow

```
1. User fills form in iframe/page
   ↓
2. JavaScript validates client-side
   ├─ Check Turnstile CAPTCHA
   ├─ Check honeypot (hp_confirm_data)
   └─ Check required fields
   ↓
3. POST /api/bookings/create
   ↓
4. Server validates Turnstile token with Cloudflare
   ↓
5. Extract form data:
   - name, phone, date, time, pax, area
   ↓
6. Database operations:
   ├─ Check if customer exists (by phone)
   ├─ Create customer if new
   ├─ Create booking record
   └─ Log action in booking_actions
   ↓
7. Return response with redirect_url
   ↓
8. JavaScript redirects to thank you page
   ↓
9. Thank you page displays booking summary
```

## Security Features

### 1. CAPTCHA Verification
- Client-side: Cloudflare Turnstile widget
- Server-side: Verify token with Cloudflare API
- Prevents: Bot form submissions

### 2. Honeypot Field
- Hidden field: `hp_confirm_data`
- If populated: Reject (only bots fill hidden fields)
- Prevents: Simple bot attacks

### 3. Rate Limiting (TODO)
- Per IP rate limiting needed
- Prevent spam booking attempts

### 4. Input Validation
- Phone number format check
- Date cannot be in past
- Pax: 1-12 only
- Area: from predefined list

### 5. Database Constraints
- Foreign key: booking→customer
- Not null: name, phone, booking_datetime
- Unique: booking_id

## Database Schema

When a booking is created, these tables are updated:

### `customers` table
```sql
INSERT INTO customers (id, name, phone, created_at)
VALUES (?, ?, ?, NOW())
```

### `bookings` table
```sql
INSERT INTO bookings (
  id, customer_id, contact_name, phone, guests_pax, 
  booking_datetime, area, stage, created_at, updated_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())
```

### `booking_actions` table
```sql
INSERT INTO booking_actions (
  id, booking_id, action_type, old_stage, new_stage, 
  changed_by, changed_at
)
VALUES (?, ?, 'created', NULL, 'pending', 'web_form', NOW())
```

## Testing

### Manual Testing

1. Open form: `https://your-domain/booking-form.html`
2. Fill fields:
   - Name: "Max Müller"
   - Phone: "+49123456789"
   - Date: Tomorrow
   - Time: 19:00
   - Pax: 4
   - Area: Indoor
3. Check "Ich stimme..." checkbox
4. Complete Turnstile CAPTCHA
5. Click "RESERVIERUNG BESTÄTIGEN"
6. Should redirect to thank you page

### API Testing

```bash
# Using curl (manual CAPTCHA token required)
curl -X POST https://your-domain/api/bookings/create \
  -F "name=Test Müller" \
  -F "phone=+49123456789" \
  -F "date=2024-12-25" \
  -F "time=19:00" \
  -F "pax=4" \
  -F "cf_token=YOUR_TURNSTILE_TOKEN"

# Expected response:
# {"ok":true,"booking_id":"...","redirect_url":"..."}
```

### Database Testing

```sql
-- Check latest booking
SELECT id, contact_name, phone, booking_datetime, stage, created_at
FROM bookings
ORDER BY created_at DESC
LIMIT 1;

-- Check customer was created
SELECT * FROM customers WHERE phone = '+49123456789';

-- Check booking action log
SELECT * FROM booking_actions WHERE booking_id = 'YOUR_BOOKING_ID';
```

## Customization Examples

### Example 1: Add Dietary Restrictions Field

1. Add to booking-form.html form:
```html
<div class="form-group full">
  <label>Diätetische Einschränkungen</label>
  <textarea id="dietary" name="dietary" placeholder="z.B. Vegetarisch, Glutenfrei..."></textarea>
</div>
```

2. Update API to store in bookings table (requires schema change):
```javascript
const dietary = (formData.get('dietary') || '').trim();
// Add to INSERT VALUES
```

### Example 2: Add Email Field

1. Add to form:
```html
<div class="form-group full">
  <label>Email</label>
  <input type="email" id="email" name="email" placeholder="your@email.com">
</div>
```

2. Store in customers table:
```javascript
await env.DB.prepare(
  `UPDATE customers SET email = ? WHERE id = ?`
).bind(formData.get('email'), customer.id).run();
```

### Example 3: Add Booking Confirmation SMS

1. Update API endpoint to call Twilio after booking creation:
```javascript
// After booking is created, before returning response:
await sendSMS(phone, `Ihre Reservierung für ${date} um ${time} Uhr ist bestätigt.`);

function sendSMS(phone, message) {
  // Call Twilio API
}
```

## Troubleshooting

### Form not loading
- Check browser console (F12)
- Verify CORS is enabled for form URL
- Check iframe `src` URL is correct

### Form submits but nothing happens
- Check Network tab in DevTools
- Verify worker URL is correct in form
- Check Turnstile token is being generated

### Redirect doesn't work
- Check if form is in iframe (parent window redirect)
- Verify thank you page URL is accessible
- Check browser console for errors

### Booking not appearing in D1
- Check `/api/health` endpoint works
- Run database init script
- Verify D1 binding in wrangler.jsonc

### CAPTCHA failures
- Verify sitekey matches environment
- Check IP is not blocked by Cloudflare
- Test Turnstile separately

## Monitoring & Analytics

### Check Booking Creation Rate
```sql
SELECT DATE(created_at) as date, COUNT(*) as bookings
FROM bookings
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Find Failed Submissions (Pending Bookings)
```sql
SELECT * FROM bookings WHERE stage = 'pending'
ORDER BY created_at DESC
LIMIT 20;
```

### Top Booking Times
```sql
SELECT EXTRACT(HOUR FROM booking_datetime) as hour, COUNT(*) as count
FROM bookings
GROUP BY hour
ORDER BY count DESC;
```

### Customer Repeat Bookings
```sql
SELECT c.phone, c.name, COUNT(b.id) as booking_count
FROM customers c
LEFT JOIN bookings b ON c.id = b.customer_id
GROUP BY c.id
HAVING booking_count > 1
ORDER BY booking_count DESC;
```

## Next Steps

After form is working:

1. ✅ Deploy form to production
2. ⏳ Implement Odoo sync (see ODOO_SYNC.md)
3. ⏳ Implement Telegram notifications (see TELEGRAM_INTEGRATION.md)
4. ⏳ Add SMS confirmation (see SMS_INTEGRATION.md)
5. ⏳ Set up rate limiting
6. ⏳ Create admin dashboard to manage bookings

## Support & Questions

For issues:
1. Check this guide and BOOKING_FORM_SETUP.md
2. Check browser console for errors
3. Check Cloudflare Workers logs: `wrangler tail`
4. Check D1 database for records: `wrangler d1 execute esskultur-admin --command "SELECT * FROM bookings LIMIT 10;"`
