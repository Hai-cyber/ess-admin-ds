# Website Template Contracts — Restaurant OS

**Purpose**: Define the fixed-contract model for tenant website generation.

**Principle**: We do not build bespoke websites per customer. We maintain a controlled library of prebuilt skins. Customers may copy a preset, fill in bounded content fields, select a theme, and publish a new version without changing the core page model.

---

## Contract Summary

This contract exists to support the operating model below:

- We ship a fixed set of supported website skins.
- Every skin renders the same payload contract.
- Customers may edit copy, contact details, hours, menu content, images, and a limited set of navigation labels.
- Customers may not change the page architecture, renderer logic, or data shape.
- Publishing a new version means: clone preset -> fill content -> choose theme -> validate -> render.

If a new skin requires a new payload shape, it is not a skin. It is a new product surface and must not be added through the template system.

---

## Fixed-Skin Model

### Supported skins

The system currently supports these exact theme keys:

- `theme-basic-a`
- `theme-basic-b`
- `theme-luxury-a`
- `theme-luxury-b`
- `theme-minimal-a`
- `theme-minimal-b`
- `theme-diner-a`
- `theme-diner-b`

These keys are part of the contract. They are not tenant-editable free text.

### Supported tiers

- `basic`
- `plus`
- `premium`

Tier controls feature visibility. Theme controls presentation only.

### Tenant customization boundary

Allowed:

- business identity
- business contact details
- business hours and booking info
- navigation labels
- section copy
- menu content
- images and logos
- theme selection
- preset selection

Not allowed:

- adding arbitrary new pages
- changing internal page keys
- introducing theme-only payload fields without defaults
- redefining section structure per tenant
- changing renderer logic per tenant

---

## Canonical Runtime Files

The current website template system is anchored in these files:

- `src/index.js`
- `public/website-master/index.html`
- `public/website-master/tenant-source.example.json`
- `public/website-master/content-schema.example.json`
- `public/website-master/theme-presets.example.json`

These files must remain aligned.

---

## Payload Contract

Every website version must normalize to this top-level payload shape:

```json
{
  "tenant": {},
  "theme_presets_url": "./theme-presets.example.json",
  "company": {},
  "settings": {},
  "branding": {},
  "navigation": {},
  "career": {},
  "modules": {},
  "legal": {},
  "social": {},
  "content": {}
}
```

### Required top-level objects

- `tenant`
- `company`
- `settings`
- `navigation`
- `modules`
- `content`

### Optional top-level objects with fallbacks

- `branding`
- `career`
- `legal`
- `social`

### Contract rule

Renderers must consume normalized payload only. They must not depend on raw tenant DB rows.

---

## Tenant Object

### Required fields

```json
{
  "id": "tenant-berlin-001",
  "company_id": 101,
  "theme": "theme-luxury-a",
  "tier": "premium",
  "content_preset": "theme-luxury-a"
}
```

### Rules

- `id`: stable tenant identifier
- `company_id`: numeric or numeric-like company reference
- `theme`: must be one of the eight supported skin keys
- `tier`: must be one of `basic|plus|premium`
- `content_preset`: preset key used as base content source

### Fallback rules

- If `theme` is invalid or missing, backend maps from `settings.site_template`
- If `tier` is missing, runtime derives from enabled modules
- If `content_preset` is missing, default to selected `theme`

---

## Company Object

### Required fields

```json
{
  "name": "Maison Verenne",
  "city": "Berlin",
  "cuisine": "French Dining & Cocktails",
  "phone": "+49 30 2201 4840",
  "email": "soir@maison-verenne.example",
  "address": "112 Augustufer, 10117 Berlin"
}
```

### Rules

- `name`: primary brand string
- `city`: short locality string
- `cuisine`: customer-facing cuisine descriptor
- `phone`, `email`, `address`: business-facing contact values

### Fallback rules

