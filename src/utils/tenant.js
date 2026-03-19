/**
 * Tenant detection utilities for multi-tenant Cloudflare Workers
 * Maps subdomain to company_id
 */

/**
 * Extract company_id from request hostname (subdomain routing)
 * Supports:
 *   - restaurant1.quan-esskultur.de → company_id: 1
 *   - restaurant2.quan-esskultur.de → company_id: 2
 *   - quan-esskultur.de → company_id: null (main domain, needs explicit routing)
 *
 * @param {string} hostname - Request hostname (from headers)
 * @returns {number|null} - company_id or null if main domain/invalid
 */
export function extractCompanyIdFromHostname(hostname) {
  if (!hostname) return null;

  // Remove port if present
  const host = hostname.split(':')[0].toLowerCase();

  // Main domain patterns (no company)
  const mainDomains = [
    'quan-esskultur.de',
    'www.quan-esskultur.de',
    'localhost',
    'localhost:8787'
  ];

  if (mainDomains.includes(host)) {
    return null;
  }

  // Extract subdomain: restaurant1.quan-esskultur.de → restaurant1
  const parts = host.split('.');
  if (parts.length >= 2) {
    const subdomain = parts[0];

    // Map subdomain to company_id
    const subdomainMap = {
      'restaurant1': 1,
      'restaurant2': 2,
      'restaurant3': 3,
      'restaurant4': 4,
      'restaurant5': 5
      // Add more as needed
    };

    const companyId = subdomainMap[subdomain];
    return companyId || null;
  }

  return null;
}

/**
 * Get subdomain from hostname
 * @param {string} hostname
 * @returns {string|null}
 */
export function getSubdomainFromHostname(hostname) {
  if (!hostname) return null;

  const host = hostname.split(':')[0].toLowerCase();
  const parts = host.split('.');

  // If only one part (localhost) or is main domain, return null
  if (parts.length < 2 || ['quan-esskultur', 'de'].includes(parts[0])) {
    return null;
  }

  return parts[0];
}

/**
 * Add company_id context to request
 * Call this early in Worker fetch() to inject company context
 *
 * @param {Request} request
 * @returns {object} - { companyId, subdomain, isMainDomain }
 */
export function getTenantContext(request) {
  const url = new URL(request.url);
  const hostname = url.hostname;

  const companyId = extractCompanyIdFromHostname(hostname);
  const subdomain = getSubdomainFromHostname(hostname);
  const isMainDomain = !companyId;

  return {
    companyId,
    subdomain,
    isMainDomain,
    hostname
  };
}

/**
 * Validate that a user belongs to a company
 * (Used after staff authentication to ensure they can't access other companies' data)
 *
 * @param {number} staffCompanyId - Company ID from staff record in DB
 * @param {number} requestCompanyId - Company ID from request hostname
 * @returns {boolean}
 */
export function validateTenantAccess(staffCompanyId, requestCompanyId) {
  if (!requestCompanyId) return false; // Main domain not allowed
  return staffCompanyId === requestCompanyId;
}

/**
 * Build WHERE clause for multi-tenant queries
 * @param {number} companyId
 * @param {string} tableAlias - Optional table alias (e.g., 'b' for 'bookings b')
 * @returns {string}
 */
export function buildCompanyFilter(companyId, tableAlias = '') {
  const column = tableAlias ? `${tableAlias}.company_id` : 'company_id';
  return `${column} = ${companyId}`;
}

/**
 * Company metadata lookup
 * Store this in memory or D1 as needed
 */
export const COMPANIES = {
  1: {
    id: 1,
    subdomain: 'restaurant1',
    name: 'ESSKULTUR Restaurant 1',
    odoo_company_id: 1,
    timezone: 'Europe/Berlin'
  },
  2: {
    id: 2,
    subdomain: 'restaurant2',
    name: 'ESSKULTUR Restaurant 2',
    odoo_company_id: 2,
    timezone: 'Europe/Berlin'
  }
  // Add more companies as they're created
};

export function getCompanyMetadata(companyId) {
  return COMPANIES[companyId] || null;
}
