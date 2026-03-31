# Website Master Template V1

This folder contains the universal tenant website master source.

This system follows a fixed-skin model:

- we maintain a bounded set of prebuilt skins
- tenants copy a preset and edit presentation content freely
- tenants do not change the page architecture
- all skins render the same normalized payload contract

The source-of-truth contract for this model is in `docs/contracts/WEBSITE_TEMPLATE_CONTRACTS.md`.

The pre-publish validation gate is in `docs/contracts/WEBSITE_PUBLISH_VALIDATION.md` and can be run with `npm run validate:website-template`.

The preview now behaves like a multi-page tenant website and the folder now includes real page files:

- `#home`: landing page and homepage signatures
- `#menu`: menu feed and menu categories
- `#reservation`: reservation form and membership upsell blocks
- `#about`: story and market-fit content
- `#contact`: contact details and contact form
- `#career`: hiring page and open-role cards
- `#founder`: premium membership and founder flow

Page files exposed in this folder:

- `index.html`
- `menu.html`
- `reservation.html`
- `about.html`
- `contact.html`
- `career.html`
- `founder.html`

The top navigation now links between those actual files, while theme, tier, labels, logo, text, images, and background presentation controls are expected to come from the backend payload or tenant source JSON.

## Files

- `index.html`: home page entry for the master template
- `menu.html`: menu page entry
- `reservation.html`: reservation page entry
- `about.html`: about/story page entry
- `contact.html`: contact page entry
- `career.html`: career page entry
- `tenant-source.example.json`: runtime-shaped example payload for build/publish
- `content-schema.example.json`: content contract for theme/demo sections
- `theme-presets.example.json`: theme-family and exact-theme content presets

## Built-in page keys

Keep the technical page keys stable even if the tenant-facing labels change:

- `home`
- `menu`
- `reservation`
- `about`
- `contact`
- `career`
- `founder`

The navigation labels can be localized or renamed per tenant, but the internal page keys should stay fixed so preview, publishing, and routing remain predictable.

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

Additional tenant-copyable content now supported in the master payload:

- `branding.logo_image`
- `appearance.background_image`
- `appearance.background_color`
- `appearance.background_brightness`
- `appearance.background_overlay_opacity`
- `navigation.labels.home|menu|reservation|about|contact|career`
- `navigation.page_visibility.<page>.show_in_nav`
- `navigation.page_visibility.<page>.show_on_home`
- `navigation.secondary_items[]`
- `navigation.header_contact_label`
- `navigation.header_reserve_label`
- `career.eyebrow`
- `career.title`
- `career.body`
- `career.cta_label`
- `career.cta_href`
- `career.roles[]`
- `content.button_copy.*`
- `content.form_copy.*`
- `content.feedback_copy.*`

The intended behavior for built-in pages is:

- If `show_in_nav` is `true`, the page stays as its own tab/page for a cleaner, less distracting flow.
- If `show_in_nav` is `false` and `show_on_home` is `true`, that page feed is embedded into Home so the tenant can keep a long-form landing page without exposing another tab.

This is a bounded system, not a freeform site builder. Tenants may change any user-visible presentation text, media, theme, and background treatment inside the contract, but must not change the internal page keys, section model, business-logic wiring, or renderer shape.

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
4. Inject the payload into the page entries at publish time.
5. Render a tenant-specific page set: `index.html`, `menu.html`, `reservation.html`, `about.html`, `contact.html`, `career.html`.
6. Store the output under an R2 prefix like `sites/{company_id}/current/`.
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