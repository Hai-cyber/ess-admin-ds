# ADR 0002: Organization Defaults with Company Overrides

## Status
Accepted

## Context
One customer organization may operate multiple restaurant companies and needs common defaults plus per-restaurant customization.

## Decision
Implement a two-layer configuration model:

- organization_settings for customer-level defaults
- settings (company scope) for per-restaurant overrides

Runtime merges organization defaults first, then company overrides.

## Consequences

### Positive
- Reduces repeated config across restaurants.
- Allows controlled flexibility per location.
- Supports multi-restaurant onboarding at scale.

### Negative
- Merge logic must be deterministic and tested.
- Admin UX must clearly show inherited versus overridden values.
