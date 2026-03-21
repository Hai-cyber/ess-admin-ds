#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

required_paths=(
  "cloudflare/workers/api"
  "cloudflare/workers/kds"
  "cloudflare/workers/sms"
  "cloudflare/workers/payments"
  "cloudflare/workers/control-plane"
  "cloudflare/workers/media-automation"
  "cloudflare/durable-objects"
  "cloudflare/queues"
  "cloudflare/schemas"
  "cloudflare/tests"
  "knowledge/adr"
  "knowledge/specs"
  "knowledge/runbooks"
  "knowledge/apis"
  "knowledge/standards"
  ".github/workflows"
)

required_files=(
  "README.md"
  "knowledge/specs/project-overview.md"
  "knowledge/specs/multi-tenant-platform-spec.md"
  "knowledge/specs/frontend-self-service-spec.md"
  "knowledge/specs/media-automation-spec.md"
  "knowledge/apis/control-plane-api.md"
  "knowledge/apis/tenant-admin-api.md"
  "cloudflare/schemas/tenant-config.schema.json"
  "cloudflare/schemas/module-catalog.schema.json"
  ".github/workflows/ci.yml"
)

echo "Validating required directories..."
for p in "${required_paths[@]}"; do
  if [[ ! -d "${ROOT_DIR}/${p}" ]]; then
    echo "Missing directory: ${p}" >&2
    exit 1
  fi
done

echo "Validating required files..."
for f in "${required_files[@]}"; do
  if [[ ! -f "${ROOT_DIR}/${f}" ]]; then
    echo "Missing file: ${f}" >&2
    exit 1
  fi
done

echo "Validating JSON contracts..."
node <<'NODE'
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const files = [
  'cloudflare/schemas/tenant-config.schema.json',
  'cloudflare/schemas/module-catalog.schema.json',
  'cloudflare/schemas/module-catalog.sample.json',
  'cloudflare/queues/queue-contracts.json'
];
for (const file of files) {
  const fullPath = path.join(root, file);
  const raw = fs.readFileSync(fullPath, 'utf8');
  JSON.parse(raw);
}
console.log('JSON files parsed successfully');
NODE

echo "Structure validation passed."
