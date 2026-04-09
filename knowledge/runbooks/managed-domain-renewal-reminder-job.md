# Managed Domain Renewal Reminder Job

## Purpose

Define the reminder job that surfaces `renewal_due_soon` and `renewal_overdue` managed-domain requests before they cause outages or billing confusion.

## Inputs

- `custom_domain_requests.renewal_mode`
- `custom_domain_requests.renewal_status`
- `custom_domain_requests.renewal_due_at`
- `custom_domain_requests.renewal_last_reminded_at`
- `custom_domain_requests.auto_renew_enabled`

## Candidate Selection

The reminder job should consider only:

- `registration_mode = managed_registration`
- `renewal_mode = platform_managed`
- `request_status = active`

## Derived States

- `managed_active`: due date more than 30 days away
- `renewal_due_soon`: due date within 30 days
- `renewal_overdue`: due date in the past

## Reminder Policy

Recommended reminder windows:

- 30 days before due date
- 14 days before due date
- 7 days before due date
- 1 day before due date
- overdue day 1
- overdue day 7

## Outputs

The first implementation does not need external sending. It should at least:

- update `renewal_status`
- stamp `renewal_last_reminded_at`
- create a `custom_domain_request_events` reminder event
- surface renewal attention in SaaS admin filters

## Delivery Channels

Initial channels can be manual/operator-facing:

- SaaS Admin queue filter
- operator email digest
- future queue/cron worker output

## Implemented Runtime Shape

- A platform-admin route can run reminders manually: `/api/platform/admin/domain-renewals/run-reminders`
- The Worker now exposes a `scheduled` handler for production cron execution
- The production env cron is configured in `wrangler.jsonc`

## Suggested Future Worker Shape

1. Select active managed-registration domains.
2. Compute `daysUntilDue` from `renewal_due_at`.
3. Determine next reminder threshold.
4. Skip if `renewal_last_reminded_at` already covers the current threshold.
5. Update the request row and insert an audit event.

## Failure Rules

- Never downgrade `active` domain capability automatically from reminder logic alone.
- Never modify `custom_domain` mapping from reminder logic.
- Reminder job is advisory until renewal/payment automation exists.

## Follow-up Implementation

- Add scheduled worker or cron trigger
- Add operator digest channel
- Add customer-facing renewal notification channel
- Add billing hook for managed renewal invoices