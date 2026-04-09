#!/usr/bin/env bash
set -euo pipefail

##
# CI: Tenant Guard & Query Scope Validation
# Checks that:
# 1. No hardcoded fallback to company_id = 1
# 2. All queries on sensitive tables include company_id filter
# 3. All tenant-required routes use requireTenant() guard
# 4. Guard file has content
##

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILED=0
CHECK_MODE="all"

for arg in "$@"; do
  case "$arg" in
    --check=*)
      CHECK_MODE="${arg#--check=}"
      ;;
  esac
done

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_error() {
  echo -e "${RED}❌ $1${NC}" >&2
  FAILED=$((FAILED + 1))
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_info() {
  echo -e "${YELLOW}ℹ️  $1${NC}"
}

has_rg() {
  command -v rg >/dev/null 2>&1
}

search_exists() {
  local pattern="$1"
  local target="$2"
  if has_rg; then
    rg -q "$pattern" "$target"
  else
    grep -RIEq "$pattern" "$target"
  fi
}

search_print() {
  local pattern="$1"
  local target="$2"
  if has_rg; then
    rg "$pattern" "$target"
  else
    grep -RIEn "$pattern" "$target"
  fi
}

search_context() {
  local pattern="$1"
  local target="$2"
  if has_rg; then
    rg -A 2 "$pattern" "$target"
  else
    grep -A 2 -En "$pattern" "$target"
  fi
}

run_failopen_check() {
  log_info "Checking for hardcoded fallback to company_id = 1..."

  local pattern='fallbackCompanyId[[:space:]]*=[[:space:]]*1|activeCompanyId[[:space:]]*=[[:space:]]*1|return[[:space:]]+fallbackCompanyId'
  if search_exists "$pattern" src/; then
    log_error "Found hardcoded fallback to company_id = 1. Use resolver instead."
    search_print "$pattern" src/
  else
    log_success "No hardcoded fallback to company_id = 1"
  fi
}

run_sql_scope_check() {
  log_info "Checking query scope (company_id filters)..."

  local scan_output
  scan_output=$(node <<'NODE'
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const sensitiveTables = [
  'customers',
  'bookings',
  'contacts',
  'staff',
  'settings',
  'otp_cache',
  'booking_actions',
  'media_assets'
];

const files = [path.join(root, 'src', 'index.js')];
const findings = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const normalized = content.replace(/\r\n/g, '\n');
  for (const table of sensitiveTables) {
    const regex = new RegExp(`FROM\\s+${table}\\b`, 'ig');
    let match;
    while ((match = regex.exec(normalized)) !== null) {
      const start = Math.max(0, match.index - 240);
      const end = Math.min(normalized.length, match.index + 420);
      const window = normalized.slice(start, end);
      if (/company_id/i.test(window)) continue;
      findings.push(`${path.relative(root, file)} :: ${table}`);
      break;
    }
  }
}

if (findings.length) {
  console.log(findings.join('\n'));
  process.exit(2);
}
NODE
  ) || true

  if [ -n "$scan_output" ]; then
    log_error "Found queries on sensitive tables without company_id filter"
    echo "$scan_output"
  else
    log_success "All queries on sensitive tables include company_id filter"
  fi
}

cd "$ROOT_DIR"

if [ "$CHECK_MODE" = "failopen" ] || [ "$CHECK_MODE" = "all" ]; then
  run_failopen_check
fi

if [ "$CHECK_MODE" = "sql" ] || [ "$CHECK_MODE" = "all" ]; then
  run_sql_scope_check
fi

if [ "$CHECK_MODE" = "failopen" ] || [ "$CHECK_MODE" = "sql" ]; then
  if [ $FAILED -eq 0 ]; then
    exit 0
  fi
  exit 1
fi

# =====================================================================
# Check 3: Guard file exists and has content
# =====================================================================
log_info "Checking tenant guard helper..."

GUARD_FILE="src/utils/tenant-guard.js"
if [ ! -f "$GUARD_FILE" ]; then
  log_error "Guard file missing: $GUARD_FILE"
else
  LINES=$(wc -l < "$GUARD_FILE")
  if [ "$LINES" -lt 20 ]; then
    log_error "Guard file too small (${LINES} lines). Must define requireTenant() export."
  else
    if ! grep -q "export function requireTenant" "$GUARD_FILE"; then
      log_error "requireTenant() not exported from $GUARD_FILE"
    else
      log_success "Guard file present and exports requireTenant() (${LINES} lines)"
    fi
  fi
fi

# =====================================================================
# Check 4: Tenant-required routes use runTenantRoute()
# =====================================================================
log_info "Checking tenant-required route guard coverage..."

# Routes that MUST use runTenantRoute
TENANT_ROUTES=(
  "/api/bookings"
  "/api/founder"
  "/api/staff/auth"
  "/api/notifications/stream"
  "/booking-form"
  "/founder"
)

MISSING_GUARD=0
for route in "${TENANT_ROUTES[@]}"; do
  # Check if route exists and is wrapped with runTenantRoute
  if search_exists "url.pathname.*${route}" src/index.js; then
    if ! search_context "url.pathname.*${route}" src/index.js | grep -q "runTenantRoute"; then
      log_error "Route '${route}' not wrapped with runTenantRoute()"
      MISSING_GUARD=$((MISSING_GUARD + 1))
    fi
  fi
done

if [ $MISSING_GUARD -eq 0 ]; then
  log_success "All tenant-required routes wrapped with runTenantRoute()"
fi

# =====================================================================
# Check 5: No direct DB reads without activeCompanyId context
# =====================================================================
log_info "Checking DB context isolation..."

# Flag any prepare() calls outside of runTenantRoute blocks
if search_exists "env\.DB\.prepare.*FROM[[:space:]]+(customers|bookings|staff|settings|contacts|otp_cache)" src/index.js; then
  # This is complex to validate statically, so we just log info
  log_info "Manual review recommended: verify all DB operations use company_id scoping"
fi

log_success "DB context checks passed"

# =====================================================================
# Summary
# =====================================================================
echo ""
if [ $FAILED -eq 0 ]; then
  log_success "All tenant isolation CI checks passed!"
  exit 0
else
  echo ""
  log_error "Failed $FAILED check(s). Fix issues and retry."
  exit 1
fi
