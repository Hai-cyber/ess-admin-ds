/**
 * Tenant Guard Coverage Validator
 * 
 * Validates that tenant-required routes are properly wrapped with guards.
 * Can be run as part of test suite or CI pipeline.
 */

import fs from 'fs';
import path from 'path';

/**
 * Routes that MUST be wrapped with requireTenant() guard
 */
const TENANT_REQUIRED_ROUTES = [
  '/api/bookings',
  '/api/bookings/create',
  '/api/bookings/:id/stage',
  '/api/founder/register',
  '/api/founder/verify',
  '/api/founder/resend-otp',
  '/api/kc/register',
  '/api/kc/verify',
  '/api/kc/resend-otp',
  '/api/staff/auth',
  '/api/notifications/stream',
  '/api/contacts',
  '/api/contacts/:id/push',
  '/api/admin/platform-config',
  '/api/admin/staff',
  '/api/admin/media-assets',
  '/api/admin/integration-config',
  '/api/customers',
  '/booking-form',
  '/reservierung',
  '/founder',
  '/webhooks/twilio/founder-otp'
];

/**
 * Sensitive tables that require company_id scoping
 */
const SENSITIVE_TABLES = [
  'customers',
  'bookings',
  'contacts',
  'staff',
  'settings',
  'otp_cache',
  'booking_actions',
  'media_assets'
];

/**
 * Validate that guard file exists and exports requireTenant
 */
export function validateGuardFileExists() {
  const guardPath = path.join(process.cwd(), 'src/utils/tenant-guard.js');
  
  if (!fs.existsSync(guardPath)) {
    throw new Error(`Guard file missing: ${guardPath}`);
  }

  const content = fs.readFileSync(guardPath, 'utf-8');
  if (!content.includes('export function requireTenant')) {
    throw new Error('Guard file must export requireTenant() function');
  }

  const lines = content.split('\n').length;
  if (lines < 20) {
    throw new Error(`Guard file too small (${lines} lines). Must contain full guard implementation.`);
  }

  return true;
}

/**
 * Validate that no fallback to company_id = 1 exists
 */
export function validateNoFallbackDefault() {
  const srcPath = path.join(process.cwd(), 'src');
  const files = fs.readdirSync(srcPath).filter(f => f.endsWith('.js'));
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(srcPath, file), 'utf-8');
    
    if (/fallbackCompanyId\s*=\s*1|activeCompanyId\s*=\s*1(?!\w)|return\s+fallbackCompanyId/.test(content)) {
      throw new Error(
        `File ${file} contains hardcoded fallback to company_id = 1. ` +
        `Use resolver instead (resolveActiveCompanyId).`
      );
    }
  }

  return true;
}

/**
 * Validate that index.js uses runTenantRoute for tenant-required routes
 */
export function validateRouteGuardCoverage() {
  const indexPath = path.join(process.cwd(), 'src/index.js');
  const content = fs.readFileSync(indexPath, 'utf-8');

  const uncovered = [];
  
  for (const route of TENANT_REQUIRED_ROUTES) {
    // Escape special characters for regex
    const pathPattern = route.replace(/[:()\/]/g, c => '\\' + c);
    
    // Look for route matcher and check if it's followed by runTenantRoute
    const routeRegex = new RegExp(
      `url\\.pathname\\s*(?:===|\\.match)\\s*['\`"].*${pathPattern}.*['\`"]`,
      'i'
    );

    if (routeRegex.test(content)) {
      // Find the position and check if runTenantRoute wraps it
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (routeRegex.test(lines[i])) {
          // Check next few lines for runTenantRoute
          let found = false;
          for (let j = i; j < Math.min(i + 5, lines.length); j++) {
            if (lines[j].includes('runTenantRoute') || lines[j].includes('requireTenant')) {
              found = true;
              break;
            }
          }
          
          if (!found && !route.includes(':')) {
            uncovered.push(route);
          }
        }
      }
    }
  }

  if (uncovered.length > 0) {
    throw new Error(
      `Routes not wrapped with runTenantRoute():\n` +
      `${uncovered.join('\n')}\n` +
      `All tenant-required routes must use runTenantRoute() guard.`
    );
  }

  return true;
}

/**
 * Check for unscoped queries on sensitive tables
 */
export function validateQueryScoping() {
  const srcPath = path.join(process.cwd(), 'src');
  const files = fs.readdirSync(srcPath)
    .filter(f => f.endsWith('.js'))
    .flatMap(f => {
      const fullPath = path.join(srcPath, f);
      if (fs.statSync(fullPath).isDirectory()) {
        return fs.readdirSync(fullPath)
          .filter(f => f.endsWith('.js'))
          .map(f2 => path.join(fullPath, f2));
      }
      return [fullPath];
    });

  const unscoped = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');

    for (const table of SENSITIVE_TABLES) {
      // Look for SELECT queries on sensitive tables
      const selectRegex = new RegExp(
        `SELECT\\s+.*\\s+FROM\\s+${table}\\b`,
        'gi'
      );

      if (selectRegex.test(content)) {
        // Reset lastIndex for global regex
        selectRegex.lastIndex = 0;
        
        // Check if company_id filter is present in reasonably nearby context
        const matches = content.matchAll(selectRegex);
        for (const match of matches) {
          const start = Math.max(0, match.index - 200);
          const end = Math.min(content.length, match.index + 500);
          const context = content.substring(start, end);
          
          // Allow if company_id is mentioned in the context
          if (!context.includes('company_id')) {
            unscoped.push(`${path.basename(file)}: Unscoped SELECT from ${table}`);
          }
        }
      }
    }
  }

  if (unscoped.length > 0) {
    console.warn('⚠️  Potentially unscoped queries detected (manual review recommended):');
    unscoped.forEach(msg => console.warn(`   ${msg}`));
  }

  return true;
}

/**
 * Run all validations
 */
export async function runAllValidations() {
  const validations = [
    { name: 'Guard file exists', fn: validateGuardFileExists },
    { name: 'No fallback defaults', fn: validateNoFallbackDefault },
    { name: 'Route guard coverage', fn: validateRouteGuardCoverage },
    { name: 'Query scoping', fn: validateQueryScoping }
  ];

  const results = [];
  
  for (const { name, fn } of validations) {
    try {
      fn();
      results.push({ name, status: 'pass' });
      console.log(`✅ ${name}`);
    } catch (error) {
      results.push({ name, status: 'fail', error: error.message });
      console.error(`❌ ${name}: ${error.message}`);
    }
  }

  const failed = results.filter(r => r.status === 'fail');
  if (failed.length > 0) {
    throw new Error(`${failed.length} validation(s) failed`);
  }

  return results;
}

// Run if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllValidations()
    .then(() => {
      console.log('\n✅ All tenant guard validations passed!');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Validation failed:', err.message);
      process.exit(1);
    });
}
