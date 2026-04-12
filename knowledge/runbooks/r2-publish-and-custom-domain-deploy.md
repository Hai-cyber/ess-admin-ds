# R2 Publish + Custom Domain Deploy Runbook

## Purpose

Step-by-step checklist for provisioning the `WEBSITE_PUBLISH_R2` bucket before deploy, validating
publish output after deploy, and hardening the custom-domain workflow beyond the current MVP.

---

## Part 1 — R2 Bucket Provisioning

### 1.1 Create the bucket (one-time)

```bash
npx wrangler r2 bucket create ess-admin-ds-website-publish-prod
```

Verify it appears in the bucket list:

```bash
npx wrangler r2 bucket list
```

Expected output should include:

```
ess-admin-ds-website-publish-prod
```

### 1.2 Confirm wrangler.jsonc binding

The production env block in `wrangler.jsonc` must declare:

```jsonc
"r2_buckets": [
  {
    "binding": "WEBSITE_PUBLISH_R2",
    "bucket_name": "ess-admin-ds-website-publish-prod"
  }
]
```

The binding name `WEBSITE_PUBLISH_R2` is used throughout the worker (`writeWebsitePublishArtifacts`, `readPublishedWebsitePayloadFromStorage`). If the binding is absent the worker silently skips storage writes — no crash, but published content is never persisted to R2.

### 1.3 Local dev note

The default (non-production) `wrangler.jsonc` env does **not** include an R2 binding — that is intentional. In local dev the publish path skips storage silently (`if (!bucket) return { ok: false, stored: false }`). This keeps local dev free of R2 costs and avoids mistakenly writing to the production bucket.

---

## Part 2 — Production Deploy Checklist

Run before and after every production deploy that touches the website publish path.

### Pre-deploy

- [ ] Wrangler version is current (`npx wrangler --version`)
- [ ] You are authenticated to the correct Cloudflare account (`npx wrangler whoami`)
- [ ] R2 bucket `ess-admin-ds-website-publish-prod` exists (see Part 1)
- [ ] D1 database binding is pointing to production (`database_id: 55939312-121a-4fc1-91d2-061c4d9fa61e`)
- [ ] Production env vars that must NOT be present: `OTP_STUB_ENABLED`, `DISABLE_TURNSTILE_FOR_DEV`
- [ ] Production env vars that must be set as **secrets** (not vars): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TURNSTILE_SECRET`, `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `TENANT_SECRETS_MASTER_KEY`
- [ ] `npm run lint` passes locally
- [ ] `npm test -- --run` passes all tests locally

### Deploy

```bash
npx wrangler deploy --env production
```

Note the deployed version ID from the output.

### Post-deploy smoke tests

All requests target `https://prod.gooddining.app`.

```bash
# Worker health
curl -s https://prod.gooddining.app/api/health | jq .

# Platform plans (platform operator surface)
curl -s https://prod.gooddining.app/api/platform/plans | jq .ok

# Tenant website payload (use a known active company_id)
curl -s "https://prod.gooddining.app/api/website/payload?company_id=1" | jq .ok

# Wildcard subdomain (replace SUBDOMAIN with a real tenant subdomain)
curl -s "https://SUBDOMAIN.gooddining.app/api/health" | jq .
```

All should return `"ok": true`.

### Verify R2 publish output (after a tenant publishes a release)

Tenant publish writes three keys under `sites/{company_id}/current/`:

| Key | Purpose |
|-----|---------|
| `tenant-source.json` | Website payload snapshot |
| `media-assets.json` | Active media assets list |
| `publish-manifest.json` | Release metadata |

Check via CLI:

```bash
# List objects under a tenant prefix
npx wrangler r2 object list ess-admin-ds-website-publish-prod --prefix "sites/1/current/"

# Download and inspect the manifest
npx wrangler r2 object get ess-admin-ds-website-publish-prod "sites/1/current/publish-manifest.json" --file /tmp/manifest.json
cat /tmp/manifest.json
```

The manifest should contain `"release_id"`, `"published_at"`, and `"published_url"`.

---

## Part 3 — Custom Domain Workflow Hardening

This section covers the gap between the current CNAME-based activation MVP and a production-ready custom domain workflow.

### 3.1 Current state (MVP)

