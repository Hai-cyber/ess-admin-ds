# Modules Reference

## Module Configuration

Stored in `settings` table per `company_id`. Each module is a boolean toggle (enabled/disabled).

## Active Modules

### module_membership_management

**Status:** ✅ Implemented & Fully Tested

**Description:** Community & membership lifecycle (Founder/KC opt-in, OTP, verification, member status tracking).

**Routes:**
- `/founder` (GET/POST form + register)
- `/api/founder/register`, `/api/kc/register` (POST)
- `/api/founder/verify`, `/api/kc/verify` (POST)
- `/api/founder/resend-otp`, `/api/kc/resend-otp` (POST)
- `/webhooks/twilio/founder-otp` (POST)

**When disabled:**
- Founder form redirects to `standard_contact_link`
- OTP flows return 403 with fallback link

**Related configs:**
- `founder_program_label`, `kc_program_label`
- `founder_membership_type`, `kc_membership_type`
- `founder_redirect_link`, `kc_redirect_link`
- `founder_terms_link`, `kc_terms_link`
- `FOUNDER_OTP_CHANNELS` (whatsapp,sms)
- `FOUNDER_TEST_EXCEPTION_PHONES` (E.164 list)

---

### module_booking_management

**Status:** ✅ Implemented & Fully Tested

**Description:** Booking form, stage automation, stage webhooks, staff booking app integration.

**Routes:**
- `/booking-form.html` (GET form UI)
- `/reservierung` (GET alias)
- `/api/bookings/create` (POST + SSE notify)
- `/api/bookings` (GET read company bookings)
- `/api/bookings/:id/stage` (POST update stage + SSE + webhook)
- `/api/test/booking/create` (POST dev helper)

**When disabled:**
- Booking form page returns 404
- `/api/bookings/create` returns 403

**Related configs:**
- `area_capacity_indoor`, `area_capacity_outdoor`, `area_capacity_garden`, `area_capacity_bar`
- `business_hours_open`, `business_hours_close`, `closed_weekday`
- `min_booking_advance_min`, `default_booking_duration`
- `booking_email`, `ODOO_BOOKING_STAGE_WEBHOOK`

---

### module_contact_crm

**Status:** ✅ Implemented

**Description:** Contact inbox & CRM/Odoo operational workflows (customer/product data sync).

**Routes:**
- `/api/contacts` (GET list, scoped by company)
- `/api/contacts/:id/push` (POST mark processed)

**Related configs:**
- None currently (future: Odoo sync webhooks)

---

### module_marketing_management

**Status:** ⚠️ Planned (Not Implemented)

**Description:** Social media workflows, SMS/email campaigns, retention automation.

**Would enable:**
- Social media brand presence management
- Campaign content workflow
- Email/SMS send operations

**Related configs:**
- `social_instagram_url`, `social_facebook_url`, `social_tiktok_url`, `social_google_business_url`

---

### module_loyalty_rewards

**Status:** ⚠️ Planned (Not Implemented)

**Description:** Advanced loyalty mechanics (benefit tiers, automation, reward tracking).

---

### module_digital_management

**Status:** ⚠️ Planned (Not Implemented)

**Description:** SEO, hosting, domain, digital presence operations.

---

### module_telegram_notifications

**Status:** ⚠️ Planned (Not Implemented)

**Description:** Telegram notifications for booking board and staff alerts.

---

## Legacy Alias

### module_founder_program

**Deprecated in favor of:** `module_membership_management`

**Behavior:** At runtime, `module_founder_program` is aliased to `module_membership_management` for backward compatibility.

**Code:**
```js
// In src/index.js
const MODULE_RUNTIME_ALIASES = {
  module_founder_program: 'module_membership_management'
};

// Query any of: module_founder_program OR module_membership_management
// Both resolve to the same feature gate
```

---

## Configuration Hierarchy

Modules are resolved via a **3-level hierarchy**:

1. **Company setting** (`settings` table, `company_id` column)
2. **Organization default** (`organization_settings` table, `organization_id` column)
3. **Hardcoded default** (in `DEFAULT_MODULE_SETTINGS`)

```js
const DEFAULT_MODULE_SETTINGS = {
  module_membership_management: true,
  module_marketing_management: false,
  module_booking_management: true,
  module_digital_management: false,
  module_loyalty_rewards: false,
  module_contact_crm: true,
  module_telegram_notifications: false,
  module_founder_program: true
};
```

---

## Gating Pattern

All tenant-required routes follow this pattern:

```js
return runTenantRoute(async () => {
  const companyId = activeCompanyId;
  const moduleEnabled = await isModuleEnabled(env, companyId, 'module_booking_management');

  if (!moduleEnabled) {
    return Response.json({ ok: false, error: "Module is disabled" }, { status: 403 });
  }

  // Proceed with feature
});
```

**Why:** Module check happens AFTER guard (no unscoped data leaks).

---

## Code References

- **Module settings**: [src/index.js:52-68](../../src/index.js#L52)
- **Module keys**: [src/index.js:71-124](../../src/index.js#L71)
- **Runtime aliases**: [src/index.js:116-118](../../src/index.js#L116)
- **Query function**: [src/index.js:398-420](../../src/index.js#L398)
- **UI labels** (admin): [public/admin.html:887-920](../../public/admin.html#L887)
