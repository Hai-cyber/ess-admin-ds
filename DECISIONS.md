ADR-001: D1 is the source of truth

ADR-002: Odoo is removed entirely — no optional mirror, no sync path. All customer and booking data lives in D1.

ADR-003: Do not build generic ERP features — stay vertical (restaurant operations only)

ADR-004: Build first-party CRM as an internal module (not Odoo, not a third-party CRM). The CRM tracks guest profiles, booking history, notes, tags, and membership status — all scoped per tenant inside D1. 

ADR-005: Tenant onboarding is subdomain-first. No restaurant is required to bring or buy a custom domain before first go-live.

ADR-006: Custom domain is an entitlement-based upgrade capability, not a signup prerequisite and not a hard-coded plan gate.

ADR-007: Commercial approval for custom-domain use is separate from DNS verification and domain activation.

ADR-008: Managed subdomains remain active after custom-domain activation for fallback, preview, rollback, and support.

ADR-009: Managed domain registration is an optional convenience product. The platform should not optimize for undercutting Cloudflare on raw domain price; it should optimize for simple billing and managed support.