- Tenant requests a custom domain via Tenant Admin.
- Operator approves, provides CNAME DNS instructions.
- Tenant configures DNS and signals readiness.
- Operator runs DNS verification (via Cloudflare DNS-over-HTTPS) and activates.
- Activation writes `custom_domain` setting and runs a health check against the new host.

### 3.2 Hardening steps for go-live

#### A — DNS verification: disable mock mode in production

`wrangler.jsonc` production vars must NOT include `CUSTOM_DOMAIN_DNS_VERIFY_MODE=mock`. Remove it if it was ever added during testing.

Verify by checking production vars:

```bash
npx wrangler secret list --env production
```

#### B — Activation health check: validate both endpoints

The current health check validates `/api/health` and `/api/website/payload` on the custom host. Confirm both return the correct tenant company:

```bash
curl -s "https://www.example-tenant.com/api/health" | jq .
curl -s "https://www.example-tenant.com/api/website/payload" | jq '.companyId'
```

`companyId` in the payload response must match the tenant's company ID.

#### C — CNAME propagation wait

DNS propagation can take 0–48 hours. Set operator expectation:

- Verification should not be run until at least 5–10 minutes after the tenant signals DNS is configured.
- If verification fails with `dns_record_mismatch`, retry after 30 minutes.
- After 48 hours of repeated failure, escalate to manual inspection.

#### D — Managed registration renewal cycle

If a tenant is on `registration_mode: managed_registration`:

- `renewal_due_at` is set to 365 days after activation.
- The scheduled job at `0 9 * * *` sends renewal reminders at 30, 14, 7, and 1 day before due.
- Overdue reminders fire at -1 and -7 days.

Confirm the cron trigger is attached after each deploy:

```bash
npx wrangler triggers list --env production
```

Expected: `schedule: 0 9 * * *` attached to `ess-admin-ds-prod`.

#### E — Rollback path: deactivate a custom domain

If a custom domain causes production issues:

1. In SaaS Admin, open the custom domain request and reject it (changes `request_status` to `rejected`).
2. Remove `custom_domain` from the tenant's settings via the API.
3. The tenant falls back to the managed subdomain automatically — the `buildPublishedWebsiteUrlForCompany` function prefers `custom_domain` then `subdomain`.

#### F — Wildcard tenant routing dependency

Custom domain resolution depends on `resolveActiveCompanyId`, which joins `companies` with `settings(key='custom_domain')`. If the D1 query is slow on high-cardinality tenants, add a partial index:

```sql
CREATE INDEX IF NOT EXISTS idx_settings_custom_domain
  ON settings (key, LOWER(value))
  WHERE key = 'custom_domain';
```

This index is advisory for now — apply it if custom-domain lookups appear in slow-query logs.

---

## Part 4 — Rollback Procedure

If a deploy introduces a regression:

1. Identify the last known-good version ID from previous deploy output.
2. Roll back via:

```bash
npx wrangler deployments rollback <VERSION_ID> --env production
```

3. Confirm health:

```bash
curl -s https://prod.gooddining.app/api/health | jq .
```

4. Do **not** run `wrangler deploy` again until the regression is fixed locally and tests pass.

---

## Part 5 — Environment Variable Reference

| Variable | Scope | Required | Notes |
|----------|-------|----------|-------|
| `WEBSITE_PUBLISH_R2` | Production binding | Yes | R2 bucket binding, not a var |
| `OTP_STUB_ENABLED` | Default (dev) only | Dev only | Must NOT be in production vars |
| `DISABLE_TURNSTILE_FOR_DEV` | Default (dev) only | Dev only | Must NOT be in production vars |
| `ADMIN_PIN_FALLBACK_ENABLED` | Default (dev) | `false` | Set to `false` in dev; production may keep `true` during rollout |
| `RESTAURANT_ADMIN_PIN_FALLBACK_ENABLED` | Default (dev) | `false` | Same as above |
| `PLATFORM_ADMIN_PIN_FALLBACK_ENABLED` | Both | `false` | Already disabled in both envs |
| `CUSTOM_DOMAIN_DNS_VERIFY_MODE` | Production | Omit | Only set to `mock` in local dev/test |
| `CUSTOM_DOMAIN_ACTIVATION_HEALTHCHECK_MODE` | Production | Omit | Only set to `mock` in local dev/test |
