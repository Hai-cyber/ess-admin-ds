# Founder and Booking Form Query Variables

This guide documents the currently deployed query-variable behavior for:

- `GET /founder`
- `GET /founder-form`
- `GET /founder-form.html`
- `GET /kc`
- `GET /kc-form`
- `GET /kc-form.html`
- `GET /booking-form.html`
- `GET /booking-form`

It also explains KC mode and hidden optional email support.

## Dynamic defaults from settings

The founder/KC form can now auto-apply defaults from tenant operational settings (without hardcoding per embed).

Supported setting keys:

- `founder_program_label`
- `kc_program_label`
- `founder_membership_type`
- `kc_membership_type`
- `founder_redirect_link`
- `kc_redirect_link`
- `founder_terms_link`
- `kc_terms_link`
- `privacy_link`

When these are set and the corresponding query vars are missing, `GET /founder*` injects them via a redirect URL so frontend logic receives explicit query values.

KC default redirect path is now `/colleague-club` (instead of `/welcome-founder`) when no override is supplied.

## Module taxonomy (reorganized)

Current platform module lines are:

- `module_membership_management`: Community & Membership (Founder/KC forms, OTP, member lifecycle automation).
- `module_marketing_management`: Marketing management (social/SMS/email retention workflows).
- `module_contact_crm`: CRM & Odoo operations (contact/CRM flows, menu/product operational workflows).
- `module_loyalty_rewards`: Advanced loyalty & rewards mechanics.
- `module_booking_management`: Booking form, stage automation, booking board + staff app workflows.
- `module_digital_management`: SEO, hosting, and domain management.
- `module_telegram_notifications`: Telegram board notifications.

Legacy compatibility:

- `module_founder_program` is retained as a legacy alias and follows `module_membership_management`.

Fallback behavior:

- If `module_membership_management` is disabled, founder/KC routes and APIs return a disabled response and redirect/fallback to `standard_contact_link` when available.

## KC compatibility aliases

Legacy KC embeds can continue using these paths:

- `GET /kc`
- `GET /kc-form`
- `GET /kc-form.html`

These aliases redirect to the founder form and automatically inject `program=kc` when it is missing.

Legacy KC API aliases are also supported:

- `POST /api/kc/register` → `POST /api/founder/register`
- `POST /api/kc/resend-otp` → `POST /api/founder/resend-otp`
- `POST /api/kc/verify` → `POST /api/founder/verify`

The register alias accepts both `multipart/form-data` and `application/json` payloads.

## Founder form variables

Supported query variables on the founder form:

| Variable | Example | Default | Purpose |
|---|---|---|---|
| `lang` | `en` | Browser language (`de` fallback preference) | Forces UI language (`de` or `en`). |
| `program` | `kc` | `founder` | Switches between Founder and KC presets. |
| `program_label` | `Kollegensclub` | Auto label by `program` | Replaces visible `Founder` wording in UI messages/headings. |
| `membership_type` | `KC` | `Founder` for founder mode, `KC` for kc mode | Overrides hidden `x_studio_membership_type`. |
| `terms_url` | `https://example.com/terms` | `/founderpass-terms-conditions` | Overrides terms link. |
| `privacy_url` | `https://example.com/privacy` | `/privacy` | Overrides privacy link. |
| `email` | `guest@example.com` | empty | Prefills hidden optional email field (`email`). |
| `redirect` | `https://example.com/welcome` | `https://www.quan-esskultur.de/welcome-founder` | Redirect target after successful OTP verification. |

### Program presets

When `program=founder` (default):

- `x_studio_membership_type = Founder`
- `x_studio_founder_terms_accepted = yes`
- `x_studio_kc_terms_accepted = no`
- `x_studio_notes = Founder Form Registration`

When `program=kc`:

- `x_studio_membership_type = KC`
- `x_studio_founder_terms_accepted = no`
- `x_studio_kc_terms_accepted = yes`
- `x_studio_notes = KC Form Registration`

If `membership_type` is provided, it overrides the preset membership type.

## Founder language resolution

The founder form resolves language in this order:

1. `?lang=` query variable.
2. Browser language (`navigator.languages[0]` or `navigator.language`).
3. Fallback to English if not German.

The form also maps many backend German error messages to English for `lang=en` users.

## Founder iframe example (KC mode)

```html
<iframe
  id="founder-form"
  src="https://<your-worker-domain>/founder?program=kc&program_label=Kollegensclub&membership_type=KC&lang=de&terms_url=https%3A%2F%2Fwww.example.com%2Fkc-terms&privacy_url=https%3A%2F%2Fwww.example.com%2Fprivacy&redirect=https%3A%2F%2Fwww.example.com%2Fwelcome-kc"
  style="width:100%;max-width:640px;height:760px;border:0;display:block;margin:0 auto;background:transparent;"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>
```

Note: URL-encode `terms_url`, `privacy_url`, and `redirect` values.

## Booking form variables

Supported query variables on the booking form:

| Variable | Example | Default | Purpose |
|---|---|---|---|
| `lang` | `en` | Browser language (`de` if browser starts with `de`) | Forces booking form language (`de` or `en`). |
| `email` | `guest@example.com` | empty | Prefills hidden optional email field (`email`). |

The booking form resolves query variables from:

1. Its own URL.
2. Parent frame URL.
3. Grandparent frame URL.

This is required for nested iframe/srcdoc embedding layouts.

## Booking iframe example

```html
<iframe
  id="booking-form"
  src="https://<your-worker-domain>/booking-form.html?lang=en&email=guest%40example.com"
  style="width:100%;height:760px;border:0;display:block;"
  loading="lazy"
></iframe>
```

## Backend behavior that pairs with hidden email

- `POST /api/founder/register` accepts optional `email`.
- `POST /api/bookings/create` accepts optional `email`.
- `POST /api/test/booking/create` accepts optional `email`.

Email is validated with a basic format check. Invalid non-empty emails are rejected.

When valid, email is persisted to D1:

- Founder flow writes customer email (`customers.email`) while preserving existing email if new email is blank.
- Booking flow writes booking email (`bookings.email`).

## OTP channel note

Current project default is SMS-first OTP (`FOUNDER_OTP_CHANNELS=sms`).

If you need WhatsApp + SMS fallback behavior, set:

```bash
FOUNDER_OTP_CHANNELS=whatsapp,sms
```
