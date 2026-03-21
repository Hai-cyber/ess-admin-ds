# Secrets and Credentials Setup

This project integrates with Cloudflare Turnstile, Twilio, and direct Odoo API sync.

## Variables by party

- Cloudflare Turnstile
  - TURNSTILE_SECRET
- Tenant secret vault
  - TENANT_SECRETS_MASTER_KEY
- Twilio
  - TWILIO_ACCOUNT_SID
  - TWILIO_AUTH_TOKEN
  - TWILIO_WHATSAPP_FROM
  - TWILIO_SMS_FROM
  - TWILIO_MESSAGING_SERVICE_SID
  - FOUNDER_OTP_CHANNELS
Per-tenant Odoo API/tag settings are managed in company integration config (D1 settings), not global Wrangler secrets:

- ODOO_BASE_URL
- ODOO_DB_NAME
- ODOO_LOGIN
- ODOO_API_TOKEN
- ODOO_PASSWORD (optional fallback; prefer API token)
- ODOO_TAG_FOUNDER
- ODOO_TAG_FOUNDER_TRIAL
- ODOO_TAG_KC_CLUB
- ODOO_TAG_KOLLEGENSCLUB
- ODOO_FOUNDER_CREATE_WEBHOOK (optional legacy fallback)
- ODOO_FOUNDER_VERIFY_WEBHOOK (optional legacy fallback)

## Local development

1. Copy [.dev.vars.example](../.dev.vars.example) to .dev.vars
2. Fill real values
3. Run local worker:

npm run dev

Wrangler automatically loads .dev.vars in local development.

Generate the tenant secret vault master key once per environment:

openssl rand -base64 32

This key is used to encrypt customer-level secrets stored in D1. Keep it only in local .dev.vars and Wrangler secrets.

## Cloudflare Worker secrets (remote)

You can set all secrets from exported shell variables with one command.

### Default environment

1. Export values in your shell:

export TURNSTILE_SECRET='...'
export TENANT_SECRETS_MASTER_KEY='...'
export TWILIO_ACCOUNT_SID='...'
export TWILIO_AUTH_TOKEN='...'
export TWILIO_WHATSAPP_FROM='whatsapp:+14155238886'
export TWILIO_SMS_FROM='+49...'
export TWILIO_MESSAGING_SERVICE_SID='MG...'
export FOUNDER_OTP_CHANNELS='sms'

2. Apply:

npm run secrets:set

### Production environment

Use the same exported variables, then:

npm run secrets:set:prod

## Notes

- Non-sensitive defaults are already declared in [wrangler.jsonc](../wrangler.jsonc) for:
  - FOUNDER_OTP_CHANNELS
  - TWILIO_WHATSAPP_FROM
  - TWILIO_SMS_FROM
  - TWILIO_MESSAGING_SERVICE_SID
- Current default is SMS-first OTP delivery: `FOUNDER_OTP_CHANNELS=sms`.
- If you want WhatsApp fallback, set: `FOUNDER_OTP_CHANNELS=whatsapp,sms`.
- Keep all real credentials in .dev.vars (local) and Wrangler secrets (remote).
- Tenant-specific backend secrets can now be resolved from the organization secret vault when TENANT_SECRETS_MASTER_KEY is configured.
- Do not commit real credentials.
- For multi-tenant Odoo setups, set ODOO_DB_NAME / ODOO_LOGIN / ODOO_API_TOKEN per company in Admin -> Integrations.
- Founder/KC sync primarily uses direct Odoo JSON-RPC.
- If direct Odoo API config is missing for a tenant, optional legacy webhook fallback is supported via ODOO_FOUNDER_CREATE_WEBHOOK and ODOO_FOUNDER_VERIFY_WEBHOOK.

## Founder and booking form query variables

Founder and booking forms support runtime query variables such as language override,
hidden optional email prefill, and KC mode terminology overrides.

See full reference:

[docs/FORM_QUERY_VARIABLES.md](./FORM_QUERY_VARIABLES.md)

## Twilio incoming webhook (OTP verify by reply)

Set your Twilio Messaging webhook URL to:

`https://<your-worker-domain>/webhooks/twilio/founder-otp`

- Method: `POST`
- Content type: `application/x-www-form-urlencoded` (Twilio default)
- This endpoint accepts inbound OTP replies (SMS/WhatsApp) and returns TwiML.

## Founder iframe embed snippet

Use this on your website test page:

```html
<iframe
  id="founder-form"
  src="https://<your-worker-domain>/founder"
  style="width:100%;max-width:640px;height:760px;border:0;display:block;margin:0 auto;background:transparent;"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>

<script>
  window.addEventListener('message', function (event) {
    if (!event || !event.data || event.data.type !== 'ESS_FOUNDER_HEIGHT') return;
    var iframe = document.getElementById('founder-form');
    if (iframe && Number.isFinite(event.data.height)) {
      iframe.style.height = Math.max(720, Number(event.data.height)) + 'px';
    }
  });
</script>
```
