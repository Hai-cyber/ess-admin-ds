# Production Ingress Runbook

## Purpose

Document how the explicit `production` Wrangler environment is exposed publicly after deploy.

## Current State

- Worker env name: `ess-admin-ds-prod`
- Deploy command: `npx wrangler deploy --env production`
- Production D1 database id: `55939312-121a-4fc1-91d2-061c4d9fa61e`
- Current workers.dev URL: `https://ess-admin-ds-prod.divine-shape-9f0a.workers.dev`
- Production custom domain target: `prod.gooddining.app`
- workers.dev still returns `403` with `error code: 1050`, but the production ingress path should now use the custom domain instead of workers.dev.
- Verified live on 2026-04-09:
	- `GET https://prod.gooddining.app/api/health` returns `200`
	- `GET https://prod.gooddining.app/api/platform/plans` returns `200`

Current strategy:

- keep production on a single hostname: `prod.gooddining.app`
- serve both API and platform admin from path-based routing on that hostname
- do not add extra production sub-hosts unless there is a concrete later need to split traffic

Investigation findings on 2026-04-09:

- the extra production sub-hosts were generating Cloudflare `1050` noise without adding operational value
- simplifying back to one hostname reduces ingress surface and removes unnecessary debugging variables
- Cloudflare dashboard still shows `Event Triggers` as empty for `ess-admin-ds-prod`, even after hard refresh/reset
- CLI still reports the cron trigger successfully attached via `wrangler deploy --env production` and `wrangler triggers deploy --env production`
- Treat the empty dashboard trigger panel as a Cloudflare UI/state mismatch unless CLI stops returning `schedule: 0 9 * * *`

This means the production Worker version exists and public ingress is now available through the explicit custom domain, not workers.dev.

## What Is Already Done

- `wrangler.jsonc` contains an explicit `env.production` section.
- `workers_dev: true` is still set explicitly for the production env, but it is no longer the primary ingress target.
- Production deploy succeeds and returns a valid version id.
- The same D1 database binding used by the main env is configured for production.
- `wrangler.jsonc` now defines `prod.gooddining.app` as a production custom domain.
- `wrangler.jsonc` now defines a production cron trigger for managed-domain renewal reminders.

## What Still Needs To Happen

Primary public ingress path:

### Option A: Production custom domain

Attach the Worker to a real custom domain in the same zone:

- `prod.gooddining.app`

Requirements:

- Cloudflare zone must exist in the current account
- custom domain must be attached to `ess-admin-ds-prod`
- DNS and zone ownership must already be in place

### Option B: Additional route or hostnames later

Attach additional managed-zone routes or hostnames only if there is a clear need later to split API or platform traffic away from the single production hostname.

Requirements:

- domain or subdomain managed in the same Cloudflare account
- certificate issuance allowed
- hostname chosen for production traffic

## Verification Checklist

After deploy and custom-domain attachment:

- `GET /api/health` returns `200`
- `GET https://prod.gooddining.app/api/health` returns `200`
- `GET https://prod.gooddining.app/api/website/payload?company_id=1` returns tenant payload when override is allowed
- platform home loads
- platform admin loads
- `/api/platform/plans` returns pricing payload
- custom-domain activation health checks succeed on the target host
- suspended/quarantined tenant host gating still returns blocked responses

## Notes

- Do not treat a successful `wrangler deploy --env production` as proof of usable public ingress.
- The current `1050` response on workers.dev is a Cloudflare-side ingress issue, not an application crash.
- Keep production ingress work separate from tenant website publish/release logic; they are related but not the same layer.
- For detailed Cloudflare dashboard triage of `1050`, use `cloudflare-1050-debug-runbook.md`.