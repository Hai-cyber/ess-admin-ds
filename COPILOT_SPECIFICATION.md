# AI Copilot Specification — ESSKULTUR Restaurant OS

## Purpose

The AI Copilot is NOT a general chatbot. It is a **process-bound guide** that helps users move through the system without confusion or errors.

**Design principle**: Real-time contextual assistance, rule-based first, LLM for explanation only.

---

## Core Rules

### What AI CAN do

✅ Read:
- Current system state (which modules are enabled, config status)
- Current user step (setup wizard step, page visited)
- Tenant configuration (business hours, areas, staff count)

✅ Suggest:
- Next step based on workflow
- Missing required fields or config
- Common mistakes to avoid
- Required actions before proceeding

✅ Explain:
- Why a field is needed
- How a feature works
- Error messages in plain language

✅ Validate:
- Detect incomplete setup
- Warn about conflicts (e.g., booking hours outside business hours)
- Suggest optimizations

---

### What AI CANNOT do

❌ Chatobox mode
❌ General questions unrelated to setup/operations
❌ Self-suy diễn (making guesses)
❌ Generate content outside scope (copy, marketing text, code)
❌ Answer about Odoo, Make.com, or external systems
❌ Make decisions on behalf of user (always suggest, never enforce)

---

## Context Engine

### Input (from current page/module)

```json
{
  "tenant_id": "tenant_abc123",
  "user_role": "admin",
  "current_module": "setup_wizard",
  "current_step": 3,
  "step_name": "configure_payment",
  "system_state": {
    "website_created": true,
    "staff_added": 2,
    "payment_enabled": false,
    "tse_enabled": false,
    "bookings_today": 5
  },
  "user_action": "clicked_next_without_enabling_stripe",
  "config_status": {
    "restaurant_info": "✅ complete",
    "website": "✅ complete",
    "payment": "⏳ incomplete",
    "staff": "⏳ 1 user (need min 2)",
    "booking_hours": "⏳ not set"
  }
}
```

---

### Output (action + guidance)

```json
{
  "action": "warn_and_suggest",
  "severity": "warning",
  "message": "Payment not enabled yet",
  "details": "You need to connect Stripe before launching. Without it, customers can't pay online.",
  "next_steps": [
    "1. Click 'Connect Stripe' (2 min)",
    "2. Authorize ESSKULTUR app in your Stripe account",
    "3. Your connection is live"
  ],
  "help_url": "/help/payment-setup",
  "allow_skip": false
}
```

---

## Workflow: Customer Onboarding

### Step 1: Restaurant info

**System state**: Tenant created, admin user logged in

**Copilot input**:
```json
{ "current_step": 1, "step_name": "restaurant_info" }
```

**Copilot output**:
```
✔️ Step 1: Restaurant Info

Fill these fields (required):
- Restaurant name
- Address
- Phone
- Business hours (Mon-Sun, open-close)

Why? → Staff and guests need to know when you're open and where to call.

💡 Tip: Add a WhatsApp number — guests can reach you faster.
```

---

### Step 2: Website builder

**System state**: Restaurant info complete

**Copilot input**:
```json
{
  "current_step": 2,
  "step_name": "website",
  "config_status": { "website": "incomplete" }
}
```

**Copilot output**:
```
✔️ Step 2: Website

Choose a template and add:
- Logo (optional)
- Menu (optional)
- Photos (optional)
- Contact info (auto-filled)

Preview looks good? → Next step: Payment

⏭️ Can skip for now and setup later.
```

---

### Step 3: Payment (Stripe)

**System state**: Website created, payment not enabled

**Copilot input**:
```json
{
  "current_step": 3,
  "step_name": "payment",
  "user_action": "skipped_without_stripe",
  "config_status": { "payment": "incomplete" }
}
```

**Copilot output**:
```
⚠️ Payment not ready

Stripe is needed for:
- Online bookings
- Online shop (if enabled later)
- Guest payment links

Setup takes 5 minutes:
1. Click "Connect Stripe"
2. Authorize in Stripe dashboard
3. Done — you're live

Skip for now? You can add later, but bookings won't have online payment.
```

---

### Step 4: Staff setup

**System state**: 1 staff member (admin), more needed

**Copilot input**:
```json
{
  "current_step": 4,
  "step_name": "staff",
  "system_state": { "staff_added": 1 }
}
```

