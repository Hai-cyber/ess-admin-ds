# AI Context — Esskultur Platform

This project is NOT an Odoo-based system.

It is a Cloudflare-native restaurant operating platform.

Core rules:

* Cloudflare Workers implement all business logic
* Cloudflare D1 is the only source of truth
* External systems are integrations only
* Odoo is legacy and will be removed

Current focus:

* booking system
* admin UI
* staff mobile UI

Planned:

* POS system
* TSE integration (Fiskaly)
* modular SaaS features

Do NOT:

* move logic into Odoo
* assume CRM-style workflows
* introduce heavy ERP abstractions

Think:

real-time
event-driven
UI-first
restaurant operations
