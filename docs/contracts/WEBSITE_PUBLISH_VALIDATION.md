# Website Publish Validation — Restaurant OS

**Purpose**: Define the operational validation gate before a tenant website version is rendered or published.

**Principle**: A version must fail before publish, not after render.

---

## Validation Goal

This validation gate exists to support the fixed-skin model:

- tenant copies a preset
- tenant edits presentation content freely
- system validates the payload
- system renders the fixed page model

Tenant admin may expose friendly content fields, but validation still runs against normalized contract data rather than raw form labels or UI-only field names.

If validation fails, the website version must not publish.

---

## Validation Layers

Every website version should pass all six layers.

### 1. Contract validation

Check that the payload shape conforms to the website template contract.

Required checks:

- required top-level objects exist
- supported theme key only
- supported tier only
- fixed page keys only
- known section copy keys only
- optional appearance fields use valid values
- media slots use valid paths or URLs

Command:

```bash
npm run validate:website-template
```

---

### 2. Business completeness validation

Check that the tenant version contains the minimum business information required for a public site.

These values may be system-managed rather than tenant-editable, but they must still be present before publish.

Required checks:

- company name
- cuisine label
- phone
- email
- address
- opening-hours data is present in a normalized machine-readable form when the tenant publishes service hours
- hero title
- hero subtitle
- about title
- about body
- primary CTA
- secondary CTA
- booking email

If these fields are missing, publish should fail.

---

### 3. Navigation and page integrity validation

Check that the version stays inside the fixed page system.

Required checks:

- no unknown page keys in `navigation.labels`
- no unknown page keys in `navigation.page_visibility`
- all fixed pages have visibility entries
- secondary navigation items use a known `page` or a valid `href`

If an unknown page key appears, publish should fail.

---

### 4. Media resilience validation

Check that media references do not break rendering.

Required checks:

- hero image is a valid URL or valid asset path if provided
- gallery and card images are valid URLs or valid asset paths if provided
- missing optional media falls back cleanly

If a media field is optional and blank, publish may continue.
If a media field is present but malformed, publish should fail.

---

### 5. Appearance validation

Check that presentation controls stay within safe ranges.

Required checks:

- `background_image` is a valid URL or asset path if provided
- `background_color` is a valid color string if provided
- `background_brightness` is within allowed range
- `background_overlay_opacity` is within allowed range

If these values are malformed, publish should fail.

### 6. Abuse and trust validation

Check that the tenant website version is safe to expose on a managed public subdomain or custom domain.

Required checks:

- subdomain slug passes reserved-term and abuse-policy checks
- tenant trust status allows publish on the requested host type
- public copy does not contain blocked scam, explicit sexual, hateful, or impersonation patterns
- outbound links do not point to blocked or obviously suspicious destinations
- moderation result is one of `allow`, `review`, or `block`
- `review` versions do not become publicly live until an operator approves them
- `block` versions must not publish and must persist reason codes for audit

If this layer fails or returns `block`, publish must fail.
If this layer returns `review`, publish must enter a held state and notify operators.

---

## Operational Checklist

Use this checklist before rendering or publishing a new tenant version.

- [ ] Theme key is one of the supported eight skins
- [ ] Tier is valid
- [ ] Contract version is current
- [ ] Required business identity fields are present
- [ ] Required contact fields are present
- [ ] Opening hours are valid for public display and future shop or online-order reuse
- [ ] Navigation uses fixed page keys only
- [ ] Section copy uses known section keys only
- [ ] Button, form, and feedback copy stay inside known registries
- [ ] No malformed image URLs or asset paths exist
- [ ] Background controls use valid values
- [ ] Menu sections and repeatable cards have valid item shapes
- [ ] Optional missing data falls back safely in preview
- [ ] Subdomain slug is not reserved, quarantined, or policy-blocked
- [ ] Tenant trust tier allows requested publish target
- [ ] Content moderation returns `allow` or an approved `review`
- [ ] Suspicious outbound links are absent or explicitly approved
- [ ] Publish decision and reason codes are written to audit history

---

## Fail vs Warn Rules

### Must fail publish

- invalid JSON
- missing required top-level objects
- unsupported theme key
- unsupported tier
- unknown page keys
- malformed appearance values
- malformed URLs in provided media fields
- missing core business identity fields
- missing required CTA or contact fields
- blocked subdomain slug
- blocked content moderation decision
- tenant status is suspended or under abuse hold

### May warn but still publish

- missing optional branding logo
- missing optional gallery items
- missing optional journal or market-fit content
- basic tier with membership module enabled but hidden by tier gate
- first publish from a low-trust tenant when moderation returns `review` and an operator already approved it

---

## Current Validator

The repository now includes a validator script:

- `scripts/validate-website-template.js`

Default targets:

- `public/website-master/tenant-source.example.json`

`content-schema.example.json` is a structure reference, not a publish-ready tenant payload, so it is not part of the default pre-publish validation target.

You may also validate a custom payload file:

```bash
node scripts/validate-website-template.js path/to/tenant-source.json
```

---

## Contract Relationship

This validation gate enforces the rules defined in:

- `docs/contracts/WEBSITE_TEMPLATE_CONTRACTS.md`

The template contract defines what the system is allowed to render.
This publish validation document defines what must be checked before the system renders it.

Operational design for subdomain abuse protection and Telegram-based operator review is documented in:

- `knowledge/specs/subdomain-abuse-protection-spec.md`
- `knowledge/runbooks/content-review-telegram.md`