**Copilot output**:
```
✔️ Step 4: Add Staff

Add staff who will use the:
- Booking app (hostess, manager)
- POS (bartender, waiter)
- Admin panel (manager)

Each staff gets a PIN (no password needed).

Add at least 1 more staff to test:
→ Name: [        ]
→ Role: [hostess ▼]
→ PIN: [   ▼ generate ]
→ Add another
```

---

### Step 5: Configure areas (tables)

**System state**: Staff added, areas not configured

**Copilot input**:
```json
{
  "current_step": 5,
  "step_name": "areas",
  "user_action": "viewing_areas_page"
}
```

**Copilot output**:
```
✔️ Step 5: Configure Areas

Areas = zones where guests sit (indoor, outdoor, bar, etc.)

Add for each zone:
- Name (e.g., "Indoor seating")
- Capacity (max guests)
- Allow reservations? (yes/no)

For now, create:
→ "Indoor" - capacity 30
→ "Outdoor" - capacity 15

You can add/edit areas anytime.
```

---

### Step 6: Go live

**System state**: All required fields complete

**Copilot input**:
```json
{
  "current_step": 6,
  "config_status": {
    "restaurant_info": "✅",
    "website": "✅ (can skip)",
    "payment": "✅",
    "staff": "✅",
    "areas": "✅"
  }
}
```

**Copilot output**:
```
🎉 Ready to go live!

Verification:
✅ Restaurant info
✅ Payment enabled
✅ 2 staff members
✅ 2 areas configured

Next:
1. Test the staff app with PIN
2. Create a test booking
3. Start accepting real bookings

Support: support@restaurantos.app
```

---

## Runtime: Daily Operations

### Scenario 1: Staff opens POS

**Copilot shows**:
```
👋 Good morning!

Today's schedule:
- 12 bookings (11:30 - 22:00)
- 4 staff members logged in
- 8 tables available

Quick actions:
[📋 Bookings] [🛒 New Order] [💳 Payments]

Need help? Type 'help' or tap [?]
```

---

### Scenario 2: Booking hour approaching

**Copilot alert** (if enabled):
```
⏰ Next booking in 15 minutes

Table 5 (Indoor)
- Party of 4
- Name: Anna K.
- Phone: +49 xxx

Confirm arrival or reschedule?
```

---

### Scenario 3: Error during payment

**User tries to charge card, gets error**

**Copilot output**:
```
❌ Payment failed

Possible reasons:
1. Card expired (most common)
2. Insufficient funds
3. Internet connection issue

Next:
→ Try again (card was charged if first attempt went through)
→ Use a different payment method
→ Call the customer to confirm card details

Need more help? Contact support.
```

---

## Implementation

### Where AI lives

```
/ai/copilot
├── engine.js        -- Core logic (rule-based)
├── context.js       -- Read system state
├── workflows.json   -- Step definitions for each module
├── messages.json    -- Predefined copy (I18n ready)
└── llm.js           -- Optional LLM (explain only)
```

### Worker endpoint

```javascript
POST /api/ai/copilot
{
  "tenant_id": "...",
  "context": { /* current state */ },
  "user_action": "clicked_next|viewing_page|error_occurred"
}

Response:
{
  "action": "suggest|warn|block",
  "message": "...",
  "next_steps": [ "...", "..." ]
}
```

### Decision tree example (Rule-based)

```javascript
if (step === 'payment' && payment_status === 'incomplete') {
  return {
    action: 'warn_and_suggest',
    message: 'Payment not enabled. Connect Stripe (5 min).',
    next_steps: [
      'Click "Connect Stripe"',
      'Authorize in Stripe dashboard',
      'Done'
    ]
  };
}
```

---

## Localization

Copilot messages support i18n:

```json
{
  "step_payment_warning": {
    "de": "Zahlung nicht aktiviert. ...",
    "en": "Payment not enabled. ...",
    "vi": "Thanh toán chưa được bật. ..."
  }
}
```

---

## Metrics & Improvement

Track:
- % of users who complete onboarding with copilot help
- Time to go live
- Support ticket reduction
- Feature adoption rate

Iterate:
- Monthly: add new workflow patterns
- Quarterly: analyze support tickets and add copilot rules
- Annually: LLM integration for complex scenarios

---

## Constraints

- **Latency**: Copilot response < 100ms (sync, no network calls)
- **Offline**: Can work offline (cached rules)
- **Privacy**: No data sent to external LLM unless explicitly enabled
- **Compliance**: No personal data in copilot context (name, phone, etc.)
