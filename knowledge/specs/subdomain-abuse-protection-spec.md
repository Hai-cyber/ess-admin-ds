# Subdomain Abuse Protection Specification

## Purpose

Protect managed tenant subdomains and future custom domains from abuse, especially:

- phishing and impersonation
- sexual or pornographic content
- hateful, insulting, or harassing content
- politically sensitive or high-risk campaigning on platform-managed hosts
- religious exploitation or inflammatory misuse
- brand abuse and confusing lookalike subdomains
- repeat abuse after tenant suspension or cancellation

This specification defines the controls for slug reservation, content moderation, review workflow, and emergency suspension.

## Scope

Applies to:

- `*.gooddining.app` managed tenant subdomains
- future tenant custom-domain publish workflow
- tenant website publish or republish operations
- tenant website content edited from Restaurant Admin
- public links and media embedded in tenant website payloads

Does not apply to:

- private backoffice content not exposed publicly
- archived legacy assets that are not routable

## Design Principles

- Fail closed for high-risk abuse.
- Hold for review when confidence is uncertain.
- Keep restaurant onboarding fast for normal tenants.
- Separate slug safety from content safety.
- Log every moderation decision with reason codes.
- Support instant operator override and emergency suspension.

## Threat Model

### Slug abuse

- malicious slugs such as `secure-login`, `tax-refund`, `stripe-support`
- typosquatting or lookalikes of platform, brands, institutions, or public authorities
- explicit or hateful terms embedded in slug
- recycled suspended slugs used for fresh abuse

### Content abuse

- phishing language and fake payment or verification requests
- pornographic or explicit sexual text or images
- hateful or demeaning statements
- politically sensitive mobilization or propaganda on platform-managed hosts
- exploitative religious claims or abusive fundraising
- suspicious external links, redirects, or contact channels

### Operational abuse

- burst signups from one IP, ASN, or device cluster
- repeated publish attempts after prior moderation failure
- hostile edits after initial approval
- re-registration attempts for a quarantined slug

## Policy Model

### Decision classes

- `allow`: publish may continue automatically
- `review`: publish is held until operator approval
- `block`: publish is rejected and may trigger tenant restrictions

### Content classes

#### Hard block

- phishing, impersonation, credential theft, financial scam
- explicit sexual content or pornography
- hate speech, violent extremist praise, or explicit harassment
- malware delivery or malicious redirects
- brand or authority impersonation likely to deceive users

#### Manual review

- politically sensitive advocacy or campaign language
- religious persuasion or donation requests on managed subdomains
- insulting or inflammatory language below hard-block threshold
- ambiguous adult nightlife branding that may still be legitimate restaurant context
- external links to messaging apps, file drops, or high-risk landing pages

#### Allowed

- normal restaurant branding, menu, events, reservations, careers, and marketing
- nightlife or themed restaurant language that stays within platform policy

## Control Layers

### 1. Slug normalization

Before availability or reservation checks:

- lowercase input
- trim whitespace
- convert accented characters to ASCII where possible
- reject non-ASCII slug characters in public managed subdomains
- collapse repeated hyphens
- reject leading or trailing hyphen
- reject all-digit slugs
- reject punycode or confusable forms on managed subdomains

Normalized slug becomes the canonical comparison key.

### 2. Reserved and blocked slug policy

Maintain a reserved terms registry with:

- `exact`
- `contains`
- `prefix`
- `suffix`
- `fuzzy`

Categories include:

- `internal_system`
- `brand_protected`
- `scam`
- `sexual_explicit`
- `hate_or_insult`
- `political_sensitive`
- `religious_sensitive`
- `quarantine`

Action per rule:

- `block`
- `review`
- `reserve`

Examples of always-reserved system terms:

- `admin`
- `api`
- `support`
- `billing`
- `login`
- `verify`
- `secure`
- `mail`
- `status`

### 3. Trust tier policy

Each tenant has a trust state:

- `pending_verification`
- `trial_limited`
- `trusted`
- `restricted`
- `suspended`

Trust state is derived from signals such as:

- verified owner email
- verified owner phone
- successful payment method or billing identity
- completed business profile
- moderation history
- manual operator action

Publish rules:

- `pending_verification`: preview only, no public publish
- `trial_limited`: managed subdomain publish allowed after moderation, custom domain disabled
- `trusted`: managed subdomain and custom domain allowed after moderation
- `restricted`: publish held for manual review
- `suspended`: no publish, host resolution disabled

### 4. Publish moderation gate

Every publish or republish operation must run:

1. schema validation
2. business completeness validation
3. navigation and media validation
4. slug policy check
5. text moderation check
6. image moderation check when images changed
7. outbound link reputation and policy check
8. trust-tier policy check
9. final decision write to moderation log

