# Runbook: Onboard New Customer Restaurant

## Objective

Bring a new restaurant online with isolated tenant settings and purchased module set.

## Steps

1. Create organization record (customer account).
2. Create company record (restaurant tenant).
3. Assign subdomain and base profile.
4. Set organization defaults (hours, capacities baseline, module defaults).
5. Enable purchased modules via control plane.
6. Provision tenant secrets in backend vault.
7. Share tenant admin onboarding checklist:
   - staff setup
   - area/capacity tuning
   - social links/public app IDs
   - media uploads
8. Validate:
   - website route
   - staff app auth
   - booking board flow
   - module gates

## Exit Criteria

- Tenant can operate booking flow and staff workflow.
- Paid modules match signed commercial package.
- Audit trail contains onboarding actions.
