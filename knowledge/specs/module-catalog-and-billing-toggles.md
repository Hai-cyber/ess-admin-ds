# Module Catalog and Service Toggle Spec

## Purpose

Formalize how your operator backend enables services customers purchase.

## Module Catalog (initial)

- module_seo_management
- module_media_management
- module_membership_management
- module_marketing_management
- module_loyalty_rewards
- module_contact_crm
- module_booking_automation

## Control Plane Responsibilities

- Enable/disable modules per company.
- Track commercial metadata:
  - plan_code
  - activated_at
  - activated_by
  - source (manual, billing_webhook, promo)
- Emit audit event on every module state change.

## Enforcement Rules

- Protected feature endpoints must call module gate checks.
- Disabled module returns a product-aware 403 payload with module code.
- UI adapts to module state from backend response.

## Billing Integration Hooks

- payments worker can emit entitlement updates.
- control-plane worker applies entitlement state to module toggles.

## Audit Requirements

- Record old_state, new_state, actor, reason, company_id, timestamp.
- Keep immutable toggle history for support and compliance.
