# Frontend Tenant Self-Service Specification

## Purpose

Define what each restaurant customer can configure from their front admin panel without contacting platform operator support.

## Scope

### A. Operations Configuration

- Business hours open/close.
- Closed weekday rules.
- Booking lead-time and default duration.
- Area capacities (indoor, outdoor, garden, bar, custom zones).

### B. Staff Management

- Add/update/deactivate staff accounts.
- Assign roles (staff, manager, tenant_admin).
- Set PIN or password according to policy.

### C. Social Platform Configuration

- Public social links:
  - facebook_url
  - instagram_url
  - tiktok_url
  - youtube_url
- Optional social login/app IDs (non-secret fields):
  - facebook_app_id
  - google_client_id
- Secret tokens remain backend vault-only.

### D. Marketing Asset Management

- Upload photos/videos used by automation campaigns.
- Tag assets by:
  - campaign_type
  - cuisine
  - season
  - channel
- Enable/disable asset for campaign rotation.

## Out of Scope

- Tenant cannot toggle paid modules unless plan policy permits.
- Tenant cannot read or write encrypted provider secrets directly.

## UX Requirements

- Clear sectioning: Staff, Capacity, Social, Media.
- Save confirmation and validation errors inline.
- Audit note visible: "Last updated by" and timestamp.

## API Requirements

- All writes must include tenant context + authenticated user.
- Payload validation by schema contract.
- Audit event emitted on each successful change.

## Security Requirements

- tenant_admin required for write access.
- staff role can read limited data only.
- Secret fields are masked in UI and status-only where relevant.
