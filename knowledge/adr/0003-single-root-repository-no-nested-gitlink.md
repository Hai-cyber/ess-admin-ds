# ADR 0003: Single Root Repository, No Nested Gitlinks

## Status

Accepted

## Context

The project previously contained a nested `ess-admin-ds` gitlink inside the main repository.

This caused several problems:

- engineers could edit files in the wrong repository copy
- tests could run twice because both root and nested test trees were present
- repository structure in the workspace became misleading
- deployment and CI reasoning became harder because the actual runtime source was ambiguous
- the nested gitlink was not backed by a valid `.gitmodules` mapping, so it behaved like a broken submodule setup

## Decision

Use a single root repository as the only source of truth.

Rules:

- no nested git repositories inside the project root
- no gitlinks or submodule-style entries for the application source tree
- runtime code, docs, knowledge, public assets, and tests must live directly under the root repository
- local editor artifacts and generated runtime folders must be ignored unless explicitly approved as shared repo configuration

## Consequences

### Positive

- one canonical working tree for code, docs, and tests
- simpler CI, deploy, and local development flows
- less risk of committing changes to the wrong place
- easier onboarding because project structure matches actual runtime structure

### Negative

- external code reuse cannot rely on nested git repos as an organizational shortcut
- future attempts to vendor another repo into the tree must use a deliberate import strategy instead of ad hoc nesting

## Guardrails

- Keep `.gitignore` strict for generated local tooling artifacts.
- Treat `.vscode/settings.json` as shared config, but keep machine-specific launch or temporary files out of git unless intentionally standardized.
- If external code history must be preserved in the future, prefer an explicit subtree or separate package strategy with written ownership.
