# Production Ingress Runbook

## Purpose

Document how the explicit `production` Wrangler environment is exposed publicly after deploy.

## Current State

- Worker env name: `ess-admin-ds-prod`
- Deploy command: `npx wrangler deploy --env production`
- Production D1 database id: `55939312-121a-4fc1-91d2-061c4d9fa61e`
- Current workers.dev URL: `https://ess-admin-ds-prod.divine-shape-9f0a.workers.dev`
- Current problem: Cloudflare returns `403` with `error code: 1050`

This means the production Worker version exists, but public ingress is not usable yet.

## What Is Already Done

- `wrangler.jsonc` contains an explicit `env.production` section.
- `workers_dev: true` is set explicitly for the production env.
- Production deploy succeeds and returns a valid version id.
- The same D1 database binding used by the main env is configured for production.

## What Still Needs To Happen

Choose one public ingress path:

### Option A: Route on a managed zone

Attach the Worker to a real zone route, for example:

- `gooddining.app/*`
- `api.gooddining.app/*`
- `platform.gooddining.app/*`

Requirements:

- Cloudflare zone must exist in the current account
- route must be attached to `ess-admin-ds-prod`
- DNS and zone ownership must already be in place

### Option B: Custom domain

Attach a custom domain directly to the production Worker.

Requirements:

- domain or subdomain managed in the same Cloudflare account
- certificate issuance allowed
- hostname chosen for production traffic

## Verification Checklist

After route or domain attachment:

- `GET /api/health` returns `200`
- platform home loads
- platform admin loads
- `/api/platform/plans` returns pricing payload
- tenant host routing resolves correctly on the production hostname
- suspended/quarantined tenant host gating still returns blocked responses

## Notes

- Do not treat a successful `wrangler deploy --env production` as proof of usable public ingress.
- The current `1050` response is a Cloudflare-side ingress issue, not an application crash.
- Keep production ingress work separate from tenant website publish/release logic; they are related but not the same layer.