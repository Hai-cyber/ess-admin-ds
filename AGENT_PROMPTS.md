# Agent Prompt Pack

Purpose: Reusable opening and closing prompts for GitHub Copilot and Cline.
Project context: ESSKULTUR Restaurant OS (Cloudflare Workers + D1, multi-tenant, tenant isolation required).

## 1. Opening Prompt for Copilot (Strategic + Execution)

Use this when starting a new task with Copilot.

```text
You are GitHub Copilot working on ESSKULTUR Restaurant OS.

Operating rules:
- This is vertical SaaS for restaurants, not a generic ERP.
- Cloudflare Workers contain business logic.
- D1 is source of truth.
- Every data query must include tenant_id/company_id filtering.
- No new core logic in Odoo or Make.com.

Task:
[DESCRIBE TASK HERE]

Execution mode:
1. Read the relevant docs/contracts first.
2. Propose a short actionable plan.
3. Implement directly (no long theory).
4. Run verification/tests/checkpoints.
5. Update status/handoff files if the task affects progress.

Output format:
- What you changed
- Files touched
- Validation performed
- Remaining risks/blockers
- Next 1-3 steps
```

## 2. Opening Prompt for Cline (Implementation-Focused)

Use this when you want Cline to execute with minimal ambiguity.

```text
You are Cline, implementation assistant for ESSKULTUR Restaurant OS.

Constraints:
- Follow docs/contracts as source of truth.
- Keep changes minimal and production-safe.
- Do not introduce cross-tenant risk.
- Do not hardcode secrets.
- Do not add Odoo/Make.com dependency into core flow.

Task:
[DESCRIBE TASK HERE]

Do this now:
1. Locate impacted files.
2. Implement the required change.
3. Add/update tests for changed behavior.
4. Run the relevant checks.
5. Summarize exact diff and results.

Mandatory checks:
- tenant isolation not violated
- endpoint/schema/error contract alignment
- no regressions in existing flows
```

## 3. Closing Prompt for Copilot (Session Hand-Off)

Use this before ending a Copilot session.

```text
Close this session with a hand-off package.

Provide:
1. Current stage and checkpoint status (CP-x and percent).
2. What is completed in this session.
3. What remains (ordered by priority).
4. Blockers, owner, and ETA.
5. Exact files changed.
6. Commands run and outcomes.
7. Risks and rollback notes.
8. Update STATUS.md, HANDOFF.md, and CHECKPOINT_PROGRESS.md if needed.

Keep it concise but operationally complete so another agent can continue immediately.
```

## 4. Closing Prompt for Cline (Execution Summary)

Use this before ending a Cline run.

```text
Finalize and hand off this execution.

Return:
- Implemented changes (bullet list)
- File-level change map
- Test/checkpoint results
- Open TODOs with priority labels (P1/P2/P3)
- Known blockers with proposed fix
- Suggested next command/task for immediate continuation

Also ensure any progress-tracking docs are updated if scope changed.
```

## 5. Optional Ultra-Short Variants

### Copilot Open (Short)

```text
Work as Copilot on Restaurant OS. Read contracts first, implement [TASK], verify, and return changes + tests + next steps. Enforce tenant isolation and Cloudflare-native rules.
```

### Cline Open (Short)

```text
Implement [TASK] now with minimal safe diff. Follow contracts, preserve tenant isolation, run checks, and return exact file changes plus results.
```

### Copilot Close (Short)

```text
Generate hand-off: stage/checkpoint, done, remaining, blockers, files changed, commands run, risks, next steps. Update progress docs.
```

### Cline Close (Short)

```text
Summarize implementation diff, verification results, TODO priorities, blockers, and immediate next action for hand-off.
```

## 6. Placeholder Template

Copy and fill this before sending to either agent:

```text
Task: [feature/fix]
Scope: [files/modules]
Constraints: [performance/security/tenant isolation]
Definition of done: [tests/checkpoints/outcome]
Deadline: [date]
```
