# ADR 0001: Shared Cloudflare Codebase with Tenant Isolation

## Status
Accepted

## Context
The platform must support many restaurant customers with independent operations while minimizing operational overhead.

## Decision
Use a shared Cloudflare codebase and deployment model with strict tenant isolation in data and runtime policy.

## Consequences

### Positive
- Faster feature rollout for all tenants.
- Lower infrastructure complexity.
- Centralized compliance and observability.

### Negative
- Requires strict guardrails in tenant scoping.
- Regression risk can affect all tenants if controls are weak.

## Guardrails
- Mandatory company_id scoping on business records.
- Server-side module gate checks.
- Role-based authorization by actor type.
- Audit logging on privileged changes.
