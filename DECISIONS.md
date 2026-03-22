ADR-001: D1 is the source of truth

ADR-002: Odoo is removed entirely — no optional mirror, no sync path. All customer and booking data lives in D1.

ADR-003: Do not build generic ERP features — stay vertical (restaurant operations only)

ADR-004: Build first-party CRM as an internal module (not Odoo, not a third-party CRM). The CRM tracks guest profiles, booking history, notes, tags, and membership status — all scoped per tenant inside D1. 
