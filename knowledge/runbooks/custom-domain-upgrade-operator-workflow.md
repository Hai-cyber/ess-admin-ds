# Custom Domain Upgrade Operator Workflow

## Purpose

Describe the admin/operator workflow for moving a tenant from managed subdomain hosting to an active custom domain.

## Scope

This runbook covers:

- request review
- approval
- DNS verification handoff
- activation
- renewal handling guidance

## Workflow Stages

### 1. Request Received

Tenant submits:

- requested domain hostname
- registration mode: `byod` or `managed_registration`
- optional request note

Operator checks:

- tenant identity
- plan/add-on entitlement
- whether hostname format is acceptable for current MVP

Current MVP expectation:

- prefer a hostname like `www.example.com`
- current flow is CNAME-oriented

### 2. Approval

Operator action:

- approve request

Resulting state:

- `approved_waiting_dns`

Operator must confirm:

- commercial approval is okay
- DNS target instructions are visible to tenant

### 3. DNS Ready Handoff

Tenant action:

- configure DNS with provided record
- press `I Configured DNS`

Resulting state:

- `verification_pending`

### 4. DNS Verification

Operator action:

- run DNS verification from the operator queue

Checks:

- correct hostname
- correct record type
- correct target value

Current MVP behavior:

- verification uses DNS-over-HTTPS lookup
- test/local may use `CUSTOM_DOMAIN_DNS_VERIFY_MODE=mock`
- failed verification is written to the domain request event timeline

Resulting state:

- `verified_waiting_activation`

## 5. Activation

Operator action:

- activate verified domain

Resulting state:

- `active`

System effects:

- tenant `custom_domain` setting is updated
- managed subdomain remains available as fallback
- activation health check now validates both `/api/health` and `/api/website/payload` on the custom host

## 6. Rejection

Operator may reject if:

- commercial approval not granted
- tenant submitted invalid hostname
- request duplicates an already active or open workflow
- domain or DNS setup is not acceptable for current MVP

Resulting state:

- `rejected`

Operator should leave a note explaining the reason.

## 7. Renewal Handling

### BYOD

- tenant is responsible for registration and renewal
- platform only manages capability and activation state

### Managed Registration

- operator must track renewal due date
- renewal should be billed as a distinct line item
- failed renewal should trigger operator alert before expiration

## Operator Checklist

### Approval Checklist

- confirm tenant identity
- confirm upgrade entitlement
- confirm hostname is acceptable
- confirm requested mode is understood: `byod` vs `managed_registration`

### Verification Checklist

- confirm DNS record exists
- confirm hostname points to expected target
- confirm tenant expects cutover

### Activation Checklist

- confirm verification completed
- confirm website is ready for public traffic
- confirm fallback subdomain remains available

## Escalation Rules

- If DNS is incorrect, return tenant to `approved_waiting_dns` with a note.
- If commercial approval changes, reject before activation.
- If domain is active but traffic issues occur, keep fallback subdomain accessible.

## Future Automation

After MVP, add:

- renewal reminders
- managed registrar integration