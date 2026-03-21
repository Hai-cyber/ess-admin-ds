# Project Overview: ESSKULTUR SaaS Platform

## Vision

Build a shared Cloudflare SaaS platform that serves multiple restaurant customers with strict tenant isolation and configurable feature bundles.

## Business Model

- Shared codebase, isolated tenant data and settings.
- Each customer can operate its own:
  - Website and booking frontend.
  - Staff app and booking board.
  - Email and notifications.
  - POS and operational settings.
- Platform operator (you) controls paid modules in a central backend control plane.

## Actors

- Platform Operator (you): Manages tenants, purchased modules, service activation, compliance.
- Tenant Admin: Manages own staff, areas, capacities, social links, and media assets.
- Staff User: Uses daily staff app for bookings and workflow.
- Customer Guest: Uses website forms and receives notifications.

## Core Product Surfaces

- Tenant Website: Booking, founder/membership, marketing pages.
- Staff App: Booking stage actions and notifications.
- Booking Board/KDS: Real-time table flow and kitchen routing.
- Tenant Front Admin: Self-service operational configuration.
- Operator Control Plane: Service toggles and account governance.

## Product Modules (Commercial)

- SEO management.
- Media management.
- Membership management.
- Marketing automation.
- Optional: Loyalty, CRM contact flows, messaging channels.

## Non-Functional Requirements

- Tenant data isolation by default.
- Secrets managed backend-only.
- Audit trails for module toggles and privileged changes.
- Config inheritance: organization defaults + restaurant overrides.
- Queue-driven asynchronous integrations.

## Delivery Phases

1. Structure and contracts (this scaffold).
2. Control plane APIs and module policy engine.
3. Tenant front admin self-service endpoints.
4. Media upload and automation queues.
5. Full CI contract checks and integration tests.
