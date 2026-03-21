# Multi-Tenant Platform Specification

## 1. Tenant Model

### Entities

- Organization: External customer account that can own one or more restaurants.
- Company (Restaurant): Operational tenant unit used by website, staff app, booking board, and settings.

### Isolation Rules

- Every business record includes company_id.
- Organization-level defaults can be inherited by company-level settings.
- Secrets are never exposed to browser clients.

## 2. Application Boundaries

### Shared Runtime

- One Cloudflare deployment with tenant routing.
- Subdomain-based tenant detection for public and staff entry points.

### Isolated Runtime Behavior

- Booking and customer data resolved by tenant context.
- Module access checks enforced server-side.
- Tenant-configurable UI values read from D1 settings.

## 3. Paid Module Control

### Operator Control Plane

- Enable or disable modules per company.
- Record activation metadata: who, when, reason, billing plan.
- Deny access to protected endpoints when module disabled.

### Tenant Visibility

- Tenant admin can see active modules.
- Tenant admin cannot enable paid modules unless policy allows self-upgrade.

## 4. Core Services

- API worker: Booking, founder, settings, staff auth, tenant admin.
- KDS worker: Kitchen routing and status transitions.
- SMS worker: OTP and transactional messages.
- Payments worker: Event intake and billing status sync.
- Media automation worker: Asset processing and campaign triggers.
- Control plane worker: Platform operator backend.

## 5. Tenant Self-Service Config Scope

- Staff roster and roles.
- Area and capacity blocks.
- Business hours and booking constraints.
- Social auth/public links per channel.
- Marketing media uploads and tagging.

## 6. Security and Compliance

- RBAC: operator_admin, tenant_admin, staff.
- Audit logs for all privileged writes.
- Encrypted tenant secrets with environment-provided master key.
- Validation contracts for all config payloads.

## 7. Data Contracts

- Config payloads validated against cloudflare/schemas/tenant-config.schema.json.
- Module definitions validated against cloudflare/schemas/module-catalog.schema.json.

## 8. Acceptance Criteria

- Tenant A settings cannot read/write Tenant B.
- Disabling a module blocks related routes immediately.
- Tenant admin can update allowed operational variables.
- Media uploads produce queue events for automation.
- Operator can toggle services from control plane with audit metadata.
