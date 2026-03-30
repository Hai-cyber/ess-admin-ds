# Website Master Template V1

This folder contains the universal tenant website master source.

## Files

- `index.html`: single-file master template
- `tenant-source.example.json`: runtime-shaped example payload for build/publish
- `content-schema.example.json`: content contract for theme/demo sections
- `theme-presets.example.json`: theme-family and exact-theme content presets

## Control model

- `tenant.theme`: visual variant, expected values:
  - `theme-basic-a`
  - `theme-basic-b`
  - `theme-luxury-a`
  - `theme-luxury-b`
  - `theme-minimal-a`
  - `theme-minimal-b`
  - `theme-diner-a`
  - `theme-diner-b`
- `tenant.tier`: feature level, expected values:
  - `basic`
  - `plus`
  - `premium`

## Feature switches

- `.has-booking`
  - hidden for `basic`
  - visible for `plus` and `premium`
- `.has-member-portal`
  - visible only for `premium`
- `.has-shopping-cart`
  - hidden for `basic`
  - visible for `plus` and `premium`

## Current runtime mapping

These keys already exist in the current RestaurantOS runtime settings flow:

- `settings.site_template`
- `settings.site_tagline`
- `settings.site_hero_title`
- `settings.site_hero_subtitle`
- `settings.site_about_title`
- `settings.site_about_body`
- `settings.site_primary_cta_text`
- `settings.site_secondary_cta_text`
- `settings.site_accent_color`
- `settings.turnstile_site_key`
- `settings.booking_email`
- `settings.custom_domain`
- `settings.founder_program_label`
- `settings.founder_membership_type`
- `settings.founder_redirect_link`

These module flags already exist and can drive tier derivation if `tenant.tier` is omitted:

- `modules.module_booking_management`
- `modules.module_membership_management`
- `modules.module_marketing_management`
- `modules.module_digital_management`
- `modules.module_loyalty_rewards`

## Recommended publish pipeline

1. Load company + settings + module flags from D1.
2. Choose a content preset from `theme-presets.example.json` or generate a tenant-specific variant using `content-schema.example.json`.
3. Assemble a `tenant-source.json` payload in this shape.
4. Inject the payload into `index.html` at publish time.
5. Render a tenant-specific output file.
6. Store the output under an R2 prefix like `sites/{company_id}/current/index.html`.
7. Store images/assets under `sites/{company_id}/assets/...`.

## Runtime-connected form actions

- Booking form submits to `/api/bookings/create`
- Contact form submits to `/api/contact/create`
- Membership register submits to `/api/founder/register` or `/api/kc/register`
- Membership OTP verify submits to `/api/founder/verify` or `/api/kc/verify`

The template injects tenant metadata in two ways:

- Hidden fields: `tenant_id` and `company_id`
- Query string on preview/local hosts: `company_id` and `tenant_id`

This keeps localhost and `*.workers.dev` previews working immediately while custom-domain sites can rely on host-based tenant resolution.

## Important rule

Do not trust tenant identity from frontend form input alone.

- Hidden inputs may carry `tenant_id` for convenience.
- Backend must still resolve and validate tenant/company from host, publish manifest, or signed context.