The gate returns:

```json
{
  "decision": "allow",
  "reason_codes": [],
  "risk_score": 12,
  "requires_operator_review": false
}
```

### 5. Runtime monitoring

After publish, the system should still monitor:

- sudden content changes after approval
- repeated external link changes
- repeated reports against one host
- burst signup or publish activity tied to one source

The system may automatically downgrade a tenant to `restricted` pending review.

### 6. Emergency suspension

Operators need a one-action kill switch that:

- marks tenant website status as `suspended`
- removes host from normal resolution path
- blocks future publish attempts
- preserves evidence and prior decisions for audit
- sends confirmation to operator Telegram channel

## Data Model

### `reserved_terms`

- `id`
- `term`
- `normalized_term`
- `match_type`
- `category`
- `action`
- `notes`
- `created_at`
- `updated_at`

### `subdomain_reservations`

- `id`
- `slug`
- `normalized_slug`
- `company_id` nullable
- `status` (`reserved`, `blocked`, `quarantine`, `released`)
- `reason_code`
- `expires_at` nullable
- `created_at`
- `updated_at`

### `tenant_trust`

- `company_id`
- `trust_state`
- `risk_score`
- `email_verified_at`
- `phone_verified_at`
- `payment_verified_at`
- `business_verified_at`
- `last_manual_review_at`
- `notes`

### `publish_reviews`

- `id`
- `company_id`
- `website_version_id`
- `decision`
- `reason_codes_json`
- `risk_score`
- `review_status` (`pending`, `approved`, `rejected`, `expired`)
- `reviewer_type` (`system`, `operator`)
- `reviewer_id` nullable
- `created_at`
- `updated_at`

### `abuse_reports`

- `id`
- `company_id`
- `host`
- `report_type`
- `report_payload_json`
- `status`
- `created_at`

## D1 Schema Proposal

Use additive tables and additive nullable columns first so the current Phase 1 runtime can adopt moderation incrementally without breaking signup or website payload reads.

### New columns on `companies`

```sql
ALTER TABLE companies ADD COLUMN subdomain_status TEXT DEFAULT 'active';
ALTER TABLE companies ADD COLUMN website_status TEXT DEFAULT 'draft';
ALTER TABLE companies ADD COLUMN trust_state TEXT DEFAULT 'pending_verification';
ALTER TABLE companies ADD COLUMN risk_score INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN suspended_reason TEXT;
ALTER TABLE companies ADD COLUMN suspended_at TEXT;
ALTER TABLE companies ADD COLUMN last_reviewed_at TEXT;
```

Allowed values:

- `subdomain_status`: `active`, `reserved`, `quarantine`, `blocked`
- `website_status`: `draft`, `review`, `published`, `suspended`
- `trust_state`: `pending_verification`, `trial_limited`, `trusted`, `restricted`, `suspended`

### New table: `reserved_terms`

```sql
CREATE TABLE IF NOT EXISTS reserved_terms (
  id TEXT PRIMARY KEY,
  term TEXT NOT NULL,
  normalized_term TEXT NOT NULL,
  match_type TEXT NOT NULL,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reserved_terms_normalized ON reserved_terms(normalized_term);
CREATE INDEX IF NOT EXISTS idx_reserved_terms_action ON reserved_terms(action, is_active);
```

### New table: `subdomain_reservations`

```sql
CREATE TABLE IF NOT EXISTS subdomain_reservations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  normalized_slug TEXT NOT NULL,
  company_id INTEGER,
  status TEXT NOT NULL,
  reason_code TEXT,
  decision_source TEXT DEFAULT 'system',
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subdomain_reservation_slug_active
ON subdomain_reservations(normalized_slug, status);
CREATE INDEX IF NOT EXISTS idx_subdomain_reservation_company ON subdomain_reservations(company_id);
```

Recommended statuses:

- `reserved`
- `quarantine`
- `blocked`
- `released`

### New table: `publish_reviews`

```sql
CREATE TABLE IF NOT EXISTS publish_reviews (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  website_version_id TEXT,
  host TEXT,
  subdomain TEXT,
  decision TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending',
  risk_score INTEGER DEFAULT 0,
  reason_codes_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  payload_snapshot_json TEXT,
  reviewer_type TEXT NOT NULL DEFAULT 'system',
  reviewer_id TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX IF NOT EXISTS idx_publish_reviews_company ON publish_reviews(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_publish_reviews_status ON publish_reviews(review_status, decision, created_at);
```

### New table: `abuse_reports`

```sql
CREATE TABLE IF NOT EXISTS abuse_reports (
  id TEXT PRIMARY KEY,
  company_id INTEGER,
  host TEXT NOT NULL,
  report_type TEXT NOT NULL,
  report_payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX IF NOT EXISTS idx_abuse_reports_host ON abuse_reports(host, created_at);
CREATE INDEX IF NOT EXISTS idx_abuse_reports_status ON abuse_reports(status, created_at);
```

