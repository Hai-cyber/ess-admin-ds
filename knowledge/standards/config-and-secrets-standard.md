# Standard: Config and Secrets Management

## Principles

- Non-secret operational config can be tenant-managed.
- Sensitive credentials remain backend-only.
- Browser clients never receive raw provider secrets.

## Classification

### Non-Secret (tenant editable)
- business hours
- capacities and area setup
- social public links
- public app IDs

### Secret (backend vault only)
- provider tokens
- API keys
- webhook signing secrets
- social platform access tokens

## Storage

- Non-secret: company settings tables.
- Secret: encrypted organization_secrets with master key from environment.

## Operational Rules

- Every secret write has actor and timestamp.
- Secret status can be shown as set/missing only.
- Rotations must support zero-downtime fallback where possible.
