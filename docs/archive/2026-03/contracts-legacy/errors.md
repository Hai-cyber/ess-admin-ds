# Error Code Reference

## Tenant Resolution Errors

Returned by [`requireTenant()` guard](tenant.md):

```js
{
  ok: false,
  error: "error_code"  // string identifier
}
// HTTP status from mapping
```

| Error Code | HTTP | Description | Reason |
|------------|------|-------------|--------|
| `tenant_required` | 400 | No tenant context (main domain, no query override) | `unresolved` or `no_tenant_context` |
| `tenant_subdomain_not_found` | 404 | Subdomain does not map to a company | `tenant_subdomain_not_found` |
| `tenant_company_not_found` | 404 | Company ID extracted but not found in DB | `tenant_company_not_found` |
| `company_not_found` | 404 | Query `?company_id=N` but company does not exist | `override_company_not_found` |
| `company_id_override_not_allowed` | 403 | Query `?company_id=N` on non-local host | `override_not_allowed` |
| `db_unavailable` | 503 | D1 binding missing or DB error | `db_unavailable` |
| `tenant_table_missing` | 503 | `companies` table not initialized | `companies_table_missing` |
| `tenant_resolution_error` | 500 | Unexpected error in resolver | `resolution_error` |

---

## Application-Level Errors

### Membership Flow

| Status | Error | Meaning |
|--------|-------|----------|
| 403 | `Community membership is disabled. Please use the standard contact form.` | Module `module_membership_management` disabled; fallback link provided |
| 400 | `Name und Mobiltelefon sind erforderlich.` | Missing required field |
| 400 | `Bitte geben Sie eine gueltige E-Mail-Adresse ein.` | Email format invalid |
| 400 | `Bitte akzeptieren Sie die erforderlichen Einwilligungen.` | Missing consent (SMS or terms) |
| 400 | `Sicherheitspruefung fehlgeschlagen.` | Turnstile CAPTCHA failed |
| 409 | `Diese Mobiltelefonnummer ist bereits registriert.` | Phone exists, already verified |
| 429 | `Bitte warten Sie ${waitSec}s bevor Sie einen neuen OTP anfordern.` | OTP cooldown active |
| 500 | `Interner Fehler bei der Registrierung.` | OTP send or sync failed |

### Booking Flow

| Status | Error | Meaning |
|--------|-------|----------|
| 403 | `Booking management module is disabled` | Module `module_booking_management` disabled |
| 400 | `Invalid email format` | Email validation failed |
| 400 | `CAPTCHA verification failed` | Turnstile failed |
| 400 | `Missing required fields` | date, time, pax, name, or phone not provided |
| 403 | `company_id_override_not_allowed` | Cross-tenant body override blocked |
| 404 | `Booking not found` | Booking ID or company mismatch |
| 500 | Generic error message | DB or processing error |

### Staff & Admin

| Status | Error | Meaning |
|--------|-------|----------|
| 401 | `Staff PIN required` | Missing `?pin=` or header |
| 401 | `Invalid PIN` | PIN does not match staff record |
| 403 | `Staff account is inactive` | Staff record has `is_active = 0` |
| 403 | `Manager or admin role required` | User role insufficient |
| 404 | `Contact not found` | Contact ID or company mismatch |

---

## Guard Response Template

```js
// In src/utils/tenant-guard.js:1-31
const map = {
  'db_unavailable': [503, 'db_unavailable'],
  'companies_table_missing': [503, 'tenant_table_missing'],
  'resolution_error': [500, 'tenant_resolution_error'],
  'override_not_allowed': [403, 'company_id_override_not_allowed'],
  'override_company_not_found': [404, 'company_not_found'],
  'tenant_company_not_found': [404, 'tenant_company_not_found'],
  'tenant_subdomain_not_found': [404, 'tenant_subdomain_not_found'],
  'no_tenant_context': [400, 'tenant_required'],
  'unresolved': [400, 'tenant_required']
};
const [status, errorCode] = map[reason] || [400, reason];
return Response.json({ ok: false, error: errorCode }, { status });
```
