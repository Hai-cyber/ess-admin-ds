#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   export TURNSTILE_SECRET=...
#   export TWILIO_ACCOUNT_SID=...
#   ...
#   ./scripts/set-wrangler-secrets.sh            # default env
#   ./scripts/set-wrangler-secrets.sh production # production env

TARGET_ENV="${1:-}"
ENV_ARGS=()
if [[ -n "$TARGET_ENV" ]]; then
  ENV_ARGS=(--env "$TARGET_ENV")
fi

KEYS=(
  TURNSTILE_SECRET
  TENANT_SECRETS_MASTER_KEY
  TWILIO_ACCOUNT_SID
  TWILIO_AUTH_TOKEN
  TWILIO_WHATSAPP_FROM
  TWILIO_SMS_FROM
  TWILIO_MESSAGING_SERVICE_SID
  FOUNDER_OTP_CHANNELS
  ODOO_BASE_URL
  ODOO_DB_NAME
  ODOO_LOGIN
  ODOO_API_TOKEN
  ODOO_PASSWORD
  ODOO_TAG_FOUNDER
  ODOO_TAG_FOUNDER_TRIAL
  ODOO_TAG_KC_CLUB
  ODOO_TAG_KOLLEGENSCLUB
)

echo "Setting Wrangler secrets ${TARGET_ENV:+for env '$TARGET_ENV'}..."

for key in "${KEYS[@]}"; do
  value="${!key-}"
  if [[ -z "$value" ]]; then
    echo "- Skipped $key (not set in shell)"
    continue
  fi

  printf "%s" "$value" | npx wrangler secret put "$key" "${ENV_ARGS[@]}" >/dev/null
  echo "- Set $key"
done

echo "Done."