- missing `name` -> preview profile or generic restaurant fallback
- missing `phone` -> preview profile or booking settings fallback
- missing `email` -> preview profile or `settings.booking_email`
- missing `address` -> preview profile or `settings.site_contact_address`

---

## Settings Object

### Canonical editable settings

- `site_template`
- `site_language`
- `site_tagline`
- `site_hero_title`
- `site_hero_subtitle`
- `site_about_title`
- `site_about_body`
- `site_primary_cta_text`
- `site_secondary_cta_text`
- `site_accent_color`
- `turnstile_site_key`
- `booking_email`
- `custom_domain`
- `standard_contact_link`
- `founder_program_label`
- `founder_membership_type`
- `founder_redirect_link`
- `privacy_link`
- `founder_terms_link`

### Contract rule

These fields may customize copy and business behavior. They may not redefine layout structure.

---

## Branding Object

### Supported fields

- `logo_image`
- `locale_label`
- `language_code`

### Contract rule

Branding is decorative and informational only. It must never be required for successful rendering.

### Fallback rules

- missing `logo_image` -> render text/monogram fallback
- missing locale/language labels -> derive from `settings.site_language`

---

## Navigation Contract

### Internal page keys

The following page keys are fixed and must never change:

- `home`
- `menu`
- `reservation`
- `about`
- `contact`
- `career`
- `founder`

Tenant-facing labels may change, but page keys remain stable.

### Supported fields

```json
{
  "labels": {
    "home": "Home",
    "menu": "Menus",
    "reservation": "Reservations",
    "about": "About",
    "contact": "Contact",
    "career": "Careers",
    "founder": "Founder"
  },
  "secondary_items": [],
  "page_visibility": {
    "home": { "show_in_nav": true, "show_on_home": true },
    "menu": { "show_in_nav": true, "show_on_home": false },
    "reservation": { "show_in_nav": true, "show_on_home": false },
    "about": { "show_in_nav": true, "show_on_home": false },
    "contact": { "show_in_nav": true, "show_on_home": false },
    "career": { "show_in_nav": true, "show_on_home": false },
    "founder": { "show_in_nav": true, "show_on_home": false }
  },
  "header_contact_label": "Contact",
  "header_reserve_label": "Reserve"
}
```

### Rules

- `labels` may localize or rename page tabs
- `secondary_items` may point to a fixed page key or external href
- `page_visibility` controls whether a page appears in top nav or embeds into home

### Fallback rules

- missing label -> use default English label
- missing page visibility entry -> `show_in_nav: true`, `show_on_home: false`
- missing header labels -> default `Contact` and `Reserve`

### Hard rule

Navigation configuration may reorder emphasis, but it may not introduce unknown page keys.

---

## Career Contract

### Supported fields

- `eyebrow`
- `title`
- `body`
- `cta_label`
- `cta_href`
- `roles[]`

### Role item shape

```json
{
  "title": "Chef de Partie",
  "location": "Berlin",
  "type": "Full time",
  "body": "Lead a station with seasonal discipline and calm service rhythm."
}
```

### Fallback rules

- missing career block -> render preset defaults
- missing roles -> render empty state or hide cards area cleanly

---

## Modules Contract

Modules do not change theme structure. They only turn capabilities on or off.

### Current driver flags

- `module_booking_management`
- `module_membership_management`
- `module_marketing_management`
- `module_digital_management`
- `module_loyalty_rewards`
- `module_contact_crm`

### Feature gating rules

- booking modules drive reservation experience
- membership modules drive founder or KC flows
- missing module support must hide UI, not break rendering

---

## Content Contract

The `content` object is the main bounded customization surface.

### Canonical fields

- `hero_image`
- `footer_copy`
- `story_paragraphs[]`
- `location_cards[]`
- `journal_feature_image`
- `journal_cards[]`
- `team_image`
- `menu_link_cards[]`
- `section_copy`
- `menu_sections[]`
- `category_cards[]`
- `membership_rewards[]`
- `market_fit[]`
- `signature_items[]`
- `theme_content`

