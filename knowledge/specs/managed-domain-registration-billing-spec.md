# Managed Domain Registration & Billing Spec

## Purpose

Define how the platform should handle optional managed domain registration after the bring-your-own-domain custom-domain upgrade flow is stable.

## Product Position

- Managed subdomain is included by default for every tenant.
- Bring-your-own-domain is the first custom-domain upgrade path.
- Managed domain registration is a convenience product, not the baseline onboarding path.
- The platform should optimize for simpler billing and support, not for being cheaper than Cloudflare on raw domain price.

## Scope

This spec covers:

- Domain registration as a managed add-on
- Renewal handling
- Billing line items
- Support boundaries
- Ownership and transfer policy

This spec does not cover:

- Automated registrar integration implementation details
- Full tax/VAT treatment per jurisdiction
- DNS automation internals

## Commercial Model

### Baseline

- `managed_subdomain_hosting`: included in the base SaaS plan
- `custom_domain_capability`: upgrade capability or add-on
- `managed_domain_registration`: optional convenience product
- `domain_dns_setup_service`: one-time service fee when manual migration/help is needed

### Recommended Pricing Structure

1. Managed subdomain hosting
   Included in plan price.

2. Custom-domain capability
   Charged as part of plan entitlement or as a separate add-on.

3. Managed domain registration
   Billed as a distinct annual line item.

4. DNS / migration setup
   Billed separately when operator assistance is needed.

### Pricing Recommendation

- Do not attempt aggressive price competition with Cloudflare Registrar.
- Use either pass-through wholesale cost or a small explicit management margin.
- Keep support-heavy work out of the raw domain line item.

## Billing Lines

Recommended invoice lines:

- `SaaS plan subscription`
- `Custom-domain capability`
- `Managed domain registration`
- `Managed domain renewal`
- `Domain setup / DNS migration support`

## Ownership Model

### Preferred Policy

- Tenant remains the beneficial owner of the domain.
- Platform acts as the operator/manager when managed registration is purchased.
- Ownership, transfer-out, and renewal responsibility must be clear in contract text.

### Required Controls

- Store registrant intent and consent timestamps.
- Track renewal mode and renewal due date.
- Record who approved purchase/renewal.
- Allow transfer-out process if tenant leaves the platform.

## Domain Lifecycle States

### Registration Mode

- `byod`
- `managed_registration`

### Domain Capability Status

- `not_requested`
- `requested`
- `approved_waiting_dns`
- `verification_pending`
- `verified_waiting_activation`
- `active`
- `rejected`

### Renewal Status

- `external`
- `managed_pending_purchase`
- `managed_active`
- `renewal_due_soon`
- `renewal_overdue`
- `transfer_out_requested`
- `transferred_out`

## Operational Rules

1. A tenant can launch and operate on the managed subdomain without any domain purchase.
2. Custom-domain capability must be approved before managed registration can be fulfilled.
3. Managed registration must remain optional even for higher tiers.
4. Managed subdomain remains active after custom domain activation for fallback and support.
5. Renewal reminders must be visible in operator tooling before expiration windows.
6. Activation should verify both runtime health and tenant website payload resolution on the custom host.

## MVP Implementation Order

1. BYOD custom-domain request and approval flow
2. DNS instruction + automatic verification + activation flow
3. Billing flag for custom-domain capability
4. Managed registration request capture
5. Renewal tracking and billing reminders
6. Registrar integration and automation

## Data Requirements

Suggested future fields beyond the current MVP:

- `registration_provider`
- `registration_external_id`
- `renewal_due_at`
- `last_renewed_at`
- `auto_renew_enabled`
- `registrant_contact_json`
- `transfer_lock_state`
- `billing_line_reference`

## Risks

- Underpricing domain management can turn into hidden support cost.
- Domain ownership disputes can become serious if registrant policy is vague.
- Renewal failure can create avoidable outages unless operator reminders are explicit.
- Manual migration support can overwhelm low-margin accounts if not separately billed.

## Recommendation Summary

- Keep subdomain-first onboarding.
- Ship BYOD custom-domain upgrade first.
- Treat managed domain registration as a separate convenience product.
- Price for operational responsibility, not just registry cost.