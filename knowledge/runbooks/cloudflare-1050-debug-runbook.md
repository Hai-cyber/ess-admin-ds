# Cloudflare 1050 Debug Runbook

## Purpose

Provide a concrete, screen-by-screen procedure for debugging Cloudflare `1050` responses on Worker custom domains.

This runbook is specifically written for the current production hostnames:

- `prod.gooddining.app`

Historical optional hostnames that were tested and later removed from the active Wrangler config:

- `api.prod.gooddining.app`
- `platform.prod.gooddining.app`

## What 1050 Means In Practice

For this project, treat `1050` as:

- Cloudflare accepted DNS and TLS enough to answer the hostname
- but traffic is still not being routed cleanly into the Worker custom-domain path
- so the block is usually above the application runtime

Do not start in application code unless one of the checks below proves the request actually reaches the Worker.

## Known Current State

As of 2026-04-09:

- `prod.gooddining.app` is working
- `api.prod.gooddining.app` returned `1050` when it was tested as an additional production hostname
- `platform.prod.gooddining.app` returned `1050` when it was tested as an additional production hostname
- DNS resolves for both failing hosts
- TLS certificates are presented for both failing hosts

This means the highest-probability failure area is Cloudflare custom-domain host activation or routing state.

## Preconditions

Before opening the dashboard, confirm these from terminal when debugging optional extra hostnames:

1. `dig +short api.prod.gooddining.app`
2. `dig +short platform.prod.gooddining.app`
3. `curl -i https://api.prod.gooddining.app/...`
4. `curl -i https://platform.prod.gooddining.app/...`
5. `openssl s_client -servername <host> -connect <host>:443`

Interpretation:

- If DNS does not resolve: stop and fix DNS first.
- If DNS resolves but TLS does not: stop and fix certificate/custom hostname provisioning first.
- If DNS and TLS both work but HTTP still returns `1050`: continue with this runbook.

## Screen 1: Workers And Pages -> Overview

Path:

1. Log into Cloudflare dashboard
2. Select the correct account
3. Open `Workers & Pages`
4. Open Worker `ess-admin-ds-prod`

What to look for:

- Worker exists with the expected name
- latest deployment is present
- deployment timestamp matches the last `wrangler deploy --env production`

Good sign:

- Worker shows the newest version and no deployment error banner

Bad sign:

- Worker missing
- stale version only
- deploy failed banner

If bad:

- redeploy first
- do not continue until the Worker itself is healthy

## Screen 2: Worker -> Settings -> Triggers / Domains

Path:

1. In `ess-admin-ds-prod`
2. Open the section that lists `Domains`, `Custom Domains`, or `Triggers`

What to look for:

- `prod.gooddining.app`
- `api.prod.gooddining.app`
- `platform.prod.gooddining.app`

For each hostname, check the exact status label.

Expected good labels:

- `Active`
- `Ready`
- `Deployed`

Suspicious labels:

- `Pending`
- `Initializing`
- `Waiting for validation`
- `Certificate provisioning`
- `Error`

Interpretation:

- If `prod.gooddining.app` is active and the other two are pending, this is not an app problem.
- If the failing hosts are not listed at all, `wrangler.jsonc` and deployed triggers are out of sync with the dashboard state.
- If listed with errors, open the error details before touching DNS.

Action if host is pending or errored:

1. remove the failing custom domain entry
2. save
3. add it again
4. redeploy triggers or run a fresh production deploy
5. wait for status to change to active before re-testing

## Screen 3: Zone -> DNS

Path:

1. Open zone `gooddining.app`
2. Open `DNS`

Look for the exact records:

- `prod`
- `api.prod`
- `platform.prod`

What to confirm:

- records exist exactly once
- no conflicting duplicate A/CNAME records for the same hostname
- proxy status matches the custom-domain setup expectation

Warning signs:

- duplicate records for the same name
- stale records pointing somewhere unrelated
- a record existing in DNS while dashboard custom-domain entry points elsewhere

Decision rule:

- if DNS is duplicated or conflicting, clean DNS first
- if DNS is clean and TLS already works, continue to custom hostname status, not app code

## Screen 4: SSL/TLS -> Edge Certificates / Custom Hostnames

Path:

1. Open `SSL/TLS`
2. Open `Edge Certificates` or `Custom Hostnames` if available in the account UI

What to look for:

- each failing hostname listed
- certificate status
- hostname validation status

Good sign:

- hostname listed with active certificate

Important nuance:

- active certificate alone does not prove Worker routing is active
- it only proves Cloudflare can terminate TLS for the hostname

If certificate is active but host still returns `1050`:

- continue back to Worker custom-domain status
- the failure is likely in host activation or trigger attachment, not certificate issuance

## Screen 5: Security -> Access / Zero Trust

Path:

1. Open `Security`
2. Review `WAF`, `Security Rules`, and `Access` if in use

What to check:

- no hostname-specific rule matching `api.prod.gooddining.app`
- no hostname-specific rule matching `platform.prod.gooddining.app`
- no Access application bound to those hostnames

Interpretation:

- if a rule exists, disable it temporarily and re-test
- if nothing hostname-specific exists, return focus to Worker custom-domain activation

Note:

- this project already checked application access control and found nothing unusual
- this step exists to rule out Cloudflare account-level policy, not app-level auth

## Screen 6: Workers Logs / Tail

Path:

1. Use dashboard logs or `wrangler tail --env production`
2. send one request to working host
3. send one request to failing host

What to compare:

- does the working host appear in logs?
- does the failing host appear in logs?

Decision rule:

- if the failing host does not appear in Worker logs, the request is not reaching runtime
- if the failing host appears in logs, then investigate application routing or middleware

Current observed behavior:

- `prod.gooddining.app` works
- failing hosts do not provide evidence of useful Worker execution before `1050`

## Fast Decision Tree

1. DNS missing:
   Fix DNS.

2. DNS works, TLS missing:
   Fix certificate/custom hostname provisioning.

3. DNS works, TLS works, Worker logs do not show request, HTTP is `1050`:
   Fix Cloudflare custom-domain activation/trigger state.

4. DNS works, TLS works, Worker logs show request:
   Investigate Worker routing/app behavior.

## Recommended Recovery Sequence For This Project

For optional hostnames like `api.prod.gooddining.app` and `platform.prod.gooddining.app`:

1. Open Worker `ess-admin-ds-prod`
2. Open `Domains` / `Custom Domains`
3. Capture the exact status labels of both hostnames
4. If either hostname is not clearly `Active`, remove and re-add it
5. Re-run `npm run deploy:prod`
6. Wait 5-15 minutes
7. Re-test with `curl`
8. Re-check Worker logs

Only after those steps fail should you escalate further in Cloudflare support or deeper account settings.

## Evidence To Record In Handoff

When updating project docs, record:

- exact hostname
- dashboard status label
- DNS result
- TLS result
- HTTP result
- whether Worker logs saw the request
- what action was taken next

This prevents repeating the same investigation next session.