# Runbook: Toggle Paid Modules

## Objective

Enable or disable commercial service modules for a specific restaurant tenant.

## Preconditions

- Operator account with control-plane access.
- Company exists and is mapped to organization.

## Procedure

1. Open control-plane tenant detail.
2. Review current module map and billing status.
3. Apply module changes with explicit reason.
4. Save changes and confirm audit event is written.
5. Trigger cache refresh for tenant runtime config.
6. Verify tenant UI reflects new module state.
7. Validate protected endpoint behavior:
   - enabled module endpoint returns success path
   - disabled module endpoint returns module-aware 403

## Rollback

- Reapply previous module state using audit history snapshot.
- Record rollback reason.

## Evidence

Capture:
- company_id
- module keys changed
- actor
- timestamp
- ticket or contract reference
