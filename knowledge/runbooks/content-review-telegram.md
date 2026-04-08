# Content Review via Telegram Runbook

## Purpose

Guide operator review when tenant website content or subdomain requests are flagged by the abuse protection system.

## When to Use

Use this runbook when Telegram receives a moderation alert for:

- subdomain decision `review`
- publish decision `review`
- publish decision `block`
- repeated abuse reports
- emergency suspension recommendation

## Preconditions

- operator has access to Telegram review channel
- operator has access to platform admin review UI
- moderation record includes reason codes and preview link

## Alert Format

Each Telegram alert should include:

- alert type
- company id and tenant name
- subdomain or host
- trust state
- moderation decision
- risk score
- top reason codes
- preview link
- admin review link
- request timestamp

Example message:

```text
Review required: tenant website publish
Tenant: company_123 / Roma Trattoria
Host: roma.gooddining.app
Decision: review
Risk score: 67
Reasons: suspicious_external_link, political_sensitive_copy
Preview: https://platform.example/review/preview/abc
Admin: https://platform.example/admin/moderation/reviews/review_abc
```

## Review Decision Tree

### Approve immediately

Approve if all are true:

- content matches restaurant business context
- no impersonation, scam, or credential-harvest pattern
- no explicit sexual material
- no hate or targeted abuse
- no high-risk political or religious exploitation on managed host
- links point to expected business destinations

Action:

- approve review in operator admin
- confirm host goes live
- Telegram audit confirmation should be sent automatically

### Reject and request changes

Reject if:

- content is ambiguous and needs tenant clarification
- links or copy are suspicious but not severe enough for suspension
- tenant can likely remediate without abuse escalation

Action:

- reject review with reason note
- keep version unpublished
- ask tenant to update content and republish

### Suspend immediately

Suspend if:

- clear phishing or impersonation exists
- explicit sexual content is present
- hateful or abusive content is present
- malicious redirect or scam payment instruction exists
- operator believes public harm is likely if host remains reachable

Action:

- suspend tenant website in operator admin
- quarantine slug if reuse risk exists
- capture evidence links and screenshots if available
- notify internal ops channel if legal or fraud follow-up may be needed

## Review Checklist

- [ ] Tenant identity appears legitimate
- [ ] Restaurant content matches declared business use
- [ ] No blocked policy category is present
- [ ] Suspicious links were reviewed manually
- [ ] Images appear safe for restaurant website context
- [ ] Reason codes make sense relative to the content
- [ ] Final decision and note are saved

## Telegram Operational Rules

- Telegram is a notification and triage surface, not the source of truth
- final moderation state must be written through platform admin or reviewed API
- avoid approving directly from Telegram unless signed callback verification is implemented
- never rely on free-text chat messages as audit record

## SLA Targets

- `block`: operator acknowledgment within 15 minutes during staffed hours
- `review`: operator decision within 2 business hours
- emergency suspension: execute immediately when clear abuse exists

## Escalation

Escalate to product or legal review when:

- content is politically sensitive and could create platform liability
- content involves religious claims, donations, or grievance mobilization
- a protected brand or public authority may be impersonated
- the tenant disputes repeated moderation outcomes

## Follow-Up After Decision

### After approval

- verify public host resolves correctly
- record operator id and timestamp
- monitor next publish for 7 days if tenant was previously low trust

### After rejection

- send tenant-facing rejection reason using safe standardized copy
- preserve moderation record for future comparisons

### After suspension

- ensure host resolution is disabled
- ensure publish path is blocked
- preserve slug quarantine if needed
- open abuse incident ticket if pattern suggests coordinated misuse