### Optional table: `tenant_trust_events`

```sql
CREATE TABLE IF NOT EXISTS tenant_trust_events (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  score_delta INTEGER DEFAULT 0,
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_trust_events_company ON tenant_trust_events(company_id, created_at);
```

## API Contract Detail

### Extend `GET /api/platform/signup/check-subdomain`

Current behavior only checks format and company collision.

New response shape:

```json
{
  "ok": true,
  "available": false,
  "slug": "secure-login",
  "decision": "block",
  "reason_codes": ["reserved_system_term", "impersonation_pattern"],
  "suggestions": ["secure-login-restaurant", "securedining-berlin"]
}
```

Behavior:

- normalize slug
- validate syntax
- evaluate reserved-term and fuzzy brand rules
- check `subdomain_reservations`
- check existing `companies`
- return `allow`, `review`, or `block`

### Extend `POST /api/platform/signup`

Current behavior provisions tenant immediately after syntax and uniqueness checks.

New behavior:

- call shared slug policy evaluator before creating organization and company
- reject `block`
- optionally allow `review` only if product wants lead capture without public provisioning
- insert trust defaults on successful create
- reserve slug in `subdomain_reservations`
- persist moderation snapshot in `platform_signups.raw_payload_json` or a dedicated review record

Suggested error additions:

- `subdomain_blocked`
- `subdomain_review_required`
- `subdomain_quarantined`

### New `POST /api/admin/website/publish`

Purpose: create the first explicit publish gate rather than letting public website payload read directly from editable settings only.

Request shape:

```json
{
  "pin": "1234",
  "target": "managed_subdomain",
  "requested_host": "roma.gooddining.app",
  "content_source": "current_settings"
}
```

Response shape:

```json
{
  "ok": true,
  "decision": "review",
  "review_id": "review_123",
  "website_status": "review",
  "reason_codes": ["suspicious_external_link"],
  "risk_score": 58
}
```

Execution:

1. authorize tenant admin
2. build normalized website payload
3. run contract validator
4. run moderation checks
5. create `publish_reviews` row
6. set `companies.website_status`
7. send Telegram alert for `review` or `block`

### New operator endpoints

#### `POST /api/platform/moderation/review/:id/approve`

- auth: platform operator pin
- updates `publish_reviews.review_status = approved`
- sets `companies.website_status = published`
- sets `companies.last_reviewed_at`
- sends Telegram confirmation

#### `POST /api/platform/moderation/review/:id/reject`

- auth: platform operator pin
- keeps tenant in `draft` or `review`
- stores review note and reason codes

#### `POST /api/platform/tenants/:companyId/suspend-website`

- auth: platform operator pin
- sets `companies.website_status = suspended`
- sets `companies.trust_state = suspended`
- stores `suspended_reason`

#### `POST /api/platform/subdomains/:slug/quarantine`

- auth: platform operator pin
- writes `subdomain_reservations.status = quarantine`
- blocks future reuse until released

## Current Code Integration Map

This repo already has the right building blocks, but moderation is not yet wired.

### 1. Slug normalization and syntax validation

Current code:

- `src/index.js`: `normalizeTenantSubdomain`
- `src/index.js`: `isValidTenantSubdomain`

Action:

- replace these helpers with a richer normalization path that also returns canonical slug, display slug, and policy flags
- add a new shared evaluator such as `evaluateSubdomainPolicy(env, slug)` and call it from every write path

### 2. Public subdomain availability check

Current code path:

- `src/index.js`: `GET /api/platform/signup/check-subdomain`

Action:

- after syntax validation, call reserved-term checks and reservation lookup before checking `companies`
- return `decision`, `reason_codes`, and `suggestions`

### 3. Public signup flow

Current code path:

- `src/index.js`: `POST /api/platform/signup`
- `public/platform/signup.html`: `checkSubdomain(...)` and submit wizard

Action:

- enforce the same slug policy in signup, not only in check-subdomain
- update UI status copy in signup wizard so `review` and `block` can be shown clearly

### 4. Tenant admin subdomain edits

Current code path:

- `src/index.js`: `POST /api/admin/platform-config`
- `public/admin.html`: company subdomain field and save flow

Action:

- when admin edits `company.subdomain`, run the same policy evaluator and reservation checks
- prevent a tenant admin from switching into blocked or quarantined slug space
- if subdomain changes after a site was public, quarantine the old slug automatically

### 5. Host resolution and kill switch

Current code path:

- `src/index.js`: `resolveActiveCompanyId(...)`
- `src/index.js`: `queryCompanyBySubdomain(...)`

