# Test Strategy (Target)

## Layers

- Contract tests: schema and API response contracts.
- Worker integration tests: cross-worker message flow.
- Tenant isolation tests: cross-company access denial checks.
- Module gating tests: paid service enable/disable behavior.

## Minimum CI Gate

- Required folders and docs exist.
- JSON schemas parse.
- Structural contract checks pass.