### Section copy map

Supported `section_copy` keys:

- `homeSignatures`
- `menu`
- `menuCategories`
- `reservation`
- `contact`
- `marketFit`

Each section copy block may contain:

- `eyebrow`
- `title`
- `body`

### Contract rule

Section keys are fixed. Tenants may edit text values but may not add arbitrary section groups.

---

## Media Slot Contract

Each skin may present media differently, but all skins pull from the same media slot model.

### Canonical single-image slots

- `hero_image`
- `journal_feature_image`
- `team_image`

### Canonical repeatable image collections

- `signature_items[].image`
- `location_cards[].image`
- `journal_cards[].image`
- `menu_link_cards[].image`

### Rules

- image fields accept absolute URLs or tenant asset URLs
- renderers must survive empty image slots
- skins may choose different crops or placement, but never different field names

### Fallback order

1. tenant-provided content image
2. selected preset image
3. theme preview profile image family
4. safe global placeholder image

---

## Fixed Page Model

The current generated site uses a fixed page set:

- `index.html` -> `home`
- `menu.html` -> `menu`
- `reservation.html` -> `reservation`
- `about.html` -> `about`
- `contact.html` -> `contact`
- `career.html` -> `career`
- `founder.html` -> `founder`

### Contract rule

Customers do not create custom routes. They publish a version of this existing page set.

### Embedding rule

If a page is hidden from nav and marked `show_on_home`, its feed may be embedded into the home journey. This is still the same fixed page model, not a new page.

---

## Fallback and Normalization Rules

### Required renderer behavior

All renderers must normalize the payload before binding.

### Mandatory fallback order

1. tenant explicit payload value
2. theme preset value
3. preview profile value
4. system default value

### Missing-data behavior

- missing text -> fallback string or hide optional block cleanly
- missing image -> fallback image or omit decorative media block cleanly
- missing menu items -> render empty section state or hide secondary merchandising region
- missing membership content -> hide premium upsell block when module/tier disallows it

### Forbidden behavior

- throw because an optional field is absent
- render `undefined`, `null`, or broken URLs into public output
- require a theme-specific field that does not exist in other themes

---

## Publish Contract

Publishing a tenant website version must follow this pipeline:

1. load company, settings, modules, and legal data
2. resolve selected theme and preset
3. merge preset content with tenant overrides
4. normalize into the canonical payload contract
5. validate page keys, theme key, required business fields, and media slots
6. render fixed page entries
7. store the output as a versioned website build

The operational publish gate for this pipeline is documented in `docs/contracts/WEBSITE_PUBLISH_VALIDATION.md`.

### Validation requirements before publish

- valid supported theme key
- valid fixed page keys only
- required business identity fields present
- required contact fields present
- navigation labels are strings
- no unknown page keys in `page_visibility`
- arrays conform to expected item shapes
- images are valid URLs or asset references

---

## Skin Design Rule

Each skin may differ in:

- typography
- layout emphasis
- density
- image treatment
- merchandising intensity
- amount of visible navigation

Each skin may not differ in:

- payload contract
- required page keys
- section identifiers
- publish pipeline
- validation rules

This is the rule that keeps 8 skins maintainable.

---

## Compliance Checklist

Before adding or changing a skin:

- [ ] Uses only supported theme key values
- [ ] Renders canonical payload contract
- [ ] Does not require custom tenant-only fields
- [ ] Supports fixed page keys
- [ ] Supports fallback rendering with missing optional content
- [ ] Uses canonical media slots only
- [ ] Keeps publish path identical to other skins
- [ ] Does not turn the template system into bespoke website development

Before shipping a new tenant version:

- [ ] Payload validates against this contract
- [ ] Theme key is supported
- [ ] Navigation page keys are valid
- [ ] Required business info is present
- [ ] Forms still map to standard runtime endpoints
- [ ] Public render has no broken blocks with missing optional data