Action:

- extend company lookup to read `subdomain_status`, `website_status`, and `trust_state`
- if website or trust is suspended, do not resolve public website host normally
- return a controlled not-found or suspended state before payload rendering

### 6. Website payload generation

Current code path:

- `src/index.js`: `buildPublicWebsitePayload(...)`
- `src/index.js`: `GET /api/website/payload`

Action:

- do not run moderation inside the payload builder itself
- keep payload builder pure
- use it as the normalized source for a new publish gate and for review previews

### 7. Missing publish gate

Current state:

- there is no explicit `POST /api/admin/website/publish` route yet
- website output is effectively runtime-shaped from current settings and preview adapter

Action:

- introduce a dedicated publish endpoint in `src/index.js`
- first version can simply validate current settings-derived payload and set `website_status`
- later version can persist versioned website payload snapshots if needed

### 8. Telegram alert delivery

Current codebase signals:

- existing `telegram_messages` table is for booking board messaging, not moderation
- existing integration settings and module flags already mention Telegram

Action:

- keep moderation alerts separate from booking Telegram messages
- send review alerts from publish or moderation handlers using env-based operator bot credentials
- optionally add a dedicated audit table later if operator alert delivery history becomes important

## Recommended Implementation Order in This Repo

### Step 1

Add new schema tables and `companies` columns in `src/db/schema-sql.js` and any mirrored schema file.

### Step 2

Create shared helpers in `src/index.js` first, or extract to `src/utils/` if the team wants cleaner separation:

- `normalizeManagedSubdomainSlug`
- `evaluateSubdomainPolicy`
- `checkReservedSlugStatus`
- `queueModerationTelegramAlert`

### Step 3

Wire slug policy into:

- `GET /api/platform/signup/check-subdomain`
- `POST /api/platform/signup`
- `POST /api/admin/platform-config`

### Step 4

Add explicit publish endpoint and `publish_reviews` writes.

### Step 5

Update `resolveActiveCompanyId` so suspended websites or quarantined slugs do not resolve publicly.

## Telegram Review Workflow

### Goal

When moderation returns `review` or `block`, notify operator review on Telegram with enough evidence to approve or reject quickly.

### Event triggers

- subdomain request returned `review`
- publish returned `review`
- publish returned `block`
- repeated reports crossed threshold
- tenant downgraded to `restricted`
- tenant suspended

### Telegram message requirements

Each message should include:

- company id
- tenant name
- requested host or subdomain
- trust state
- moderation decision
- top reason codes
- risk score
- preview link
- admin review link
- action buttons or explicit commands

### Telegram actions

- approve publish
- reject publish
- suspend tenant website
- quarantine slug
- mark tenant trusted
- request callback review later

If interactive Telegram callbacks are not implemented in the first iteration, the message should still carry a deep link into operator admin where the decision is executed.

## AI Content Guard Responsibilities

The AI content guard is an assistant, not the sole authority.

It should:

- classify text content into `allow`, `review`, `block`
- summarize why a version was flagged
- extract suspicious phrases and links
- preserve evidence for operator review

It must not:

- auto-approve content that violates deterministic block rules
- make silent publish decisions without audit record
- override operator suspension

Recommended pipeline order:

1. deterministic rule checks
2. heuristic scoring
3. AI text and image moderation where needed
4. operator review for `review` decisions

## API Surface

Suggested endpoints:

- `GET /api/platform/signup/check-subdomain?slug=...`
  - now returns `available`, `decision`, `reason_codes`, `suggestions`
- `POST /api/admin/website/publish`
  - now returns publish decision and review state
- `POST /api/platform/moderation/review/:id/approve`
- `POST /api/platform/moderation/review/:id/reject`
- `POST /api/platform/tenants/:companyId/suspend-website`
- `POST /api/platform/subdomains/:slug/quarantine`

## Acceptance Criteria

- blocked slug cannot be reserved or published
- quarantined slug cannot be reused until release policy permits it
- `review` publish never becomes live without operator approval
- operator receives Telegram notification within 30 seconds for `review` or `block`
- operator can suspend a host in one action
- all moderation decisions persist reason codes and timestamps
- low-risk restaurant content still publishes with minimal friction

## Rollout Strategy

### Phase A

- deterministic slug normalization
- reserved terms table
- basic block and review decisioning for slug checks

### Phase B

- publish moderation hook
- text and link scanning
- tenant trust state
- Telegram notification on review queue events

### Phase C

- image moderation
- custom-domain trust rules
- operator admin review queue
- emergency suspension and quarantine tooling

### Phase D

- repeated-abuse analytics
- risk-based throttling by IP, ASN, and tenant cluster
- decision tuning from review history