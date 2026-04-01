# ESSKULTUR — Restaurant OS

**Not an ERP. Not a Odoo clone. Not generic.**

## What we build

👉 **Vertical SaaS for restaurant operations**

- Multi-tenant Cloudflare-native platform
- Purpose-built for restaurants (booking → POS → payment → CRM → loyalty)
- Real-time, event-driven, designed for staff efficiency and guest experience
- First-party CRM: guest profiles, booking history, notes, tags — no Odoo needed
- Self-serve signup: restaurant owner visits platform site, picks tier, gets provisioned in minutes

---

## Product Positioning

### We are

- **Restaurant OS**: Operating system for modern restaurants
- **Multi-tenant SaaS**: Each restaurant has isolated data, shared infrastructure
- **Cloudflare-native**: Workers execute business logic, D1 is the source of truth
- **Vertical focus**: Built specifically for restaurants, not horizontally for all businesses

### We are NOT

- ERP system
- Odoo (we cut it entirely — we build our own CRM)
- Generic business platform
- Tool built for enterprises first

---

## Core Capabilities (Phases)

| Phase | Focus | Modules |
|-------|-------|---------|
| **1** | Booking + Admin | Booking system (online + onsite), Admin UI, Staff mobile |
| **2** | Staff Mobile + POS | Mobile-first UI, table management, order flow, kitchen workflow |
| **3** | Payment + Compliance | Stripe integration, TSE (Fiskaly), receipts |
| **4** | CRM + Odoo Cut | First-party CRM module, hard-remove all Odoo/Make.com integrations |
| **5** | Growth | Loyalty, shop, marketing, multi-location |

---

## User Surfaces

1. **`gooddining.app`** — Platform marketing site: features, pricing tiers, signup (no tenant context)
2. **`{subdomain}.gooddining.app`** — Tenant website template: the restaurant's public-facing site (website, contact, service-tier modules)
3. **`gooddining.app/platform/admin`** — SaaS Admin: pricing, web builder studio defaults, signup CRM-lite, follow-up workflow
4. **`{subdomain}.gooddining.app/admin`** — Restaurant Admin (tenant admin): domain, payment method, website builder studio, staff, reports, restaurant operations config
5. **`{subdomain}.gooddining.app/app`** — Staff app: booking board, stage management, POS

---

## User Society

- **Prospect** (restaurant owner browsing): visits `gooddining.app`, compares tiers, signs up
- **Platform Operator**: manages SaaS pricing, signup CRM-lite, follow-up, global web-builder defaults
- **Restaurant Owner/Admin**: completes setup wizard, configures tenant settings, domain, payment method, manages staff
- **Staff (hostess, bartender, manager)**: Mobile app, daily operations
- **Table Guest**: visits tenant website, fills in booking form, no account needed

## Admin Separation

- **SaaS Admin**: simple operator console for the platform business itself. Scope: pricing, signup leads, CRM-lite follow-up, global platform copy, builder defaults.
- **Restaurant Admin**: tenant-scoped operational console for each restaurant. Scope: domain, payment setup, website builder content, staff, bookings, reports, module toggles.
- Rule: platform business concerns must not be mixed into tenant restaurant admin.

---

## Technology Stack

- **Frontend**: HTML/JS/React (tenant-specific sub-apps)
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Integrations**: Stripe, PayPal-capable flows, cash/card acceptance support, Apple Pay capable gateways, Twilio, TSE providers, email services
- **Hosting**: Cloudflare global network

---

## Business Model

### Standard pricing (per user per month)

- **Core (€29)**: Website builder, booking, POS basic, payments, admin + staff UI
- **Commerce (€69)**: Everything Core + shop, delivery, advanced booking management  
- **Growth (€99)**: Everything Commerce + discount/loyalty, marketing automation, SEO
- **Enterprise**: Custom (multi-location, advanced reporting, role hierarchy)

### Additional revenue

- One-time setup fees
- IT support / customization
- TSE integration (pass-through cost)
- Premium support tier

---

## Success Metrics

- Restaurant onboarding time: < 1 hour
- Staff adoption: daily active use
- Payment processing: < 2s latency
- System uptime: 99.9%
- Booking-to-revenue conversion: tracked per tenant

---

## Guiding Principles

1. **Real-time**: No batch delays, instant updates for staff and guests
2. **Tenant-first**: Every row in every table includes `tenant_id`
3. **Mobile-first**: Staff works on phones, simple UI
4. **Event-driven**: State changes trigger notifications and workflows
5. **No Odoo logic**: Cloudflare Workers are the business logic, not external systems
6. **One-screen-one-job**: UX principle — each screen has one clear purpose
