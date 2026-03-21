# ESSKULTUR Multi-Tenant Platform

This repository is evolving from a single-restaurant setup into a multi-tenant platform where each customer restaurant can have isolated operations while sharing one Cloudflare codebase.

## Platform Goals

- Each restaurant can run its own website, staff app, booking board, email routing, POS integration, and tenant-level settings.
- Operator control plane can enable or disable paid modules per customer (SEO, media management, membership, marketing, and more).
- Tenant front admin can manage operations variables (staff, area, capacity, social platform links, and media uploads for automation).

## Recommended Workspace Layout

- cloudflare/: Cloudflare-first runtime architecture (workers, durable objects, queues, schemas, tests).
- knowledge/: Product and architecture knowledge base (ADRs, specs, APIs, runbooks, standards).
- .github/workflows/: CI automation for structural validation.

## Migration Note

Current production code remains in src/ and public/. The new cloudflare/ and knowledge/ trees define the target architecture and rollout contracts for multi-tenant SaaS operations.

## Where To Start

- Product overview: knowledge/specs/project-overview.md
- Platform spec: knowledge/specs/multi-tenant-platform-spec.md
- Tenant self-service spec: knowledge/specs/frontend-self-service-spec.md
- Control plane API: knowledge/apis/control-plane-api.md
- Tenant admin API: knowledge/apis/tenant-admin-api.md
- Founder and booking form query variables: docs/FORM_QUERY_VARIABLES.md
