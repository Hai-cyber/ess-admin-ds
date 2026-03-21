# Cloudflare Runtime Structure

This folder defines the target runtime layout for the multi-tenant ESSKULTUR platform.

## Layout

- workers/api/: Core tenant APIs (bookings, customers, founder, settings, staff app feeds).
- workers/kds/: Kitchen display and routing events.
- workers/sms/: OTP and transactional messaging workflows.
- workers/payments/: Payment events and reconciliation handlers.
- workers/control-plane/: Operator-only backend for enabling purchased modules and managing tenant-level policy.
- workers/media-automation/: Media intake and campaign automation triggers.
- durable-objects/: Real-time coordination objects (booking board streams, shared counters, locks).
- queues/: Async processing contracts (booking-sync, media-processing, crm-sync).
- schemas/: JSON and SQL contracts for tenant config and module catalog.
- tests/: Cross-worker integration and contract test plans.

## Why extra workers beyond the initial request?

The requested structure has been extended with:

- workers/control-plane/: Needed for your operator backend to toggle paid services.
- workers/media-automation/: Needed for image uploads and campaign automation pipeline.

These match your stated business model and reduce coupling in the core API worker.
