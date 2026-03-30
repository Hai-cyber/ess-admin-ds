// Import UIs
import adminUI from '../public/admin.html';
import bookingForm from '../public/booking-form.html';
import reservieungPage from '../public/reservierung.html';
import thankYouPage from '../public/danke-reservierung.html';
import appUI from '../public/app.html';
import founderFormUI from '../public/founder-form.html';
import boardUI from '../public/board.html';
import platformHomeUI from '../public/platform/index.html';
import platformSignupUI from '../public/platform/signup.html';
import platformContactUI from '../public/platform/contact.html';
import platformAdminUI from '../public/platform/admin.html';
import platformTermsUI from '../public/platform/legal/terms.html';
import platformPrivacyUI from '../public/platform/legal/privacy.html';
import platformImpressumUI from '../public/platform/legal/impressum.html';

// Import utilities
import { getTenantContext, validateTenantAccess } from './utils/tenant.js';
import { requireTenant } from './utils/tenant-guard.js';
import { initializeDatabase } from './db/init.js';
import { getOrganizationSecret, getOrganizationSecretStatuses } from './utils/organization-secrets.js';
import { odooCreateCrmLead, odooWriteLead } from './utils/odoo.js';

// Store for SSE clients (company_id => Set of clients)
const sseClients = new Map();
const initializedDatabases = new WeakSet();

const FOUNDER_OPT_IN_TEXT = 'Ich stimme der Verifizierung sowie dem Erhalt von Info, Updates und Rewards per SMS/WhatsApp zu.';
const TURNSTILE_SECRET_FALLBACK = '0x4AAAAAACmwkmhvbsWRW-ArRyqyg-UhxkQ';
const TURNSTILE_SITE_KEY_FALLBACK = '0x4AAAAAACmwktNVObyT3tQ7';
const FOUNDER_OTP_COOLDOWN_SECONDS = 180;
const FOUNDER_OTP_EXPIRES_SECONDS = 600;
const FOUNDER_DEFAULT_MEMBERSHIP_TYPE = 'Founder';
const PLATFORM_OPERATOR_COMPANY_ID = 1;
const PLATFORM_PRICING_DEFAULTS = {
  platform_core_price_per_user: '29',
  platform_commerce_price_per_user: '59',
  platform_growth_price_per_user: '89',
  platform_setup_fee_once: '349',
  platform_tse_fee_monthly: '19',
  platform_it_support_hourly: '95',
  platform_it_support_monthly: '249',
  platform_price_note: 'Billed per active user. Included: hosting, platform maintenance, and standard domain setup. Add-ons only apply for SMS usage, TSE, onboarding, and optional IT support.'
};
const WEBSITE_BUILDER_DEFAULTS = {
  site_template: 'modern',
  site_tagline: 'Neighborhood restaurant with a modern booking experience.',
  site_hero_title: 'Welcome to our restaurant',
  site_hero_subtitle: 'Book a table, explore our menu, and discover what makes us special.',
  site_about_title: 'About us',
  site_about_body: 'Tell guests what your restaurant is about, what style of cuisine you serve, and why they should visit.',
  site_primary_cta_text: 'Book a table',
  site_secondary_cta_text: 'View menu',
  site_accent_color: '#A54A7B'
};
const OPERATIONAL_SETTING_KEYS = [
  'website_url',
  'standard_contact_link',
  'booking_email',
  'platform_core_price_per_user',
  'platform_commerce_price_per_user',
  'platform_growth_price_per_user',
  'platform_setup_fee_once',
  'platform_tse_fee_monthly',
  'platform_it_support_hourly',
  'platform_it_support_monthly',
  'platform_price_note',
  'custom_domain',
  'stripe_account_id',
  'company_plan',
  'billable_staff_count',
  'billing_include_tse',
  'billing_include_support_retainer',
  'billing_include_setup',
  'demo_payment_status',
  'demo_payment_due_today_eur',
  'demo_payment_recurring_monthly_eur',
  'social_instagram_url',
  'social_facebook_url',
  'social_tiktok_url',
  'social_google_business_url',
  'business_hours_open',
  'business_hours_close',
  'closed_weekday',
  'min_booking_advance_min',
  'default_booking_duration',
  'area_capacity_indoor',
  'area_capacity_outdoor',
  'area_capacity_garden',
  'area_capacity_bar',
  'founder_program_label',
  'kc_program_label',
  'founder_membership_type',
  'kc_membership_type',
  'founder_redirect_link',
  'kc_redirect_link',
  'founder_terms_link',
  'kc_terms_link',
  'privacy_link',
  'site_template',
  'site_tagline',
  'site_hero_title',
  'site_hero_subtitle',
  'site_about_title',
  'site_about_body',
  'site_primary_cta_text',
  'site_secondary_cta_text',
  'site_accent_color'
];
const MANAGER_EDITABLE_OPERATIONAL_SETTING_KEYS = new Set([
  'social_instagram_url',
  'social_facebook_url',
  'social_tiktok_url',
  'social_google_business_url',
  'site_template',
  'site_tagline',
  'site_hero_title',
  'site_hero_subtitle',
  'site_about_title',
  'site_about_body',
  'site_primary_cta_text',
  'site_secondary_cta_text',
  'site_accent_color'
]);
const MODULE_SETTING_KEYS = [
  'module_membership_management',
  'module_marketing_management',
  'module_booking_management',
  'module_digital_management',
  'module_loyalty_rewards',
  'module_contact_crm',
  'module_telegram_notifications',
  // Legacy key retained for backward compatibility. Runtime behavior is
  // controlled by module_membership_management.
  'module_founder_program'
];
const DEFAULT_MODULE_SETTINGS = {
  module_membership_management: true,
  module_marketing_management: false,
  module_booking_management: true,
  module_digital_management: false,
  module_loyalty_rewards: false,
  module_contact_crm: true,
  module_telegram_notifications: false,
  module_founder_program: true
};
const OPERATIONAL_KEY_DESCRIPTIONS = {
  website_url: 'Public website URL for this restaurant',
  standard_contact_link: 'Fallback contact page path or URL when membership module is disabled',
  booking_email: 'Operational email for booking notices',
  platform_core_price_per_user: 'Core plan price per active user / month for the public platform site',
  platform_commerce_price_per_user: 'Commerce plan price per active user / month for the public platform site',
  platform_growth_price_per_user: 'Growth plan price per active user / month for the public platform site',
  platform_setup_fee_once: 'One-time onboarding / setup fee displayed on the public platform site',
  platform_tse_fee_monthly: 'Monthly TSE surcharge displayed on the public platform site',
  platform_it_support_hourly: 'Hourly IT support fee displayed on the public platform site',
  platform_it_support_monthly: 'Monthly IT support retainer displayed on the public platform site',
  platform_price_note: 'Pricing note displayed under the public platform pricing section',
  custom_domain: 'Custom domain mapped for the tenant website',
  stripe_account_id: 'Tenant-owned Stripe account id / payment method binding',
  company_plan: 'Current tenant subscription plan',
  billable_staff_count: 'Current count of active billable staff users',
  billing_include_tse: 'Whether the tenant invoice includes TSE monthly surcharge',
  billing_include_support_retainer: 'Whether the tenant invoice includes monthly IT support retainer',
  billing_include_setup: 'Whether the tenant invoice includes one-time setup fee',
  demo_payment_status: 'Current payment status for signup/demo billing',
  demo_payment_due_today_eur: 'Due today amount for initial signup invoice',
  demo_payment_recurring_monthly_eur: 'Recurring monthly amount for the tenant invoice',
  social_instagram_url: 'Instagram profile URL',
  social_facebook_url: 'Facebook page URL',
  social_tiktok_url: 'TikTok profile URL',
  social_google_business_url: 'Google Business profile URL',
  business_hours_open: 'Opening hour',
  business_hours_close: 'Closing hour',
  closed_weekday: 'Closed weekday (0=Sun, 1=Mon)',
  min_booking_advance_min: 'Minimum advance booking time in minutes',
  default_booking_duration: 'Default booking duration in minutes',
  area_capacity_indoor: 'Indoor seating capacity blocks',
  area_capacity_outdoor: 'Outdoor seating capacity blocks',
  area_capacity_garden: 'Garden seating capacity blocks',
  area_capacity_bar: 'Bar seating capacity blocks',
  founder_program_label: 'Display name for founder program',
  kc_program_label: 'Display name for KC / colleague club program',
  founder_membership_type: 'Membership type sent to backend for founder flow',
  kc_membership_type: 'Membership type sent to backend for KC flow',
  founder_redirect_link: 'Post-verification redirect path or URL for founder flow',
  kc_redirect_link: 'Post-verification redirect path or URL for KC flow',
  founder_terms_link: 'Terms path or URL for founder flow',
  kc_terms_link: 'Terms path or URL for KC flow',
  privacy_link: 'Privacy policy path or URL for founder/KC flows',
  site_template: 'Public website template choice (minimal, modern, premium)',
  site_tagline: 'Short public-facing tagline for the restaurant website',
  site_hero_title: 'Main hero title on the tenant website',
  site_hero_subtitle: 'Hero subtitle on the tenant website',
  site_about_title: 'About section title on the tenant website',
  site_about_body: 'About section body text on the tenant website',
  site_primary_cta_text: 'Primary call-to-action label on the tenant website',
  site_secondary_cta_text: 'Secondary call-to-action label on the tenant website',
  site_accent_color: 'Primary brand accent color for the tenant website'
};
const MODULE_KEY_DESCRIPTIONS = {
  module_membership_management: 'Product line: community & membership (Founder/KC forms, OTP, member lifecycle automation)',
  module_marketing_management: 'Product line: marketing automation (social, SMS, email engagement)',
  module_booking_management: 'Product line: booking management (booking form, stage automation, booking board/staff app)',
  module_digital_management: 'Product line: digital management (SEO, hosting, domain operations)',
  module_loyalty_rewards: 'Product line: advanced loyalty/rewards programs',
  module_contact_crm: 'Product line: CRM & Odoo operations (contacts, pipelines, product/menu data workflows)',
  module_telegram_notifications: 'Product line: board notifications via Telegram',
  module_founder_program: 'Legacy alias of membership module (kept for backward compatibility)'
};
const MODULE_RUNTIME_ALIASES = {
  module_founder_program: 'module_membership_management'
};
const ORGANIZATION_DEFAULT_KEY_BY_OPERATIONAL_KEY = {
  standard_contact_link: 'default_standard_contact_link',
  business_hours_open: 'default_business_hours_open',
  business_hours_close: 'default_business_hours_close',
  closed_weekday: 'default_closed_weekday',
  min_booking_advance_min: 'default_min_booking_advance_min',
  default_booking_duration: 'default_booking_duration',
  area_capacity_indoor: 'default_area_capacity_indoor',
  area_capacity_outdoor: 'default_area_capacity_outdoor',
  area_capacity_garden: 'default_area_capacity_garden',
  area_capacity_bar: 'default_area_capacity_bar'
};
const INTEGRATION_SETTING_KEYS = [
  'FOUNDER_OTP_CHANNELS',
  'FOUNDER_TEST_EXCEPTION_PHONES',
  'TWILIO_WHATSAPP_FROM',
  'TWILIO_SMS_FROM',
  'TWILIO_MESSAGING_SERVICE_SID',
  'ODOO_API_TOKEN',
  'ODOO_FOUNDER_CREATE_WEBHOOK',
  'ODOO_FOUNDER_VERIFY_WEBHOOK',
  'ODOO_STAFF_SYNC_WEBHOOK',
  'ODOO_BOOKING_CREATE_WEBHOOK',
  'ODOO_BOOKING_STAGE_WEBHOOK',
  'ODOO_CRM_TEAM_ID'
];
const INTEGRATION_SETTING_KEY_SET = new Set(INTEGRATION_SETTING_KEYS);
const SECRET_ONLY_INTEGRATION_KEYS = new Set([
  'TURNSTILE_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN'
]);
const ORGANIZATION_SECRET_KEYS = [
  'TURNSTILE_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN'
];
const INTEGRATION_KEY_DESCRIPTIONS = {
  FOUNDER_OTP_CHANNELS: 'Founder OTP channels in order, comma-separated (whatsapp,sms)',
  FOUNDER_TEST_EXCEPTION_PHONES: 'Founder test exception phones in E.164, comma-separated (duplicate/live bypass for testing)',
  TWILIO_WHATSAPP_FROM: 'Twilio WhatsApp sender (format: whatsapp:+E164)',
  TWILIO_SMS_FROM: 'Twilio SMS sender (E.164)',
  TWILIO_MESSAGING_SERVICE_SID: 'Twilio Messaging Service SID for outbound SMS/WhatsApp',
  ODOO_API_TOKEN: 'Odoo API token for direct JSON-RPC calls',
  ODOO_FOUNDER_CREATE_WEBHOOK: 'Webhook URL for founder register sync',
  ODOO_FOUNDER_VERIFY_WEBHOOK: 'Webhook URL for founder verify sync',
  ODOO_STAFF_SYNC_WEBHOOK: 'Webhook URL for staff create/update sync',
  ODOO_BOOKING_CREATE_WEBHOOK: 'Webhook URL for booking lead-create sync (fallback when Odoo API is not configured)',
  ODOO_BOOKING_STAGE_WEBHOOK: 'Webhook URL for booking stage-change sync (fallback when Odoo API is not configured)',
  ODOO_CRM_TEAM_ID: 'Odoo CRM team ID to assign booking leads (default: 5)'
};
const MEDIA_ASSET_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
]);
const MAX_MEDIA_ASSET_DATA_URL_LENGTH = 1200000;
const MAX_MEDIA_TAGS = 10;
const MAX_MEDIA_TAG_LENGTH = 40;

function normalizeIntegrationKey(rawKey) {
  return String(rawKey || '').trim().toUpperCase();
}

function normalizeTenantSubdomain(rawSubdomain) {
  return String(rawSubdomain || '').trim().toLowerCase();
}

function isValidTenantSubdomain(subdomain) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(String(subdomain || ''));
}

function parseBooleanLike(value, defaultValue = false) {
  if (value == null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on' || normalized === 'enabled';
}

function parseJsonArray(rawValue) {
  if (Array.isArray(rawValue)) return rawValue;
  if (typeof rawValue !== 'string') return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeMediaTags(rawTags) {
  let source = [];

  if (Array.isArray(rawTags)) {
    source = rawTags;
  } else if (typeof rawTags === 'string') {
    const trimmed = rawTags.trim();
    source = trimmed.startsWith('[') ? parseJsonArray(trimmed) : trimmed.split(',');
  } else {
    source = parseJsonArray(rawTags);
  }

  return source
    .map((tag) => String(tag || '').trim().toLowerCase())
    .filter(Boolean)
    .filter((tag, index, arr) => arr.indexOf(tag) === index)
    .slice(0, MAX_MEDIA_TAGS)
    .map((tag) => tag.slice(0, MAX_MEDIA_TAG_LENGTH));
}

function inferImageMimeTypeFromDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
  return match ? String(match[1]).toLowerCase() : '';
}

function mapMediaAssetRow(row) {
  if (!row) return null;

  return {
    id: String(row.id || ''),
    title: String(row.title || ''),
    altText: String(row.alt_text || ''),
    mimeType: String(row.mime_type || ''),
    dataUrl: String(row.data_url || ''),
    tags: normalizeMediaTags(row.tags),
    isActive: Number(row.is_active) === 0 ? 0 : 1,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null
  };
}

async function getSettingsMap(env, companyId, keys) {
  if (!env?.DB) return {};

  if (!Array.isArray(keys) || !keys.length) return {};

  const placeholders = keys.map(() => '?').join(', ');
  const result = await env.DB.prepare(
    `SELECT key, value FROM settings WHERE company_id = ? AND key IN (${placeholders})`
  ).bind(companyId, ...keys).all();

  const rows = result?.results || [];
  const map = {};
  for (const row of rows) {
    if (!row?.key) continue;
    map[String(row.key)] = String(row.value || '').trim();
  }

  return map;
}

async function getOrganizationIdForCompany(env, companyId) {
  const row = await env.DB.prepare(
    `SELECT organization_id FROM companies WHERE id = ? LIMIT 1`
  ).bind(companyId).first();

  return row?.organization_id || null;
}

async function getOrganizationSettingsMapById(env, organizationId, keys) {
  if (!env?.DB || !organizationId) return {};
  if (!Array.isArray(keys) || !keys.length) return {};

  const placeholders = keys.map(() => '?').join(', ');
  const result = await env.DB.prepare(
    `SELECT key, value FROM organization_settings WHERE organization_id = ? AND key IN (${placeholders})`
  ).bind(organizationId, ...keys).all();

  const rows = result?.results || [];
  const map = {};
  for (const row of rows) {
    if (!row?.key) continue;
    map[String(row.key)] = String(row.value || '').trim();
  }

  return map;
}

async function getMergedSettingsMap(env, companyId, companyKeys, organizationKeyMap = {}) {
  const [companyMap, organizationId] = await Promise.all([
    getSettingsMap(env, companyId, companyKeys),
    getOrganizationIdForCompany(env, companyId)
  ]);

  const organizationKeys = Array.from(new Set(
    companyKeys
      .map(key => organizationKeyMap[key] || key)
      .filter(Boolean)
  ));

  const organizationMap = organizationId
    ? await getOrganizationSettingsMapById(env, organizationId, organizationKeys)
    : {};

  const merged = {};
  for (const key of companyKeys) {
    const orgKey = organizationKeyMap[key] || key;
    const companyValue = companyMap[key];
    const organizationValue = organizationMap[orgKey];
    merged[key] = companyValue != null && companyValue !== '' ? companyValue : (organizationValue != null ? organizationValue : '');
  }

  return merged;
}

async function getIntegrationSettingsMap(env, companyId) {
  return getMergedSettingsMap(env, companyId, INTEGRATION_SETTING_KEYS);
}

async function getOperationalSettingsMap(env, companyId) {
  return getMergedSettingsMap(env, companyId, OPERATIONAL_SETTING_KEYS, ORGANIZATION_DEFAULT_KEY_BY_OPERATIONAL_KEY);
}

async function getModuleSettingsMap(env, companyId) {
  const rawMap = await getMergedSettingsMap(env, companyId, MODULE_SETTING_KEYS);
  const normalized = {};
  for (const key of MODULE_SETTING_KEYS) {
    normalized[key] = parseBooleanLike(rawMap[key], DEFAULT_MODULE_SETTINGS[key] ?? false);
  }

  // Legacy founder module is now a semantic alias of membership management.
  normalized.module_founder_program = normalized.module_membership_management;

  return normalized;
}

async function upsertSettingValue(env, companyId, key, value, description, updatedBy) {
  await env.DB.prepare(`
    INSERT INTO settings (company_id, key, value, description, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_id, key) DO UPDATE SET
      value = excluded.value,
      description = excluded.description,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `).bind(
    companyId,
    key,
    value,
    description,
    new Date().toISOString(),
    updatedBy
  ).run();
}

async function getCompanyProfile(env, companyId) {
  const company = await env.DB.prepare(`
    SELECT id, organization_id, subdomain, name, email, phone, odoo_company_id, odoo_url, is_active, timezone
    FROM companies
    WHERE id = ?
    LIMIT 1
  `).bind(companyId).first();

  return company || null;
}

async function getOrganizationProfile(env, organizationId) {
  if (!organizationId) return null;

  const organization = await env.DB.prepare(`
    SELECT id, slug, name, billing_email, phone, odoo_url, odoo_db_name, is_active, timezone
    FROM organizations
    WHERE id = ?
    LIMIT 1
  `).bind(organizationId).first();

  return organization || null;
}

async function getAdminPlatformConfig(env, companyId) {
  const company = await getCompanyProfile(env, companyId);
  const [organization, operationalSettings, modules] = await Promise.all([
    getOrganizationProfile(env, company?.organization_id || null),
    getOperationalSettingsMap(env, companyId),
    getModuleSettingsMap(env, companyId)
  ]);

  return {
    organization,
    company,
    operationalSettings,
    modules
  };
}

async function getPlatformMarketingSettings(env) {
  const settingsMap = await getSettingsMap(env, PLATFORM_OPERATOR_COMPANY_ID, Object.keys(PLATFORM_PRICING_DEFAULTS));
  const merged = {};
  for (const key of Object.keys(PLATFORM_PRICING_DEFAULTS)) {
    const raw = String(settingsMap[key] || '').trim();
    merged[key] = raw || PLATFORM_PRICING_DEFAULTS[key];
  }
  return merged;
}

function buildPlatformPlansResponse(settingsMap) {
  const setupFee = Number(settingsMap.platform_setup_fee_once || PLATFORM_PRICING_DEFAULTS.platform_setup_fee_once || 0);
  const tseFee = Number(settingsMap.platform_tse_fee_monthly || PLATFORM_PRICING_DEFAULTS.platform_tse_fee_monthly || 0);
  const supportHourly = Number(settingsMap.platform_it_support_hourly || PLATFORM_PRICING_DEFAULTS.platform_it_support_hourly || 0);
  const supportMonthly = Number(settingsMap.platform_it_support_monthly || PLATFORM_PRICING_DEFAULTS.platform_it_support_monthly || 0);

  return {
    ok: true,
    billingModel: 'per_user_monthly',
    pricingNote: String(settingsMap.platform_price_note || PLATFORM_PRICING_DEFAULTS.platform_price_note),
    extras: {
      oneTimeSetupFeeEur: setupFee,
      tseMonthlyFeeEur: tseFee,
      itSupportHourlyEur: supportHourly,
      itSupportMonthlyRetainerEur: supportMonthly
    },
    plans: [
      {
        id: 'core',
        name: 'Online',
        priceEurPerUserMonthly: Number(settingsMap.platform_core_price_per_user || PLATFORM_PRICING_DEFAULTS.platform_core_price_per_user || 0),
        features: [
          'Restaurant website',
          'Online booking form',
          'Contact and info page',
          'Bookings in one place'
        ]
      },
      {
        id: 'commerce',
        name: 'Service',
        priceEurPerUserMonthly: Number(settingsMap.platform_commerce_price_per_user || PLATFORM_PRICING_DEFAULTS.platform_commerce_price_per_user || 0),
        features: [
          'Everything in Online',
          'Restaurant POS',
          'Live booking board, reminders, and confirmations',
          'German-standard cash register workflow'
        ]
      },
      {
        id: 'growth',
        name: 'Repeat Guests',
        priceEurPerUserMonthly: Number(settingsMap.platform_growth_price_per_user || PLATFORM_PRICING_DEFAULTS.platform_growth_price_per_user || 0),
        features: [
          'Everything in Service',
          'SMS marketing for previous guests',
          'Loyal guest profiles and segments',
          'Repeat-guest overview and follow-up'
        ]
      },
      {
        id: 'enterprise',
        name: 'Groups',
        priceEurPerUserMonthly: null,
        features: [
          'Everything in Repeat Guests',
          'Multi-location support',
          'Custom integrations API',
          'Dedicated onboarding + SLA'
        ]
      }
    ]
  };
}

async function getNextIntegerId(env, tableName) {
  const row = await env.DB.prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM ${tableName}`).first();
  return Number(row?.nextId || 1);
}

async function cloneOrganizationDefaults(env, sourceOrganizationId, targetOrganizationId, updatedBy = 'platform-signup') {
  const result = await env.DB.prepare(`
    SELECT key, value, description
    FROM organization_settings
    WHERE organization_id = ?
  `).bind(sourceOrganizationId).all();

  const rows = result?.results || [];
  const now = new Date().toISOString();
  for (const row of rows) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO organization_settings (organization_id, key, value, description, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      targetOrganizationId,
      String(row.key || ''),
      String(row.value || ''),
      String(row.description || ''),
      now,
      updatedBy
    ).run();
  }
}

function normalizeHexColor(value, fallback = WEBSITE_BUILDER_DEFAULTS.site_accent_color) {
  const input = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(input)) return input;
  return fallback;
}

function normalizePlanId(planRaw) {
  const normalized = String(planRaw || '').trim().toLowerCase();
  return ['core', 'commerce', 'growth', 'enterprise'].includes(normalized) ? normalized : '';
}

function normalizeWebsiteTemplate(templateRaw) {
  const normalized = String(templateRaw || '').trim().toLowerCase();
  return ['minimal', 'modern', 'premium'].includes(normalized) ? normalized : WEBSITE_BUILDER_DEFAULTS.site_template;
}

function computeDemoPaymentSummary(planId, userCount, extras, settingsMap) {
  const perUserMap = {
    core: Number(settingsMap.platform_core_price_per_user || PLATFORM_PRICING_DEFAULTS.platform_core_price_per_user || 0),
    commerce: Number(settingsMap.platform_commerce_price_per_user || PLATFORM_PRICING_DEFAULTS.platform_commerce_price_per_user || 0),
    growth: Number(settingsMap.platform_growth_price_per_user || PLATFORM_PRICING_DEFAULTS.platform_growth_price_per_user || 0),
    enterprise: 0
  };
  const perUser = Number(perUserMap[planId] || 0);
  const monthlyBase = perUser * Math.max(1, Number(userCount || 1));
  const setupFee = parseBooleanLike(extras?.includeSetup, true)
    ? Number(settingsMap.platform_setup_fee_once || PLATFORM_PRICING_DEFAULTS.platform_setup_fee_once || 0)
    : 0;
  const tseFee = parseBooleanLike(extras?.includeTse, false)
    ? Number(settingsMap.platform_tse_fee_monthly || PLATFORM_PRICING_DEFAULTS.platform_tse_fee_monthly || 0)
    : 0;
  const supportMonthly = parseBooleanLike(extras?.includeSupportRetainer, false)
    ? Number(settingsMap.platform_it_support_monthly || PLATFORM_PRICING_DEFAULTS.platform_it_support_monthly || 0)
    : 0;
  return {
    billingModel: 'demo_payment',
    perUserMonthlyEur: perUser,
    users: Math.max(1, Number(userCount || 1)),
    monthlyBaseEur: monthlyBase,
    monthlyExtrasEur: tseFee + supportMonthly,
    oneTimeSetupEur: setupFee,
    dueTodayEur: setupFee,
    recurringMonthlyEur: monthlyBase + tseFee + supportMonthly,
    extras: {
      includeSetup: parseBooleanLike(extras?.includeSetup, true),
      includeTse: parseBooleanLike(extras?.includeTse, false),
      includeSupportRetainer: parseBooleanLike(extras?.includeSupportRetainer, false),
      tseFeeEur: tseFee,
      supportRetainerMonthlyEur: supportMonthly
    },
    paymentStatus: 'demo_paid'
  };
}

async function recalculateCompanyBillingSummary(env, companyId) {
  const [pricingSettings, companySettings, staffCountRow] = await Promise.all([
    getPlatformMarketingSettings(env),
    getSettingsMap(env, companyId, [
      'company_plan',
      'billing_include_tse',
      'billing_include_support_retainer',
      'billing_include_setup'
    ]),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM staff WHERE company_id = ? AND is_active = 1`).bind(companyId).first()
  ]);

  const plan = normalizePlanId(companySettings.company_plan || 'core') || 'core';
  const extras = {
    includeTse: parseBooleanLike(companySettings.billing_include_tse, false),
    includeSupportRetainer: parseBooleanLike(companySettings.billing_include_support_retainer, false),
    includeSetup: parseBooleanLike(companySettings.billing_include_setup, false)
  };
  const activeStaff = Math.max(1, Number(staffCountRow?.count || 1));
  const summary = computeDemoPaymentSummary(plan, activeStaff, extras, pricingSettings);

  await upsertSettingValue(env, companyId, 'billable_staff_count', String(activeStaff), OPERATIONAL_KEY_DESCRIPTIONS.billable_staff_count, 'billing-automation');
  await upsertSettingValue(env, companyId, 'demo_payment_recurring_monthly_eur', String(summary.recurringMonthlyEur), OPERATIONAL_KEY_DESCRIPTIONS.demo_payment_recurring_monthly_eur, 'billing-automation');

  return { activeStaff, summary };
}

async function authorizePlatformOperator(env, pinRaw) {
  return authorizeAdminByPin(env, PLATFORM_OPERATOR_COMPANY_ID, pinRaw);
}

async function getPlatformAdminDashboard(env) {
  const [pricingSettings, signupsResult, contactsResult] = await Promise.all([
    getPlatformMarketingSettings(env),
    env.DB.prepare(`
      SELECT id, company_id, organization_id, restaurant_name, owner_email, owner_phone, subdomain, plan,
             website_template, staff_users, country, payment_status, due_today_eur, recurring_monthly_eur,
             follow_up_status, follow_up_note, followed_up_at, created_at
      FROM platform_signups
      ORDER BY created_at DESC
      LIMIT 100
    `).all(),
    env.DB.prepare(`
      SELECT id, name, email, subject, message, submitted_at, status
      FROM platform_contacts
      ORDER BY submitted_at DESC
      LIMIT 100
    `).all()
  ]);

  return {
    pricingSettings,
    signups: signupsResult?.results || [],
    contacts: contactsResult?.results || []
  };
}

async function isModuleEnabled(env, companyId, moduleKey) {
  const modules = await getModuleSettingsMap(env, companyId);
  const normalizedKey = MODULE_RUNTIME_ALIASES[moduleKey] || moduleKey;
  if (normalizedKey in modules) return modules[normalizedKey];
  return false;
}

async function getFounderRuntimeConfig(env, companyId) {
  const settingsMap = await getIntegrationSettingsMap(env, companyId);

  return {
    founderOtpChannels: settingsMap.FOUNDER_OTP_CHANNELS || String(env.FOUNDER_OTP_CHANNELS || '').trim(),
    founderTestExceptionPhones: settingsMap.FOUNDER_TEST_EXCEPTION_PHONES || String(env.FOUNDER_TEST_EXCEPTION_PHONES || '').trim(),
    twilioWhatsappFrom: settingsMap.TWILIO_WHATSAPP_FROM || String(env.TWILIO_WHATSAPP_FROM || '').trim(),
    twilioSmsFrom: settingsMap.TWILIO_SMS_FROM || String(env.TWILIO_SMS_FROM || env.TWILIO_PHONE || env.TWILIO_PHONE_NUMBER || '').trim(),
    twilioMessagingServiceSid: settingsMap.TWILIO_MESSAGING_SERVICE_SID || String(env.TWILIO_MESSAGING_SERVICE_SID || '').trim(),
    odooFounderCreateWebhook: settingsMap.ODOO_FOUNDER_CREATE_WEBHOOK || String(env.ODOO_FOUNDER_CREATE_WEBHOOK || '').trim(),
    odooFounderVerifyWebhook: settingsMap.ODOO_FOUNDER_VERIFY_WEBHOOK || String(env.ODOO_FOUNDER_VERIFY_WEBHOOK || '').trim()
  };
}

async function getOrganizationSecretStatusMapForCompany(env, companyId) {
  const organizationId = await getOrganizationIdForCompany(env, companyId);
  if (!organizationId) return {};

  try {
    return await getOrganizationSecretStatuses(env, organizationId, ORGANIZATION_SECRET_KEYS);
  } catch (e) {
    console.warn('Organization secret status lookup failed:', e);
    return {};
  }
}

async function getResolvedSecretForCompany(env, companyId, key) {
  const envValue = String(env?.[key] || '').trim();
  if (!companyId || !env?.TENANT_SECRETS_MASTER_KEY) {
    return envValue;
  }

  try {
    const organizationId = await getOrganizationIdForCompany(env, companyId);
    if (!organizationId) return envValue;

    const organizationValue = await getOrganizationSecret(env, organizationId, key);
    const normalizedOrganizationValue = String(organizationValue || '').trim();
    return normalizedOrganizationValue || envValue;
  } catch (e) {
    console.warn(`Organization secret resolution failed for ${key}:`, e);
    return envValue;
  }
}

async function getFounderSecretRuntimeConfig(env, companyId) {
  const [turnstileSecret, twilioAccountSid, twilioAuthToken] = await Promise.all([
    getResolvedSecretForCompany(env, companyId, 'TURNSTILE_SECRET'),
    getResolvedSecretForCompany(env, companyId, 'TWILIO_ACCOUNT_SID'),
    getResolvedSecretForCompany(env, companyId, 'TWILIO_AUTH_TOKEN')
  ]);

  return {
    turnstileSecret: turnstileSecret || TURNSTILE_SECRET_FALLBACK,
    twilioAccountSid,
    twilioAuthToken
  };
}

function canOverrideCompanyIdForHost(tenant, url = null) {
  const host = String(tenant?.hostname || url?.hostname || '').toLowerCase();
  return (
    host.includes('workers.dev') ||
    host.startsWith('localhost') ||
    host === '127.0.0.1' ||
    host === '[::1]'
  );
}

async function resolveActiveCompanyId(env, tenant, url) {
  if (!env?.DB) {
    return { ok: false, reason: 'db_unavailable' };
  }

  const queryCompanyById = async (companyId) => {
    try {
      return await env.DB.prepare(
        `SELECT id FROM companies WHERE id = ? AND is_active = 1 LIMIT 1`
      ).bind(companyId).first();
    } catch (error) {
      const message = String(error?.message || error || '').toLowerCase();
      if (message.includes('no such table: companies')) {
        return { __error: 'companies_table_missing' };
      }
      throw error;
    }
  };

  const queryCompanyBySubdomain = async (subdomain) => {
    try {
      return await env.DB.prepare(
        `SELECT id FROM companies WHERE lower(subdomain) = ? AND is_active = 1 LIMIT 1`
      ).bind(subdomain).first();
    } catch (error) {
      const message = String(error?.message || error || '').toLowerCase();
      if (message.includes('no such table: companies')) {
        return { __error: 'companies_table_missing' };
      }
      throw error;
    }
  };

  const allowQueryOverride = canOverrideCompanyIdForHost(tenant, url);
  const queryCompanyId = Number(url.searchParams.get('company_id') || 0);

  if (Number.isInteger(queryCompanyId) && queryCompanyId > 0) {
    if (!allowQueryOverride) {
      return { ok: false, reason: 'override_not_allowed' };
    }

    const overrideCompany = await queryCompanyById(queryCompanyId);
    if (overrideCompany?.__error) {
      return { ok: false, reason: overrideCompany.__error };
    }
    if (overrideCompany?.id) {
      return { ok: true, companyId: Number(overrideCompany.id) };
    }

    return { ok: false, reason: 'override_company_not_found' };
  }

  const tenantCompanyId = Number(tenant?.companyId || 0);
  if (Number.isInteger(tenantCompanyId) && tenantCompanyId > 0) {
    const tenantCompany = await queryCompanyById(tenantCompanyId);
    if (tenantCompany?.__error) {
      return { ok: false, reason: tenantCompany.__error };
    }
    if (tenantCompany?.id) {
      return { ok: true, companyId: Number(tenantCompany.id) };
    }

    return { ok: false, reason: 'tenant_company_not_found' };
  }

  const subdomain = String(tenant?.subdomain || '').trim().toLowerCase();
  if (subdomain && subdomain !== 'www') {
    const subdomainCompany = await queryCompanyBySubdomain(subdomain);
    if (subdomainCompany?.__error) {
      return { ok: false, reason: subdomainCompany.__error };
    }
    if (subdomainCompany?.id) {
      return { ok: true, companyId: Number(subdomainCompany.id) };
    }

    return { ok: false, reason: 'tenant_subdomain_not_found' };
  }

  return { ok: false, reason: 'no_tenant_context' };
}

function getTurnstileSiteKey(env) {
  const siteKey = String(env?.TURNSTILE_SITE_KEY || '').trim();
  return siteKey || TURNSTILE_SITE_KEY_FALLBACK;
}

function isLocalDevelopmentHost(url) {
  const hostname = String(url?.hostname || '').trim().toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function isTurnstileBypassHost(url) {
  const hostname = String(url?.hostname || '').trim().toLowerCase();
  return isLocalDevelopmentHost(url) || hostname.includes('workers.dev');
}

function getResolvedTurnstileSiteKey(env, url = null) {
  if (isLocalDevelopmentHost(url)) {
    return TURNSTILE_SITE_KEY_FALLBACK;
  }

  return getTurnstileSiteKey(env);
}

function injectTurnstileSiteKey(html, env, url = null) {
  return String(html || '').split('__TURNSTILE_SITE_KEY__').join(getResolvedTurnstileSiteKey(env, url));
}

function resolveConfiguredLink(rawLink, baseUrl = '') {
  const value = String(rawLink || '').trim();
  if (!value) return '';

  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).toString();
    } catch {
      return '';
    }
  }

  if (baseUrl) {
    try {
      return new URL(value, baseUrl).toString();
    } catch {
      return value;
    }
  }

  return value;
}

async function getStandardContactFallbackLink(env, companyId, currentUrl = null) {
  const settings = await getOperationalSettingsMap(env, companyId);
  const websiteUrl = String(settings.website_url || '').trim() || String(currentUrl?.origin || '').trim();
  const configuredFallback = String(settings.standard_contact_link || '').trim() || '/contact';
  return resolveConfiguredLink(configuredFallback, websiteUrl);
}

async function buildFounderFormUrlWithSettingsDefaults(env, companyId, currentUrl) {
  const settings = await getOperationalSettingsMap(env, companyId);
  const url = new URL(currentUrl.toString());
  const hasValue = (key) => String(url.searchParams.get(key) || '').trim() !== '';
  const setIfMissing = (key, value) => {
    const normalized = String(value || '').trim();
    if (!normalized || hasValue(key)) return false;
    url.searchParams.set(key, normalized);
    return true;
  };

  const websiteUrl = String(settings.website_url || '').trim();
  const program = String(url.searchParams.get('program') || '').trim().toLowerCase() === 'kc' ? 'kc' : 'founder';
  const prefix = program === 'kc' ? 'kc' : 'founder';

  let changed = false;
  changed = setIfMissing('website_url', websiteUrl) || changed;
  changed = setIfMissing('program_label', settings[`${prefix}_program_label`]) || changed;
  changed = setIfMissing('membership_type', settings[`${prefix}_membership_type`]) || changed;
  changed = setIfMissing('redirect', resolveConfiguredLink(settings[`${prefix}_redirect_link`], websiteUrl)) || changed;
  changed = setIfMissing('terms_url', resolveConfiguredLink(settings[`${prefix}_terms_link`], websiteUrl)) || changed;
  changed = setIfMissing('privacy_url', resolveConfiguredLink(settings.privacy_link, websiteUrl)) || changed;

  return changed ? url : null;
}

async function authorizeStaffByPin(env, companyId, pinRaw) {
  const pin = String(pinRaw || '').trim();
  if (!pin) {
    return { ok: false, status: 401, error: 'Staff PIN required' };
  }

  const staff = await env.DB.prepare(
    `SELECT id, name, role, company_id, is_active FROM staff WHERE company_id = ? AND pin = ? LIMIT 1`
  ).bind(companyId, pin).first();

  if (!staff) {
    return { ok: false, status: 401, error: 'Invalid PIN' };
  }

  if (Number(staff.is_active) === 0) {
    return { ok: false, status: 403, error: 'Staff account is inactive' };
  }

  return { ok: true, staff };
}

async function authorizeAdminByPin(env, companyId, pinRaw) {
  const auth = await authorizeStaffByPin(env, companyId, pinRaw);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      error: auth.error === 'Staff PIN required' ? 'Admin PIN required' : auth.error
    };
  }

  if (String(auth.staff.role || '').toLowerCase() !== 'admin') {
    return { ok: false, status: 403, error: 'Admin role required' };
  }

  return { ok: true, staff: auth.staff };
}

async function authorizeManagerOrAdminByPin(env, companyId, pinRaw) {
  const auth = await authorizeStaffByPin(env, companyId, pinRaw);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      error: auth.error === 'Staff PIN required' ? 'Manager/Admin PIN required' : auth.error
    };
  }

  const role = String(auth.staff.role || '').toLowerCase();
  if (role !== 'manager' && role !== 'admin') {
    return { ok: false, status: 403, error: 'Manager or admin role required' };
  }

  return { ok: true, staff: auth.staff };
}

function normalizeFounderPhone(rawPhone) {
  const input = String(rawPhone || '').trim();
  if (!input) return '';

  let normalized = input.replace(/[\s\-()]/g, '');
  if (normalized.toLowerCase().startsWith('whatsapp:')) {
    normalized = normalized.slice('whatsapp:'.length);
  }
  if (normalized.toLowerCase().startsWith('sms:')) {
    normalized = normalized.slice('sms:'.length);
  }
  if (normalized.toLowerCase().startsWith('tel:')) {
    normalized = normalized.slice('tel:'.length);
  }

  if (normalized.startsWith('00')) {
    normalized = `+${normalized.slice(2)}`;
  } else if (normalized.startsWith('+')) {
    // Keep E.164 style plus prefix.
  } else if (normalized.startsWith('0')) {
    normalized = `+49${normalized.slice(1)}`;
  } else if (normalized.startsWith('49')) {
    normalized = `+${normalized}`;
  } else {
    normalized = `+${normalized}`;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    return '';
  }

  return normalized;
}

function getFounderTestExceptionPhoneSet(env, runtimeConfig = null) {
  const raw = String(runtimeConfig?.founderTestExceptionPhones || env.FOUNDER_TEST_EXCEPTION_PHONES || '').trim();
  if (!raw) return new Set();

  const set = new Set();
  for (const token of raw.split(/[\s,;\n\r\t]+/)) {
    const phone = normalizeFounderPhone(token);
    if (!phone) continue;
    set.add(phone);
  }

  return set;
}

function isFounderNameSuspicious(name) {
  const lowered = String(name || '').toLowerCase();
  return lowered.includes('http') || lowered.includes('.com') || lowered.includes('.net');
}

function parseConsentValue(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'yes' || normalized === 'true' || normalized === '1' || normalized === 'on';
}

function normalizeOptionalEmail(rawEmail) {
  const normalized = String(rawEmail || '').trim().toLowerCase();
  if (!normalized) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return '';
  return normalized;
}

function detectInboundChannel(fromRaw) {
  const value = String(fromRaw || '').trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith('whatsapp:')) return 'whatsapp';
  return 'sms';
}

function getFounderOtpChannels(env, runtimeConfig = null) {
  const raw = String(runtimeConfig?.founderOtpChannels || env.FOUNDER_OTP_CHANNELS || 'whatsapp,sms');
  const channels = raw
    .split(',')
    .map(x => x.trim().toLowerCase())
    .filter(x => x === 'whatsapp' || x === 'sms');

  return channels.length ? Array.from(new Set(channels)) : ['whatsapp', 'sms'];
}

function getTwilioSenders(env, runtimeConfig = null) {
  return {
    whatsapp: String(runtimeConfig?.twilioWhatsappFrom || env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886').trim(),
    sms: String(runtimeConfig?.twilioSmsFrom || env.TWILIO_SMS_FROM || env.TWILIO_PHONE || env.TWILIO_PHONE_NUMBER || '').trim(),
    messagingServiceSid: String(runtimeConfig?.twilioMessagingServiceSid || env.TWILIO_MESSAGING_SERVICE_SID || '').trim()
  };
}

async function sendTwilioMessage(env, { to, from, body, messagingServiceSid = '', credentials = null }) {
  const sid = credentials?.twilioAccountSid || env.TWILIO_ACCOUNT_SID;
  const token = credentials?.twilioAuthToken || env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    return { ok: false, error: 'Twilio credentials missing' };
  }

  const normalizedTo = String(to || '').trim();
  const normalizedFrom = String(from || '').trim();
  const normalizedMessagingServiceSid = String(messagingServiceSid || '').trim();
  if (!normalizedFrom && !normalizedMessagingServiceSid) {
    return { ok: false, error: 'Twilio sender configuration missing' };
  }

  const payload = new URLSearchParams({
    To: normalizedTo,
    Body: String(body || '')
  });

  if (normalizedFrom) {
    payload.set('From', normalizedFrom);
  }

  if (normalizedMessagingServiceSid) {
    payload.set('MessagingServiceSid', normalizedMessagingServiceSid);
  }

  const auth = btoa(`${sid}:${token}`);
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: payload
  });

  if (!response.ok) {
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();

    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => ({}));
      const code = Number(payload?.code || 0) || null;
      const message = String(payload?.message || '').trim() || `HTTP ${response.status}`;
      return {
        ok: false,
        error: `Twilio ${code || response.status}: ${message}`,
        twilioCode: code,
        twilioMessage: message
      };
    }

    const errorText = await response.text();
    return {
      ok: false,
      error: `Twilio HTTP ${response.status}: ${String(errorText || '').trim() || 'Unknown error'}`,
      twilioCode: null,
      twilioMessage: String(errorText || '').trim()
    };
  }

  return { ok: true };
}

function getFounderRegisterPayload({
  name,
  phone,
  email = '',
  companyId,
  nowIso,
  membershipType,
  optInText = FOUNDER_OPT_IN_TEXT,
  founderTermsAccepted = true,
  kcTermsAccepted = false,
  notes = ''
}) {
  const now = new Date(nowIso);

  const berlinDateTime = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(now).replace(' ', ' ');

  const berlinDate = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);

  return {
    _model: 'res.partner',
    name,
    phone,
    email: email || null,
    x_studio_membership_type: membershipType || FOUNDER_DEFAULT_MEMBERSHIP_TYPE,
    x_studio_sms_opt_in_1: 'yes',
    x_studio_opt_in_text: String(optInText || FOUNDER_OPT_IN_TEXT).trim() || FOUNDER_OPT_IN_TEXT,
    x_studio_opt_in_timestamp: berlinDateTime,
    x_studio_founder_terms_accepted: founderTermsAccepted ? 'yes' : 'no',
    x_studio_kc_terms_accepted: kcTermsAccepted ? 'yes' : 'no',
    x_studio_otp_verified: 'no',
    x_studio_founder_status: 'Pending Verification',
    x_studio_founder_level: 'Trial',
    x_studio_last_reminder_date: berlinDate,
    x_studio_total_spent: 0,
    x_number_of_visits: 0,
    x_studio_notes: String(notes || '').trim() || (kcTermsAccepted ? 'KC Form Registration' : 'Founder Form Registration'),
    company_id: companyId
  };
}

async function postOdooWebhook(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, error: text || `HTTP ${response.status}` };
  }

  return { ok: true };
}

async function syncFounderRegisterToOdoo(env, payload, runtimeConfig = null) {
  const webhook = String(runtimeConfig?.odooFounderCreateWebhook || env.ODOO_FOUNDER_CREATE_WEBHOOK || '').trim();
  if (!webhook) {
    return { ok: true, skipped: true };
  }

  return postOdooWebhook(webhook, payload);
}

async function syncFounderVerifyToOdoo(env, payload, runtimeConfig = null) {
  const webhook = String(runtimeConfig?.odooFounderVerifyWebhook || env.ODOO_FOUNDER_VERIFY_WEBHOOK || '').trim();
  if (!webhook) {
    return { ok: true, skipped: true };
  }

  return postOdooWebhook(webhook, payload);
}

/**
 * Fetch per-company Odoo connection config from D1 + settings.
 * Credentials precedence: settings table > companies table column > env var.
 */
async function getOdooConfig(env, companyId) {
  const company = await env.DB.prepare(
    `SELECT odoo_url, odoo_api_token, organization_id, odoo_company_id FROM companies WHERE id = ? LIMIT 1`
  ).bind(companyId).first();

  if (!company) return null;

  const settingsMap = await getSettingsMap(env, companyId, [
    'ODOO_API_TOKEN',
    'odoo_api_token',
    'ODOO_CRM_TEAM_ID',
    'ODOO_BOOKING_CREATE_WEBHOOK',
    'ODOO_BOOKING_STAGE_WEBHOOK'
  ]);

  const org = company.organization_id
    ? await env.DB.prepare(
        `SELECT odoo_db_name FROM organizations WHERE id = ? LIMIT 1`
      ).bind(company.organization_id).first()
    : null;

  return {
    odooUrl: String(company.odoo_url || env.ODOO_URL || '').trim(),
    odooApiToken: String(
      settingsMap.ODOO_API_TOKEN ||
      settingsMap.odoo_api_token ||
      company.odoo_api_token ||
      env.ODOO_API_TOKEN ||
      ''
    ).trim(),
    odooTeamId: Number(settingsMap.ODOO_CRM_TEAM_ID || env.ODOO_CRM_TEAM_ID || 5) || 5,
    odooCompanyId: Number(company.odoo_company_id || 1),
    odooDbName: String(org?.odoo_db_name || env.ODOO_DB_NAME || '').trim(),
    createWebhook: String(
      settingsMap.ODOO_BOOKING_CREATE_WEBHOOK ||
      env.ODOO_BOOKING_CREATE_WEBHOOK ||
      ''
    ).trim(),
    stageWebhook: String(
      settingsMap.ODOO_BOOKING_STAGE_WEBHOOK ||
      env.ODOO_BOOKING_STAGE_WEBHOOK ||
      ''
    ).trim()
  };
}

// Stage map used when pushing booking stage changes to Odoo (CRM stage IDs).
const BOOKING_STAGE_ID_MAP = {
  pending: 1,
  confirmed: 2,
  arrived: 3,
  done: 4,
  cancelled: 5,
  noshow: 6
};

function extractOdooLeadIdFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return '';

  const candidates = [
    payload.odoo_lead_id,
    payload.lead_id,
    payload.id,
    payload?.data?.odoo_lead_id,
    payload?.data?.lead_id,
    payload?.data?.id,
    payload?.result?.odoo_lead_id,
    payload?.result?.lead_id,
    payload?.result?.id
  ];

  for (const candidate of candidates) {
    const value = String(candidate == null ? '' : candidate).trim();
    if (value) return value;
  }

  return '';
}

async function syncBookingCreateToOdoo(env, {
  bookingId,
  companyId,
  name,
  phone,
  email,
  pax,
  date,
  time,
  bookingDateTime,
  area,
  submittedAt,
  flag,
  notes,
  duration,
  staffUser,
  source
}) {
  const config = await getOdooConfig(env, companyId).catch(() => null);

  // ── Primary path: direct Odoo JSON-RPC API ───────────────────────────────
  const PLACEHOLDER = 'YOUR_ODOO_TOKEN_HERE';
  if (
    config?.odooUrl &&
    config.odooApiToken &&
    config.odooApiToken !== PLACEHOLDER
  ) {
    const bookingDatetime = `${date} ${time}`;
    const fields = {
      type: 'opportunity',
      name: 'Reservation',
      team_id: config.odooTeamId,
      stage_id: 1,
      contact_name: name,
      phone,
      email_from: email || false,
      x_studio_booking_datetime: bookingDatetime,
      x_studio_guests: pax,
      x_studio_area: area,
      x_studio_submitted_at: String(submittedAt || '').replace('T', ' ').replace('Z', '').slice(0, 19),
      x_studio_source: source || 'online',
      x_studio_booking_id: bookingId
    };
    if (flag)      fields.x_studio_flag          = flag;
    if (notes)     fields.x_studio_notes         = notes;
    if (staffUser) fields.x_studio_staff         = staffUser;
    if (duration)  fields.x_studio_duration_min  = Number(duration);

    const result = await odooCreateCrmLead(config.odooUrl, config.odooApiToken, fields);
    if (result.ok) {
      return { ok: true, odooLeadId: result.leadId ? String(result.leadId) : null };
    }
    // Log but fall through to webhook fallback
    console.warn('Odoo direct API create failed, trying webhook fallback:', result.error);
  }

  // ── Fallback path: webhook (make.com compatible) ─────────────────────────
  const webhook = String(
    config?.createWebhook ||
    config?.stageWebhook ||
    ''
  ).trim();

  if (!webhook) {
    return { ok: true, skipped: true, odooLeadId: null };
  }

  const payload = {
    _model: 'crm.lead',
    action: 'create_booking_lead',
    booking_id: bookingId,
    company_id: companyId,
    name: `Booking ${name} ${date} ${time}`,
    contact_name: name,
    phone,
    email: email || null,
    guests_pax: pax,
    booking_date: date,
    booking_time: time,
    booking_datetime: bookingDateTime,
    area,
    stage: 'pending',
    stage_id: BOOKING_STAGE_ID_MAP.pending,
    submitted_at: submittedAt
  };

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const rawBody = await response.text();
  if (!response.ok) {
    return { ok: false, error: rawBody || `HTTP ${response.status}`, odooLeadId: null };
  }

  let odooLeadId = '';
  const trimmedBody = String(rawBody || '').trim();
  if (trimmedBody) {
    try {
      const parsed = JSON.parse(trimmedBody);
      odooLeadId = extractOdooLeadIdFromPayload(parsed);
    } catch {
      const labeled = trimmedBody.match(/(?:odoo[_\s-]?lead[_\s-]?id|lead[_\s-]?id|id)\s*[:=]\s*["']?([A-Za-z0-9_-]+)/i);
      if (labeled?.[1]) {
        odooLeadId = String(labeled[1]).trim();
      } else if (/^[A-Za-z0-9_-]{2,80}$/.test(trimmedBody)) {
        odooLeadId = trimmedBody;
      }
    }
  }

  return { ok: true, odooLeadId: odooLeadId || null };
}

async function syncBookingStageToOdoo(env, { bookingId, companyId, newStage, odooLeadId, changedBy, changedAt }) {
  const numericLeadId = Number(odooLeadId);
  const config = await getOdooConfig(env, companyId).catch(() => null);

  // ── Primary path: direct Odoo JSON-RPC write ─────────────────────────────
  const PLACEHOLDER = 'YOUR_ODOO_TOKEN_HERE';
  if (
    numericLeadId > 0 &&
    config?.odooUrl &&
    config.odooApiToken &&
    config.odooApiToken !== PLACEHOLDER
  ) {
    const newStageId = BOOKING_STAGE_ID_MAP[newStage] ?? null;
    if (newStageId) {
      const result = await odooWriteLead(
        config.odooUrl,
        config.odooApiToken,
        numericLeadId,
        { stage_id: newStageId }
      );
      if (result.ok) return { ok: true };
      console.warn('Odoo direct API stage update failed, trying webhook fallback:', result.error);
    }
  }

  // ── Fallback path: webhook ────────────────────────────────────────────────
  const webhook = String(config?.stageWebhook || '').trim();
  if (!webhook) {
    return { ok: true, skipped: true };
  }

  const payload = {
    booking_id: bookingId,
    company_id: companyId,
    stage: newStage,
    stage_id: BOOKING_STAGE_ID_MAP[newStage] ?? null,
    odoo_lead_id: odooLeadId || null,
    changed_by: changedBy || 'staff',
    changed_at: changedAt
  };

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, error: text || `HTTP ${response.status}` };
  }

  return { ok: true };
}

async function syncStaffToOdoo(env, {
  companyId,
  staffId,
  name,
  role,
  isActive,
  permissions,
  updatedBy,
  updatedAt
}) {
  const settingsMap = await getSettingsMap(env, companyId, ['ODOO_STAFF_SYNC_WEBHOOK']);
  const webhook = String(
    settingsMap.ODOO_STAFF_SYNC_WEBHOOK ||
    env.ODOO_STAFF_SYNC_WEBHOOK ||
    ''
  ).trim();

  if (!webhook) {
    return { ok: true, skipped: true };
  }

  const payload = {
    _model: 'hr.employee',
    action: 'upsert',
    staff_id: String(staffId || '').trim(),
    name: String(name || '').trim(),
    role: String(role || '').trim().toLowerCase(),
    is_active: Number(isActive) === 0 ? false : true,
    permissions: parseJsonArray(permissions),
    company_id: companyId,
    updated_by: String(updatedBy || 'admin').trim(),
    updated_at: updatedAt
  };

  return postOdooWebhook(webhook, payload);
}

async function syncBookingStageToBoard(env, { bookingId, companyId, newStage, changedAt }) {
  // Requires a KV namespace bound as BOARD_KV in wrangler.jsonc.
  // When the binding is absent the sync is silently skipped, matching
  // the same no-op-on-missing-config pattern used for Odoo webhooks.
  if (!env.BOARD_KV) {
    return { ok: true, skipped: true };
  }

  const key = `booking:${companyId}:${bookingId}:stage`;
  const value = JSON.stringify({ stage: newStage, updatedAt: changedAt });

  await env.BOARD_KV.put(key, value, { expirationTtl: 60 * 60 * 24 * 90 }); // 90 days
  return { ok: true };
}

function generateOtpCode() {
  return String(Math.floor(Math.random() * 900000) + 100000);
}

async function verifyTurnstileToken(token, env, remoteIp, secretConfig = null, url = null) {
  // Dev bypass: set DISABLE_TURNSTILE_FOR_DEV=true in wrangler.jsonc vars (never in production)
  if (env?.DISABLE_TURNSTILE_FOR_DEV === 'true' && isTurnstileBypassHost(url)) {
    return { success: true, _bypass: 'dev' };
  }

  if (!token) return { success: false };

  const turnstileSecret = isLocalDevelopmentHost(url)
    ? TURNSTILE_SECRET_FALLBACK
    : (secretConfig?.turnstileSecret || env.TURNSTILE_SECRET || TURNSTILE_SECRET_FALLBACK);

  const body = new URLSearchParams({
    secret: turnstileSecret,
    response: token
  });

  if (remoteIp) {
    body.set('remoteip', remoteIp);
  }

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  return await res.json();
}

function getOtpCooldownSecondsRemaining(createdAtIso) {
  if (!createdAtIso) return 0;

  const lastCreatedTs = new Date(createdAtIso).getTime();
  if (!Number.isFinite(lastCreatedTs)) return 0;

  const waitMs = lastCreatedTs + (FOUNDER_OTP_COOLDOWN_SECONDS * 1000) - Date.now();
  return waitMs > 0 ? Math.ceil(waitMs / 1000) : 0;
}

function extractOtpCode(rawInput) {
  const value = String(rawInput || '').trim();
  if (!value) return '';

  const match = value.match(/(\d{6})/);
  return match ? match[1] : '';
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createTwilioMessagingResponse(message) {
  const safeMessage = escapeXml(message || 'OK');
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safeMessage}</Message></Response>`;
  return new Response(twiml, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8' }
  });
}

function createFounderVerifyResponse({ twilioWebhookMode = false, status, message, httpStatus = 200 }) {
  if (twilioWebhookMode) {
    return createTwilioMessagingResponse(message);
  }

  return Response.json({ status, message }, { status: httpStatus });
}

async function parseFounderVerifyInput(request) {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();

  let phoneRaw = '';
  let otpRaw = '';
  let inboundFromRaw = '';

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    phoneRaw = String(body.phone || body.from || body.From || '').trim();
    otpRaw = String(body.otp || body.code || body.body || body.Body || '').trim();
    inboundFromRaw = String(body.from || body.From || '').trim();
  } else {
    const formData = await request.formData();
    phoneRaw = String(formData.get('phone') || formData.get('From') || formData.get('from') || '').trim();
    otpRaw = String(formData.get('otp') || formData.get('code') || formData.get('Body') || '').trim();
    inboundFromRaw = String(formData.get('From') || formData.get('from') || '').trim();
  }

  return {
    phoneRaw,
    otpInput: extractOtpCode(otpRaw),
    inboundFromRaw
  };
}

async function upsertFounderOtpRecord(env, companyId, phone, otpCode, nowIso) {
  const otpId = `otp_${companyId}_${Date.now()}`;
  const expiresAt = new Date(Date.now() + FOUNDER_OTP_EXPIRES_SECONDS * 1000).toISOString();

  await env.DB.prepare(`
    INSERT INTO otp_cache (
      id, company_id, phone, otp_code, expires_at,
      created_at, attempts, last_attempt, verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_id, phone) DO UPDATE SET
      otp_code = excluded.otp_code,
      expires_at = excluded.expires_at,
      created_at = excluded.created_at,
      attempts = 0,
      last_attempt = excluded.last_attempt,
      verified = 0
  `).bind(
    otpId,
    companyId,
    phone,
    otpCode,
    expiresAt,
    nowIso,
    0,
    nowIso,
    0
  ).run();

  return { otpId, expiresAt };
}

async function handleFounderOtpVerificationRequest(request, env, companyId, options = {}) {
  const twilioWebhookMode = !!options.twilioWebhookMode;

  const respond = (status, message, httpStatus = 200) => {
    return createFounderVerifyResponse({
      twilioWebhookMode,
      status,
      message,
      httpStatus
    });
  };

  try {
    const membershipEnabled = await isModuleEnabled(env, companyId, 'module_membership_management');

    if (!membershipEnabled) {
      const fallbackLink = await getStandardContactFallbackLink(env, companyId, new URL(request.url));
      return respond('error', `Community membership is currently disabled. Please use the standard contact form: ${fallbackLink}`, 403);
    }

    const [founderRuntimeConfig, founderSecretConfig] = await Promise.all([
      getFounderRuntimeConfig(env, companyId),
      getFounderSecretRuntimeConfig(env, companyId)
    ]);

    const { phoneRaw, otpInput, inboundFromRaw } = await parseFounderVerifyInput(request);
    const phone = normalizeFounderPhone(phoneRaw);

    if (!phone || !/^\d{6}$/.test(otpInput)) {
      return respond('error', 'OTP muss genau 6 Ziffern enthalten.', 400);
    }

    const otpRecord = await env.DB.prepare(
      `SELECT otp_code, expires_at, attempts, verified FROM otp_cache WHERE company_id = ? AND phone = ? LIMIT 1`
    ).bind(companyId, phone).first();

    if (!otpRecord) {
      return respond('error', 'Kein gueltiger OTP-Eintrag gefunden.', 400);
    }

    const now = new Date().toISOString();

    if (Number(otpRecord.verified) === 1) {
      return respond('error', 'Dieser OTP-Code wurde bereits verwendet. Bitte neuen OTP anfordern.', 409);
    }

    if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
      return respond('error', 'Der OTP-Code ist abgelaufen.', 400);
    }

    if ((otpRecord.attempts || 0) >= 5) {
      return respond('error', 'Zu viele Fehlversuche. Bitte neuen OTP anfordern.', 429);
    }

    if (String(otpRecord.otp_code) !== otpInput) {
      await env.DB.prepare(
        `UPDATE otp_cache SET attempts = attempts + 1, last_attempt = ? WHERE company_id = ? AND phone = ?`
      ).bind(now, companyId, phone).run();

      if (!twilioWebhookMode) {
        await sendFounderVerifyResultViaTwilio(env, phone, inboundFromRaw, false, founderRuntimeConfig, founderSecretConfig);
      }

      return respond('error', 'Der eingegebene Code ist ungueltig.', 400);
    }

    await env.DB.prepare(
      `UPDATE otp_cache SET verified = 1, last_attempt = ? WHERE company_id = ? AND phone = ?`
    ).bind(now, companyId, phone).run();

    await env.DB.prepare(
      `UPDATE customers SET founder_status = ?, otp_verified = 1, updated_at = ?, updated_by = ? WHERE company_id = ? AND phone = ?`
    ).bind('live', now, 'otp_verify', companyId, phone).run();

    const customerRecord = await env.DB.prepare(
      `SELECT founder_terms_accepted, kc_terms_accepted FROM customers WHERE company_id = ? AND phone = ? LIMIT 1`
    ).bind(companyId, phone).first();

    const verifyMembershipType = Number(customerRecord?.kc_terms_accepted) === 1
      ? 'KC'
      : FOUNDER_DEFAULT_MEMBERSHIP_TYPE;
    const activationLabel = verifyMembershipType === 'KC' ? 'KC' : 'Founder';

    const verifySyncResult = await syncFounderVerifyToOdoo(env, {
      _model: 'res.partner',
      phone,
      x_studio_membership_type: verifyMembershipType,
      x_studio_founder_status: 'live',
      x_studio_otp_verified: 'yes',
      updated_at: now,
      company_id: companyId
    }, founderRuntimeConfig);

    if (!verifySyncResult.ok) {
      console.warn('Founder verify Odoo sync failed:', verifySyncResult.error);
    }

    if (!twilioWebhookMode) {
      await sendFounderVerifyResultViaTwilio(env, phone, inboundFromRaw, true, founderRuntimeConfig, founderSecretConfig);
    }

    return respond('success', `OTP verifiziert. Ihre ${activationLabel}-Registrierung ist jetzt aktiv.`, 200);
  } catch (e) {
    console.error('Founder verify error:', e);
    return createFounderVerifyResponse({
      twilioWebhookMode,
      status: 'error',
      message: 'Interner Fehler bei OTP-Verifizierung.',
      httpStatus: 500
    });
  }
}

async function sendFounderOtpViaTwilio(env, phoneE164, name, otpCode, runtimeConfig = null, secretConfig = null) {
  const sid = secretConfig?.twilioAccountSid || env.TWILIO_ACCOUNT_SID;
  const token = secretConfig?.twilioAuthToken || env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    return { ok: false, error: 'Twilio credentials are not configured', channels: [] };
  }

  const channels = getFounderOtpChannels(env, runtimeConfig);
  const senders = getTwilioSenders(env, runtimeConfig);
  const firstName = String(name || '').trim().split(/\s+/)[0] || 'Founder';
  const whatsappMsg = `Hallo ${firstName}! Ihr Code fuer den Founder-Zugang ist: *${otpCode}*. Bitte antworten Sie nur mit diesen 6 Ziffern.\nQUAN ESSKULTUR TEAM`;
  const smsMsg = `Hallo ${firstName}! Ihr Founder-Code ist: ${otpCode}. Bitte senden Sie nur diese 6 Ziffern als Antwort.`;

  const results = [];

  for (const channel of channels) {
    if (channel === 'whatsapp') {
      const attempts = [];
      if (senders.whatsapp) {
        attempts.push({
          from: senders.whatsapp,
          messagingServiceSid: '',
          mode: 'whatsapp_from'
        });
      }
      if (senders.messagingServiceSid) {
        attempts.push({
          from: '',
          messagingServiceSid: senders.messagingServiceSid,
          mode: 'whatsapp_messaging_service'
        });
      }

      if (!attempts.length) {
        results.push({ channel, ok: false, error: 'Missing TWILIO_WHATSAPP_FROM or TWILIO_MESSAGING_SERVICE_SID' });
        continue;
      }

      let delivered = false;
      for (const attempt of attempts) {
        const result = await sendTwilioMessage(env, {
          to: `whatsapp:${phoneE164}`,
          from: attempt.from,
          messagingServiceSid: attempt.messagingServiceSid,
          body: whatsappMsg,
          credentials: secretConfig
        });
        results.push({ channel, mode: attempt.mode, ...result });

        if (result.ok) {
          delivered = true;
          break;
        }
      }

      if (delivered) {
        continue;
      }

      continue;
    }

    if (channel === 'sms') {
      const attempts = [];
      if (senders.sms) {
        attempts.push({
          from: senders.sms,
          messagingServiceSid: '',
          mode: 'sms_from'
        });
      }
      if (senders.messagingServiceSid) {
        attempts.push({
          from: '',
          messagingServiceSid: senders.messagingServiceSid,
          mode: 'sms_messaging_service'
        });
      }

      if (!attempts.length) {
        results.push({ channel, ok: false, error: 'Missing TWILIO_SMS_FROM/TWILIO_PHONE or TWILIO_MESSAGING_SERVICE_SID' });
        continue;
      }

      let delivered = false;
      for (const attempt of attempts) {
        const result = await sendTwilioMessage(env, {
          to: phoneE164,
          from: attempt.from,
          messagingServiceSid: attempt.messagingServiceSid,
          body: smsMsg,
          credentials: secretConfig
        });
        results.push({ channel, mode: attempt.mode, ...result });

        if (result.ok) {
          delivered = true;
          break;
        }
      }

      if (delivered) {
        continue;
      }
    }
  }

  const successCount = results.filter(x => x.ok).length;
  if (successCount === 0) {
    return { ok: false, error: 'OTP delivery failed for all channels', channels: results };
  }

  return { ok: true, skipped: false, channels: results };
}

function getFounderOtpSendFailureMessage(sendResult) {
  const channels = Array.isArray(sendResult?.channels) ? sendResult.channels : [];
  const twilioCodes = channels
    .map((entry) => Number(entry?.twilioCode || 0))
    .filter((code) => Number.isInteger(code) && code > 0);

  if (twilioCodes.includes(20003)) {
    return 'OTP Versand derzeit nicht moeglich. Twilio Zugangsdaten sind ungueltig.';
  }

  if (twilioCodes.includes(21606)) {
    return 'OTP Versand fehlgeschlagen. Die konfigurierte Twilio Absendernummer ist fuer diesen Account nicht gueltig.';
  }

  if (twilioCodes.includes(21608)) {
    return 'OTP Versand fehlgeschlagen. Diese Telefonnummer ist im Twilio Trial Account nicht verifiziert.';
  }

  if (twilioCodes.includes(21614)) {
    return 'Bitte geben Sie eine gueltige Mobiltelefonnummer ein.';
  }

  if (twilioCodes.includes(21408)) {
    return 'OTP Versand fehlgeschlagen. Die Zielregion/Nummer ist fuer diesen Twilio Account nicht freigeschaltet.';
  }

  if (twilioCodes.includes(63015)) {
    return 'WhatsApp OTP konnte nicht zugestellt werden. Bitte zuerst dem Twilio WhatsApp Sandbox beitreten oder SMS nutzen.';
  }

  if (String(sendResult?.error || '').includes('Twilio credentials')) {
    return 'OTP Versand ist derzeit nicht verfuegbar. Bitte spaeter erneut versuchen.';
  }

  return 'OTP konnte nicht gesendet werden. Bitte erneut versuchen.';
}

async function sendFounderVerifyResultViaTwilio(env, phoneE164, fromRaw, isSuccess, runtimeConfig = null, secretConfig = null) {
  const sid = secretConfig?.twilioAccountSid || env.TWILIO_ACCOUNT_SID;
  const token = secretConfig?.twilioAuthToken || env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    return { ok: true, skipped: true };
  }

  const inferredChannel = detectInboundChannel(fromRaw);
  const senders = getTwilioSenders(env, runtimeConfig);
  const channels = inferredChannel ? [inferredChannel] : getFounderOtpChannels(env, runtimeConfig);

  const successMsg = 'Ihr Code wurde erfolgreich verifiziert. Ihre Registrierung ist bestaetigt.';
  const errorMsg = 'Der eingegebene Code ist ungueltig, schon benutzt oder abgelaufen. Bitte versuchen Sie es erneut.';

  const results = [];
  for (const channel of channels) {
    if (channel === 'whatsapp') {
      const attempts = [];
      if (senders.whatsapp) {
        attempts.push({
          from: senders.whatsapp,
          messagingServiceSid: '',
          mode: 'whatsapp_from'
        });
      }
      if (senders.messagingServiceSid) {
        attempts.push({
          from: '',
          messagingServiceSid: senders.messagingServiceSid,
          mode: 'whatsapp_messaging_service'
        });
      }

      if (!attempts.length) {
        results.push({ channel, ok: false, error: 'Missing TWILIO_WHATSAPP_FROM or TWILIO_MESSAGING_SERVICE_SID' });
        continue;
      }

      for (const attempt of attempts) {
        const result = await sendTwilioMessage(env, {
          to: `whatsapp:${phoneE164}`,
          from: attempt.from,
          messagingServiceSid: attempt.messagingServiceSid,
          body: isSuccess ? successMsg : errorMsg,
          credentials: secretConfig
        });
        results.push({ channel, mode: attempt.mode, ...result });

        if (result.ok) {
          break;
        }
      }
      continue;
    }

    if (channel === 'sms') {
      const attempts = [];
      if (senders.sms) {
        attempts.push({
          from: senders.sms,
          messagingServiceSid: '',
          mode: 'sms_from'
        });
      }
      if (senders.messagingServiceSid) {
        attempts.push({
          from: '',
          messagingServiceSid: senders.messagingServiceSid,
          mode: 'sms_messaging_service'
        });
      }

      if (!attempts.length) {
        results.push({ channel, ok: false, error: 'Missing TWILIO_SMS_FROM/TWILIO_PHONE or TWILIO_MESSAGING_SERVICE_SID' });
        continue;
      }

      for (const attempt of attempts) {
        const result = await sendTwilioMessage(env, {
          to: phoneE164,
          from: attempt.from,
          messagingServiceSid: attempt.messagingServiceSid,
          body: isSuccess ? successMsg : errorMsg,
          credentials: secretConfig
        });
        results.push({ channel, mode: attempt.mode, ...result });

        if (result.ok) {
          break;
        }
      }
    }
  }

  return { ok: results.some(x => x.ok) || results.length === 0, channels: results };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const tenant = getTenantContext(request);

    // Initialize D1 once per DB binding before handling the first non-static request.
    // This avoids fresh-runtime failures on POST-only flows such as OTP register.
    if (env?.DB && !initializedDatabases.has(env.DB) && !url.pathname.startsWith("/static")) {
      try {
        await initializeDatabase(env.DB);
        initializedDatabases.add(env.DB);
        console.log("✅ Database initialized successfully");
      } catch (e) {
        console.error("❌ DB init error:", e.message);
      }
    }

    let activeCompanyId = null;
    let activeCompanyResolution = { ok: false, reason: 'unresolved' };
    try {
      activeCompanyResolution = await resolveActiveCompanyId(env, tenant, url);
    } catch (e) {
      console.warn('Company resolution error:', e?.message || e);
      activeCompanyResolution = { ok: false, reason: 'resolution_error' };
    }

    if (activeCompanyResolution.ok) {
      activeCompanyId = activeCompanyResolution.companyId;
    } else {
      console.warn('Tenant resolution failed:', activeCompanyResolution.reason);
    }

    const runTenantRoute = (handler) => requireTenant(handler)({
      request,
      env,
      ctx,
      tenant,
      url,
      activeCompanyResolution
    });

    // ==================== HEALTH CHECK ====================
    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        service: "ess-admin-ds",
        time: new Date().toISOString()
      });
    }

    // ==================== ADMIN UI ====================
    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      return new Response(adminUI, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // ==================== APP UI (STAFF APP) ====================
    if (url.pathname === "/app" || url.pathname === "/app/") {
      return new Response(appUI, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // ==================== PLATFORM SITE ====================
    if (url.pathname === "/platform" || url.pathname === "/platform/" || url.pathname === "/platform/index.html") {
      return new Response(platformHomeUI, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    if (url.pathname === "/platform/signup" || url.pathname === "/platform/signup.html") {
      return new Response(platformSignupUI, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    if (url.pathname === "/platform/admin" || url.pathname === "/platform/admin.html") {
      return new Response(platformAdminUI, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    if (url.pathname === "/platform/contact" || url.pathname === "/platform/contact.html") {
      return new Response(platformContactUI, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    if (url.pathname === "/platform/legal/terms" || url.pathname === "/platform/legal/terms.html") {
      return new Response(platformTermsUI, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    if (url.pathname === "/platform/legal/privacy" || url.pathname === "/platform/legal/privacy.html") {
      return new Response(platformPrivacyUI, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    if (url.pathname === "/platform/legal/impressum" || url.pathname === "/platform/legal/impressum.html") {
      return new Response(platformImpressumUI, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // ==================== PLATFORM API ====================
    if (url.pathname === "/api/platform/plans" && request.method === "GET") {
      try {
        const settingsMap = await getPlatformMarketingSettings(env);
        return Response.json(buildPlatformPlansResponse(settingsMap));
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    if (url.pathname === "/api/platform/signup/check-subdomain" && request.method === "GET") {
      try {
        const requestedSlug = normalizeTenantSubdomain(url.searchParams.get('slug') || '');
        if (!requestedSlug || !isValidTenantSubdomain(requestedSlug)) {
          return Response.json({ ok: false, code: 'validation_failed', message: 'Subdomain must use lowercase letters, numbers, and hyphens.' }, { status: 400 });
        }

        const existing = await env.DB.prepare(`
          SELECT id FROM companies WHERE lower(subdomain) = lower(?) LIMIT 1
        `).bind(requestedSlug).first();

        if (existing?.id) {
          return Response.json({ ok: false, code: 'subdomain_taken', available: false, slug: requestedSlug, suggestion: `${requestedSlug}-2` }, { status: 409 });
        }

        return Response.json({ ok: true, available: true, slug: requestedSlug, url: `https://${requestedSlug}.restaurantos.app` });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    if (url.pathname === "/api/platform/contact" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const name = String(body?.name || '').trim();
        const email = normalizeOptionalEmail(body?.email || '');
        const subject = String(body?.subject || '').trim();
        const message = String(body?.message || '').trim();

        if (!name || !message) {
          return Response.json({ ok: false, code: 'validation_failed', message: 'Name and message are required.' }, { status: 400 });
        }

        await env.DB.prepare(`
          INSERT INTO platform_contacts (id, name, email, subject, message, submitted_at, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(),
          name,
          email,
          subject,
          message,
          new Date().toISOString(),
          'new'
        ).run();

        return Response.json({ ok: true, message: 'Message received.' });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    if (url.pathname === "/api/platform/admin/dashboard" && request.method === "GET") {
      try {
        const pin = String(url.searchParams.get('pin') || request.headers.get('x-admin-pin') || '').trim();
        const auth = await authorizePlatformOperator(env, pin);
        if (!auth.ok) {
          return Response.json({ ok: false, error: auth.error }, { status: auth.status });
        }

        const dashboard = await getPlatformAdminDashboard(env);
        return Response.json({ ok: true, ...dashboard });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    if (url.pathname === "/api/platform/admin/config" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const pin = String(body?.pin || '').trim();
        const auth = await authorizePlatformOperator(env, pin);
        if (!auth.ok) {
          return Response.json({ ok: false, error: auth.error }, { status: auth.status });
        }

        const incoming = body?.values && typeof body.values === 'object' ? body.values : {};
        const updatedBy = String(auth.staff.name || auth.staff.id || 'platform-admin');
        for (const key of Object.keys(PLATFORM_PRICING_DEFAULTS)) {
          if (!(key in incoming)) continue;
          await upsertSettingValue(env, PLATFORM_OPERATOR_COMPANY_ID, key, String(incoming[key] ?? '').trim(), OPERATIONAL_KEY_DESCRIPTIONS[key] || 'Platform operator setting', updatedBy);
        }

        const pricingSettings = await getPlatformMarketingSettings(env);
        return Response.json({ ok: true, pricingSettings });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    if (url.pathname === "/api/platform/admin/signup-followup" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const pin = String(body?.pin || '').trim();
        const auth = await authorizePlatformOperator(env, pin);
        if (!auth.ok) {
          return Response.json({ ok: false, error: auth.error }, { status: auth.status });
        }

        const signupId = String(body?.signupId || '').trim();
        const followUpStatus = String(body?.followUpStatus || '').trim() || 'new';
        const followUpNote = String(body?.followUpNote || '').trim();
        if (!signupId) {
          return Response.json({ ok: false, error: 'signupId required' }, { status: 400 });
        }

        await env.DB.prepare(`
          UPDATE platform_signups
          SET follow_up_status = ?, follow_up_note = ?, followed_up_at = ?
          WHERE id = ?
        `).bind(followUpStatus, followUpNote, new Date().toISOString(), signupId).run();

        return Response.json({ ok: true, signupId, followUpStatus });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    if (url.pathname === "/api/platform/signup" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const restaurantName = String(body?.restaurant_name || '').trim();
        const ownerEmail = normalizeOptionalEmail(body?.owner_email || '');
        const ownerPhone = normalizeFounderPhone(body?.owner_phone || '');
        const requestedSlug = normalizeTenantSubdomain(body?.subdomain || '');
        const plan = normalizePlanId(body?.plan || '');
        const country = String(body?.country || 'DE').trim().slice(0, 10);
        const timezone = String(body?.timezone || 'Europe/Berlin').trim() || 'Europe/Berlin';
        const adminPin = String(body?.admin_pin || '').trim();
        const adminName = String(body?.admin_name || 'Owner').trim() || 'Owner';
        const websiteTemplate = normalizeWebsiteTemplate(body?.website_template || 'modern');
        const staffUsers = Math.max(1, Number(body?.staff_users || 1));
        const demoPayment = parseBooleanLike(body?.demo_payment, true);
        const extras = body?.extras && typeof body.extras === 'object' ? body.extras : {};

        if (!restaurantName || !ownerEmail || !requestedSlug || !plan) {
          return Response.json({ ok: false, code: 'validation_failed', message: 'Restaurant name, owner email, plan, and subdomain are required.' }, { status: 400 });
        }

        if (!isValidTenantSubdomain(requestedSlug)) {
          return Response.json({ ok: false, code: 'validation_failed', message: 'Subdomain must use lowercase letters, numbers, and hyphens.' }, { status: 400 });
        }

        if (!/^\d{4}$/.test(adminPin)) {
          return Response.json({ ok: false, code: 'validation_failed', message: 'Admin PIN must be exactly 4 digits.' }, { status: 400 });
        }

        const existingSubdomain = await env.DB.prepare(`SELECT id FROM companies WHERE lower(subdomain) = lower(?) LIMIT 1`).bind(requestedSlug).first();
        if (existingSubdomain?.id) {
          return Response.json({ ok: false, code: 'subdomain_taken', message: 'Subdomain already in use.' }, { status: 409 });
        }

        const existingEmail = await env.DB.prepare(`SELECT id FROM companies WHERE lower(email) = lower(?) LIMIT 1`).bind(ownerEmail).first();
        if (existingEmail?.id) {
          return Response.json({ ok: false, code: 'email_already_registered', message: 'This owner email is already registered.' }, { status: 409 });
        }

        const now = new Date().toISOString();
        const [organizationId, companyId, pricingSettings] = await Promise.all([
          getNextIntegerId(env, 'organizations'),
          getNextIntegerId(env, 'companies'),
          getPlatformMarketingSettings(env)
        ]);

        const paymentSummary = computeDemoPaymentSummary(plan, staffUsers, extras, pricingSettings);

        await env.DB.prepare(`
          INSERT INTO organizations (id, slug, name, billing_email, phone, is_active, timezone, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
        `).bind(
          organizationId,
          `${requestedSlug}-org`,
          restaurantName,
          ownerEmail,
          ownerPhone,
          timezone,
          now,
          now
        ).run();

        await cloneOrganizationDefaults(env, PLATFORM_OPERATOR_COMPANY_ID, organizationId, 'platform-signup');

        await env.DB.prepare(`
          INSERT INTO companies (id, organization_id, subdomain, name, email, phone, is_active, timezone, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        `).bind(
          companyId,
          organizationId,
          requestedSlug,
          restaurantName,
          ownerEmail,
          ownerPhone,
          timezone,
          now,
          now
        ).run();

        await env.DB.prepare(`
          INSERT INTO staff (id, company_id, name, pin, role, is_active, permissions, created_at, updated_at, created_by, updated_by)
          VALUES (?, ?, ?, ?, 'admin', 1, ?, ?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(),
          companyId,
          adminName,
          adminPin,
          JSON.stringify(['*']),
          now,
          now,
          'platform-signup',
          'platform-signup'
        ).run();

        const websiteUrl = `https://${requestedSlug}.restaurantos.app`;
        const initialSettings = {
          website_url: websiteUrl,
          booking_email: ownerEmail,
          standard_contact_link: '/contact',
          site_template: websiteTemplate,
          site_tagline: WEBSITE_BUILDER_DEFAULTS.site_tagline,
          site_hero_title: WEBSITE_BUILDER_DEFAULTS.site_hero_title,
          site_hero_subtitle: WEBSITE_BUILDER_DEFAULTS.site_hero_subtitle,
          site_about_title: WEBSITE_BUILDER_DEFAULTS.site_about_title,
          site_about_body: WEBSITE_BUILDER_DEFAULTS.site_about_body,
          site_primary_cta_text: WEBSITE_BUILDER_DEFAULTS.site_primary_cta_text,
          site_secondary_cta_text: WEBSITE_BUILDER_DEFAULTS.site_secondary_cta_text,
          site_accent_color: normalizeHexColor(body?.site_accent_color || WEBSITE_BUILDER_DEFAULTS.site_accent_color),
          company_plan: plan,
          billing_include_setup: String(parseBooleanLike(extras?.includeSetup, true)),
          billing_include_tse: String(parseBooleanLike(extras?.includeTse, false)),
          billing_include_support_retainer: String(parseBooleanLike(extras?.includeSupportRetainer, false)),
          demo_payment_status: paymentSummary.paymentStatus,
          demo_payment_due_today_eur: String(paymentSummary.dueTodayEur),
          demo_payment_recurring_monthly_eur: String(paymentSummary.recurringMonthlyEur),
          billable_staff_count: String(Math.max(1, staffUsers)),
          country_code: country
        };

        for (const [key, value] of Object.entries(initialSettings)) {
          await upsertSettingValue(env, companyId, key, String(value || ''), `Platform signup setting: ${key}`, 'platform-signup');
        }

        await env.DB.prepare(`
          INSERT INTO platform_signups (
            id, company_id, organization_id, restaurant_name, owner_email, owner_phone, subdomain, plan,
            website_template, staff_users, country, payment_status, due_today_eur, recurring_monthly_eur,
            raw_payload_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(),
          companyId,
          organizationId,
          restaurantName,
          ownerEmail,
          ownerPhone,
          requestedSlug,
          plan,
          websiteTemplate,
          Math.max(1, staffUsers),
          country,
          paymentSummary.paymentStatus,
          Number(paymentSummary.dueTodayEur || 0),
          Number(paymentSummary.recurringMonthlyEur || 0),
          JSON.stringify(body || {}),
          now
        ).run();

        const previewAdminUrl = `${url.origin}/admin?company_id=${companyId}`;
        const previewBoardUrl = `${url.origin}/board?company_id=${companyId}`;

        return Response.json({
          ok: true,
          message: demoPayment ? 'Demo payment completed. Account created.' : 'Account created.',
          company_id: companyId,
          organization_id: organizationId,
          subdomain: requestedSlug,
          website_url: websiteUrl,
          preview_admin_url: previewAdminUrl,
          preview_board_url: previewBoardUrl,
          payment: paymentSummary,
          admin_pin_hint: adminPin,
          status: 'trial_active'
        }, { status: 201 });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    // ==================== BOOKING FORM ====================
    if (url.pathname === "/booking-form.html" || url.pathname === "/booking-form") {
      return runTenantRoute(async ({ companyId }) => {
        const bookingEnabled = await isModuleEnabled(env, companyId, 'module_booking_management');
        if (!bookingEnabled) {
          return new Response('Booking management module is disabled for this restaurant.', {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        }

        return new Response(injectTurnstileSiteKey(bookingForm, env, url), {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      });
    }

    // ==================== RESERVIERUNG PAGE ====================
    if (url.pathname === "/reservierung" || url.pathname === "/reservierung.html") {
      return runTenantRoute(async ({ companyId }) => {
        const bookingEnabled = await isModuleEnabled(env, companyId, 'module_booking_management');
        if (!bookingEnabled) {
          return new Response('Booking management module is disabled for this restaurant.', {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        }

        return new Response(reservieungPage, {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      });
    }

    // ==================== THANK YOU PAGE ====================
    if (url.pathname === "/danke-reservierung" || url.pathname === "/danke-reservierung.html") {
      return new Response(thankYouPage, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // ==================== KC FORM (COMPAT REDIRECT) ====================
    if (url.pathname === "/kc" || url.pathname === "/kc-form" || url.pathname === "/kc-form.html") {
      const target = new URL(request.url);
      target.pathname = '/founder';
      if (!String(target.searchParams.get('program') || '').trim()) {
        target.searchParams.set('program', 'kc');
      }

      return Response.redirect(target.toString(), 302);
    }

    // ==================== FOUNDER FORM ====================
    if (url.pathname === "/founder" || url.pathname === "/founder-form" || url.pathname === "/founder-form.html") {
      return runTenantRoute(async ({ companyId }) => {
        const membershipEnabled = await isModuleEnabled(env, companyId, 'module_membership_management');

        if (!membershipEnabled) {
          const fallbackLink = await getStandardContactFallbackLink(env, companyId, url);
          if (fallbackLink) {
            return Response.redirect(fallbackLink, 302);
          }

          return new Response('Community membership module is disabled for this restaurant.', {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        }

        const hydratedUrl = await buildFounderFormUrlWithSettingsDefaults(env, companyId, url);
        if (hydratedUrl) {
          return Response.redirect(hydratedUrl.toString(), 302);
        }

        return new Response(injectTurnstileSiteKey(founderFormUI, env, url), {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      });
    }

    // ==================== API: FOUNDER REGISTER ====================
    if ((url.pathname === "/api/founder/register" || url.pathname === '/api/kc/register') && request.method === "POST") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const contentType = (request.headers.get('content-type') || '').toLowerCase();
        let getField = (_key, _fallback = '') => '';

        if (contentType.includes('application/json')) {
          const body = await request.json().catch(() => ({}));
          getField = (key, fallback = '') => {
            const value = body?.[key];
            return String(value == null ? fallback : value).trim();
          };
        } else {
          const formData = await request.formData();
          getField = (key, fallback = '') => {
            const value = formData.get(key);
            return String(value == null ? fallback : value).trim();
          };
        }
        const membershipEnabled = await isModuleEnabled(env, companyId, 'module_membership_management');

        if (!membershipEnabled) {
          const fallbackLink = await getStandardContactFallbackLink(env, companyId, url);
          return Response.json({
            status: 'error',
            message: 'Community membership is disabled. Please use the standard contact form.',
            fallback_link: fallbackLink || null
          }, { status: 403 });
        }

        const [founderRuntimeConfig, founderSecretConfig] = await Promise.all([
          getFounderRuntimeConfig(env, companyId),
          getFounderSecretRuntimeConfig(env, companyId)
        ]);

        const name = getField('name');
        const phoneRaw = getField('phone');
        const emailRaw = getField('email');
        const email = normalizeOptionalEmail(emailRaw);
        const cfToken = getField('cf_token');
        const honeypot = getField('hp_confirm_data');
        const consentSms = parseConsentValue(getField('consent_sms'));
        const consentTerms = parseConsentValue(getField('consent_terms'));
        const founderTermsAccepted = parseConsentValue(getField('x_studio_founder_terms_accepted'));
        const kcTermsAccepted = parseConsentValue(getField('x_studio_kc_terms_accepted'));
        const optInTextRaw = getField('x_studio_opt_in_text', FOUNDER_OPT_IN_TEXT);
        const optInText = optInTextRaw || FOUNDER_OPT_IN_TEXT;
        const notesRaw = getField('x_studio_notes');
        const membershipTypeRaw = getField('x_studio_membership_type');
        const membershipType = membershipTypeRaw || (kcTermsAccepted ? 'KC' : FOUNDER_DEFAULT_MEMBERSHIP_TYPE);
        let founderTermsFlag = founderTermsAccepted ? 1 : 0;
        let kcTermsFlag = kcTermsAccepted ? 1 : 0;
        if (!founderTermsFlag && !kcTermsFlag) {
          if (String(membershipType).toLowerCase() === 'kc') kcTermsFlag = 1;
          else founderTermsFlag = 1;
        }
        const notes = notesRaw || (kcTermsFlag ? 'KC Form Registration' : 'Founder Form Registration');

        if (honeypot) {
          return Response.json({ status: 'error', message: 'Ungueltige Anfrage.' }, { status: 400 });
        }

        if (!name || !phoneRaw) {
          return Response.json({ status: 'error', message: 'Name und Mobiltelefon sind erforderlich.' }, { status: 400 });
        }

        if (emailRaw && !email) {
          return Response.json({ status: 'error', message: 'Bitte geben Sie eine gueltige E-Mail-Adresse ein.' }, { status: 400 });
        }

        if (name.length < 2 || name.length > 80 || isFounderNameSuspicious(name)) {
          return Response.json({ status: 'error', message: 'Bitte pruefen Sie Ihren Namen.' }, { status: 400 });
        }

        const phone = normalizeFounderPhone(phoneRaw);
        if (!phone) {
          return Response.json({ status: 'error', message: 'Bitte geben Sie eine gueltige Telefonnummer ein.' }, { status: 400 });
        }

        const founderTestExceptionPhoneSet = getFounderTestExceptionPhoneSet(env, founderRuntimeConfig);
        const isFounderTestExceptionPhone = founderTestExceptionPhoneSet.has(phone);

        if (!consentSms || !consentTerms) {
          return Response.json({ status: 'error', message: 'Bitte akzeptieren Sie die erforderlichen Einwilligungen.' }, { status: 400 });
        }

        const turnstile = await verifyTurnstileToken(cfToken, env, request.headers.get('CF-Connecting-IP'), founderSecretConfig, url);
        if (!turnstile.success) {
          return Response.json({ status: 'error', message: 'Sicherheitspruefung fehlgeschlagen.' }, { status: 400 });
        }

        const existing = await env.DB.prepare(
          `SELECT id, founder_status, founder_terms_accepted, kc_terms_accepted FROM customers WHERE company_id = ? AND phone = ? LIMIT 1`
        ).bind(companyId, phone).first();

        const existingStatus = String(existing?.founder_status || '').toLowerCase();
        const isExistingPending = existingStatus === 'pending_verification';
        const existingHasFounderTerms = Number(existing?.founder_terms_accepted) === 1;
        const existingHasKcTerms = Number(existing?.kc_terms_accepted) === 1;
        const alreadyActiveForRequestedProgram =
          (kcTermsFlag === 1 && existingHasKcTerms) ||
          (founderTermsFlag === 1 && existingHasFounderTerms);
        const shouldAllowLiveReverification = existingStatus === 'live' && (!alreadyActiveForRequestedProgram || isFounderTestExceptionPhone);
        const isPendingRegistration = isExistingPending || shouldAllowLiveReverification;

        if (existingStatus === 'live' && alreadyActiveForRequestedProgram && !isFounderTestExceptionPhone) {
          return Response.json({
            status: 'error',
            message: 'Diese Mobiltelefonnummer ist bereits registriert.'
          }, { status: 409 });
        }

        const existingOtp = await env.DB.prepare(
          `SELECT created_at FROM otp_cache WHERE company_id = ? AND phone = ? LIMIT 1`
        ).bind(companyId, phone).first();

        const waitSec = getOtpCooldownSecondsRemaining(existingOtp?.created_at);
        if (waitSec > 0) {
          return Response.json({
            status: 'error',
            message: `Bitte warten Sie ${waitSec}s bevor Sie einen neuen OTP anfordern.`
          }, { status: 429 });
        }

        const now = new Date().toISOString();
        const customerId = existing?.id || `customer_${companyId}_${Date.now()}`;

        await env.DB.prepare(`
          INSERT INTO customers (
            id, company_id, phone, name, email,
            founder_status, founder_level, founder_terms_accepted, kc_terms_accepted,
            otp_verified, sms_opt_in, opt_in_text, opt_in_timestamp,
            created_at, updated_at, created_by, updated_by, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(company_id, phone) DO UPDATE SET
            name = excluded.name,
            email = COALESCE(excluded.email, customers.email),
            founder_status = excluded.founder_status,
            founder_level = excluded.founder_level,
            founder_terms_accepted = CASE
              WHEN customers.founder_terms_accepted = 1 OR excluded.founder_terms_accepted = 1 THEN 1
              ELSE 0
            END,
            kc_terms_accepted = CASE
              WHEN customers.kc_terms_accepted = 1 OR excluded.kc_terms_accepted = 1 THEN 1
              ELSE 0
            END,
            otp_verified = excluded.otp_verified,
            sms_opt_in = excluded.sms_opt_in,
            opt_in_text = excluded.opt_in_text,
            opt_in_timestamp = excluded.opt_in_timestamp,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by,
            notes = excluded.notes
        `).bind(
          customerId,
          companyId,
          phone,
          name,
          email || null,
          'pending_verification',
          'trial',
          founderTermsFlag,
          kcTermsFlag,
          0,
          1,
          optInText,
          now,
          now,
          now,
          'founder_form',
          'founder_form',
          notes
        ).run();

        const otpCode = generateOtpCode();
        await upsertFounderOtpRecord(env, companyId, phone, otpCode, now);

        const skipRegisterSyncForTestException = isFounderTestExceptionPhone && existingStatus === 'live' && alreadyActiveForRequestedProgram;
        if (!isExistingPending && !skipRegisterSyncForTestException) {
          const registerSyncPayload = getFounderRegisterPayload({
            name,
            phone,
            email,
            companyId,
            nowIso: now,
            membershipType,
            optInText,
            founderTermsAccepted: founderTermsFlag === 1,
            kcTermsAccepted: kcTermsFlag === 1,
            notes
          });

          const registerSyncResult = await syncFounderRegisterToOdoo(env, registerSyncPayload, founderRuntimeConfig);
          if (!registerSyncResult.ok) {
            console.warn('Founder register Odoo sync failed:', registerSyncResult.error);
          }
        }

        const sendResult = await sendFounderOtpViaTwilio(env, phone, name, otpCode, founderRuntimeConfig, founderSecretConfig);
        if (!sendResult.ok) {
          console.warn('Founder OTP send failed (register):', sendResult);
          const message = getFounderOtpSendFailureMessage(sendResult);
          return Response.json({ status: 'error', message }, { status: 500 });
        }

        return Response.json({
          status: 'success',
          message: isExistingPending ? 'OTP wurde erneut gesendet.' : 'OTP wurde gesendet.',
          phone,
          nextStep: 'verify_otp'
        });
        } catch (e) {
          console.error('Founder register error:', e);
          return Response.json({ status: 'error', message: 'Interner Fehler bei der Registrierung.' }, { status: 500 });
        }
      });
    }

    // ==================== API: FOUNDER OTP RESEND ====================
    if ((url.pathname === '/api/founder/resend-otp' || url.pathname === '/api/kc/resend-otp') && request.method === 'POST') {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const membershipEnabled = await isModuleEnabled(env, companyId, 'module_membership_management');

        if (!membershipEnabled) {
          const fallbackLink = await getStandardContactFallbackLink(env, companyId, url);
          return Response.json({
            status: 'error',
            message: 'Community membership is disabled. Please use the standard contact form.',
            fallback_link: fallbackLink || null
          }, { status: 403 });
        }

        const [founderRuntimeConfig, founderSecretConfig] = await Promise.all([
          getFounderRuntimeConfig(env, companyId),
          getFounderSecretRuntimeConfig(env, companyId)
        ]);

        const contentType = (request.headers.get('content-type') || '').toLowerCase();
        let phoneRaw = '';
        let nameRaw = '';

        if (contentType.includes('application/json')) {
          const body = await request.json().catch(() => ({}));
          phoneRaw = String(body.phone || '').trim();
          nameRaw = String(body.name || '').trim();
        } else {
          const formData = await request.formData();
          phoneRaw = String(formData.get('phone') || '').trim();
          nameRaw = String(formData.get('name') || '').trim();
        }

        const phone = normalizeFounderPhone(phoneRaw);
        if (!phone) {
          return Response.json({ status: 'error', message: 'Bitte geben Sie eine gueltige Telefonnummer ein.' }, { status: 400 });
        }

        const founderTestExceptionPhoneSet = getFounderTestExceptionPhoneSet(env, founderRuntimeConfig);
        const isFounderTestExceptionPhone = founderTestExceptionPhoneSet.has(phone);

        const existingCustomer = await env.DB.prepare(
          `SELECT id, name, founder_status FROM customers WHERE company_id = ? AND phone = ? LIMIT 1`
        ).bind(companyId, phone).first();

        if (!existingCustomer) {
          return Response.json({ status: 'error', message: 'Bitte zuerst registrieren.' }, { status: 404 });
        }

        const founderStatus = String(existingCustomer.founder_status || '').toLowerCase();
        if (founderStatus === 'live' && !isFounderTestExceptionPhone) {
          return Response.json({ status: 'error', message: 'Diese Nummer ist bereits verifiziert.' }, { status: 409 });
        }

        const canResendForTestException = isFounderTestExceptionPhone && founderStatus === 'live';
        if (founderStatus !== 'pending_verification' && !canResendForTestException) {
          return Response.json({ status: 'error', message: 'Fuer diese Nummer kann derzeit kein OTP angefordert werden.' }, { status: 409 });
        }

        const existingOtp = await env.DB.prepare(
          `SELECT created_at FROM otp_cache WHERE company_id = ? AND phone = ? LIMIT 1`
        ).bind(companyId, phone).first();

        const waitSec = getOtpCooldownSecondsRemaining(existingOtp?.created_at);
        if (waitSec > 0) {
          return Response.json({
            status: 'error',
            message: `Bitte warten Sie ${waitSec}s bevor Sie einen neuen OTP anfordern.`
          }, { status: 429 });
        }

        const now = new Date().toISOString();
        const otpCode = generateOtpCode();
        await upsertFounderOtpRecord(env, companyId, phone, otpCode, now);

        const founderName = nameRaw || String(existingCustomer.name || '').trim() || 'Founder';
        const sendResult = await sendFounderOtpViaTwilio(env, phone, founderName, otpCode, founderRuntimeConfig, founderSecretConfig);
        if (!sendResult.ok) {
          console.warn('Founder OTP send failed (resend):', sendResult);
          const message = getFounderOtpSendFailureMessage(sendResult);
          return Response.json({ status: 'error', message }, { status: 500 });
        }

        return Response.json({
          status: 'success',
          message: 'OTP wurde erneut gesendet.',
          phone,
          nextStep: 'verify_otp'
        });
        } catch (e) {
          console.error('Founder resend OTP error:', e);
          return Response.json({ status: 'error', message: 'Interner Fehler beim erneuten Senden des OTP.' }, { status: 500 });
        }
      });
    }

    // ==================== API: FOUNDER OTP VERIFY (TWILIO WEBHOOK) ====================
    if ((url.pathname === '/webhooks/twilio/founder-otp' || url.pathname === '/api/webhooks/twilio/founder-otp') && request.method === 'POST') {
      return runTenantRoute(async ({ companyId }) => {
        return handleFounderOtpVerificationRequest(request, env, companyId, { twilioWebhookMode: true });
      });
    }

    // ==================== API: FOUNDER OTP VERIFY ====================
    if ((url.pathname === '/api/founder/verify' || url.pathname === '/api/kc/verify') && request.method === 'POST') {
      return runTenantRoute(async ({ companyId }) => {
        return handleFounderOtpVerificationRequest(request, env, companyId);
      });
    }

    // ==================== API: STAFF AUTH ====================
    if (url.pathname === "/api/staff/auth" && request.method === "GET") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const pin = url.searchParams.get("pin");
        if (!pin) {
          return Response.json({ success: false, error: "PIN required" }, { status: 400 });
        }

        const auth = await authorizeStaffByPin(env, companyId, pin);
        if (!auth.ok) {
          return Response.json(
            { success: false, error: auth.error },
            { status: auth.status }
          );
        }

        const staff = auth.staff;
        if (!validateTenantAccess(staff.company_id, companyId)) {
          return Response.json(
            { success: false, error: "Access denied" },
            { status: 403 }
          );
        }

        return Response.json({
          success: true,
          staffId: staff.id,
          staffName: staff.name,
          companyId: staff.company_id,
          role: staff.role
        });
        } catch (e) {
          console.error("Auth error:", e);
          return Response.json(
            { success: false, error: e.message },
            { status: 500 }
          );
        }
      });
    }

    // ==================== API: CONTACTS ====================
    if (url.pathname === "/api/contacts" && request.method === "GET") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const pin = String(url.searchParams.get('pin') || request.headers.get('x-staff-pin') || request.headers.get('x-admin-pin') || '').trim();
        const statusFilter = String(url.searchParams.get('status') || '').trim();
        const auth = await authorizeStaffByPin(env, companyId, pin);

        if (!auth.ok) {
          return Response.json({ ok: false, error: auth.error }, { status: auth.status });
        }

        let result;
        if (statusFilter) {
          result = await env.DB.prepare(`
            SELECT id, name, email, phone, subject, message, summary, is_meaningful, status, pushed_to_gmail, submitted_at, processed_at, processed_by
            FROM contacts
            WHERE company_id = ? AND status = ?
            ORDER BY submitted_at DESC
            LIMIT 100
          `).bind(companyId, statusFilter).all();
        } else {
          result = await env.DB.prepare(`
            SELECT id, name, email, phone, subject, message, summary, is_meaningful, status, pushed_to_gmail, submitted_at, processed_at, processed_by
            FROM contacts
            WHERE company_id = ?
            ORDER BY submitted_at DESC
            LIMIT 100
          `).bind(companyId).all();
        }

        return Response.json({
          ok: true,
          companyId,
          data: result.results || []
        });
        } catch (e) {
          console.error('Contacts GET error:', e);
          return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
      });
    }

    if (url.pathname.match(/^\/api\/contacts\/([^\/]+)\/push$/) && request.method === "POST") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const routeMatch = url.pathname.match(/^\/api\/contacts\/([^\/]+)\/push$/);
        const contactId = decodeURIComponent(String(routeMatch?.[1] || '')).trim();
        const body = await request.json().catch(() => ({}));
        const pin = String(body?.pin || request.headers.get('x-staff-pin') || request.headers.get('x-admin-pin') || '').trim();
        const auth = await authorizeStaffByPin(env, companyId, pin);

        if (!auth.ok) {
          return Response.json({ ok: false, error: auth.error }, { status: auth.status });
        }

        if (!contactId) {
          return Response.json({ ok: false, error: 'Contact id is required' }, { status: 400 });
        }

        const now = new Date().toISOString();
        const result = await env.DB.prepare(`
          UPDATE contacts
          SET pushed_to_gmail = 1,
              status = ?,
              processed_at = ?,
              processed_by = ?
          WHERE company_id = ? AND id = ?
        `).bind(
          'processed',
          now,
          String(auth.staff.name || auth.staff.id || 'staff'),
          companyId,
          contactId
        ).run();

        if (!result.success || Number(result.meta?.changes || 0) === 0) {
          return Response.json({ ok: false, error: 'Contact not found' }, { status: 404 });
        }

        return Response.json({ ok: true, contactId, status: 'processed' });
        } catch (e) {
          console.error('Contacts push error:', e);
          return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
      });
    }

    // ==================== API: ADMIN INTEGRATION CONFIG ====================
    if (url.pathname === "/api/admin/integration-config" && request.method === "GET") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const pin = String(url.searchParams.get("pin") || request.headers.get("x-admin-pin") || '').trim();

        const auth = await authorizeAdminByPin(env, companyId, pin);
        if (!auth.ok) {
          return Response.json({ success: false, error: auth.error }, { status: auth.status });
        }

        const [settingsMap, organizationSecretStatuses] = await Promise.all([
          getIntegrationSettingsMap(env, companyId),
          getOrganizationSecretStatusMapForCompany(env, companyId)
        ]);
        const config = {};

        for (const key of INTEGRATION_SETTING_KEYS) {
          config[key] = String(settingsMap[key] || '').trim();
        }

        for (const key of ORGANIZATION_SECRET_KEYS) {
          const wranglerConfigured = !!String(env?.[key] || '').trim();
          const organizationStatus = organizationSecretStatuses[key] || { isSet: false, updatedAt: null };

          config[key] = {
            isSet: wranglerConfigured || organizationStatus.isSet,
            managedBy: wranglerConfigured
              ? (organizationStatus.isSet ? 'wrangler_secret_or_organization_secret_vault' : 'wrangler_secret')
              : (organizationStatus.isSet ? 'organization_secret_vault' : 'not_configured'),
            updatedAt: organizationStatus.updatedAt || null,
            sources: {
              wranglerSecret: wranglerConfigured,
              organizationSecretVault: !!organizationStatus.isSet
            }
          };
        }

        return Response.json({
          success: true,
          companyId,
          tenantSecretVaultEnabled: !!env.TENANT_SECRETS_MASTER_KEY,
          config
        });
        } catch (e) {
          console.error('Admin integration-config GET error:', e);
          return Response.json(
            { success: false, error: e.message },
            { status: 500 }
          );
        }
      });
    }

    if (url.pathname === "/api/admin/integration-config" && request.method === "POST") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const body = await request.json();
        const pin = String(body?.pin || '').trim();

        const auth = await authorizeAdminByPin(env, companyId, pin);
        if (!auth.ok) {
          return Response.json({ success: false, error: auth.error }, { status: auth.status });
        }

        const incomingValues = [];
        if (body && typeof body.values === 'object' && body.values !== null) {
          for (const [key, value] of Object.entries(body.values)) {
            incomingValues.push({ key, value });
          }
        } else if (body?.key) {
          incomingValues.push({ key: body.key, value: body.value });
        }

        if (!incomingValues.length) {
          return Response.json(
            { success: false, error: 'No config values provided' },
            { status: 400 }
          );
        }

        const now = new Date().toISOString();
        const saved = [];
        const rejected = [];

        for (const item of incomingValues) {
          const normalizedKey = normalizeIntegrationKey(item.key);
          const rawValue = item.value == null ? '' : String(item.value).trim();

          if (!normalizedKey) {
            rejected.push({ key: item.key, reason: 'Invalid key' });
            continue;
          }

          if (SECRET_ONLY_INTEGRATION_KEYS.has(normalizedKey)) {
            rejected.push({
              key: normalizedKey,
              reason: 'Secret keys are managed via Wrangler secrets only'
            });
            continue;
          }

          if (!INTEGRATION_SETTING_KEY_SET.has(normalizedKey)) {
            rejected.push({ key: normalizedKey, reason: 'Unsupported key' });
            continue;
          }

          if (rawValue.length > 2048) {
            rejected.push({ key: normalizedKey, reason: 'Value too long' });
            continue;
          }

          await env.DB.prepare(`
            INSERT INTO settings (company_id, key, value, description, updated_at, updated_by)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(company_id, key) DO UPDATE SET
              value = excluded.value,
              description = excluded.description,
              updated_at = excluded.updated_at,
              updated_by = excluded.updated_by
          `).bind(
            companyId,
            normalizedKey,
            rawValue,
            INTEGRATION_KEY_DESCRIPTIONS[normalizedKey] || 'Integration setting',
            now,
            String(auth.staff.name || auth.staff.id || 'admin')
          ).run();

          saved.push(normalizedKey);
        }

        return Response.json({
          success: true,
          saved,
          rejected
        });
        } catch (e) {
          console.error('Admin integration-config POST error:', e);
          return Response.json(
            { success: false, error: e.message },
            { status: 500 }
          );
        }
      });
    }

    // ==================== API: ADMIN PLATFORM CONFIG ====================
    if (url.pathname === "/api/admin/platform-config" && request.method === "GET") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const pin = String(url.searchParams.get("pin") || request.headers.get("x-admin-pin") || request.headers.get("x-staff-pin") || '').trim();
        const auth = await authorizeManagerOrAdminByPin(env, companyId, pin);

        if (!auth.ok) {
          return Response.json({ success: false, error: auth.error }, { status: auth.status });
        }

        const config = await getAdminPlatformConfig(env, companyId);
        return Response.json({ success: true, companyId, ...config });
        } catch (e) {
          console.error('Admin platform-config GET error:', e);
          return Response.json({ success: false, error: e.message }, { status: 500 });
        }
      });
    }

    if (url.pathname === "/api/admin/platform-config" && request.method === "POST") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const body = await request.json();
        const pin = String(body?.pin || '').trim();
        const auth = await authorizeManagerOrAdminByPin(env, companyId, pin);

        if (!auth.ok) {
          return Response.json({ success: false, error: auth.error }, { status: auth.status });
        }

        const updatedBy = String(auth.staff.name || auth.staff.id || 'admin');
        const callerRole = String(auth.staff.role || '').toLowerCase();
        const callerIsAdmin = callerRole === 'admin';
        const company = body?.company && typeof body.company === 'object' ? body.company : null;
        const operationalSettings = body?.operationalSettings && typeof body.operationalSettings === 'object' ? body.operationalSettings : {};
        const modules = body?.modules && typeof body.modules === 'object' ? body.modules : {};

        if (company) {
          if (!callerIsAdmin) {
            return Response.json({ success: false, error: 'Only admin role can update company profile.' }, { status: 403 });
          }

          const hasExplicitSubdomain = Object.prototype.hasOwnProperty.call(company, 'subdomain');
          let requestedSubdomain = '';
          if (hasExplicitSubdomain) {
            requestedSubdomain = normalizeTenantSubdomain(company.subdomain);
          } else {
            const existingCompany = await getCompanyProfile(env, companyId);
            requestedSubdomain = normalizeTenantSubdomain(existingCompany?.subdomain);
          }

          if (requestedSubdomain && !isValidTenantSubdomain(requestedSubdomain)) {
            return Response.json({
              success: false,
              error: 'Tenant subdomain must be 1-63 chars, lowercase letters/numbers, and may include hyphens.'
            }, { status: 400 });
          }

          const subdomainConflict = await env.DB.prepare(
            `SELECT id FROM companies WHERE lower(subdomain) = ? AND id <> ? LIMIT 1`
          ).bind(requestedSubdomain, companyId).first();

          if (subdomainConflict?.id) {
            return Response.json({ success: false, error: 'Tenant subdomain is already in use.' }, { status: 409 });
          }

          await env.DB.prepare(`
            UPDATE companies
            SET subdomain = ?, name = ?, email = ?, phone = ?, timezone = ?, odoo_url = ?, odoo_company_id = ?, updated_at = ?
            WHERE id = ?
          `).bind(
            requestedSubdomain,
            String(company.name || '').trim(),
            String(company.email || '').trim(),
            String(company.phone || '').trim(),
            String(company.timezone || 'UTC').trim(),
            String(company.odoo_url || '').trim(),
            company.odoo_company_id === '' || company.odoo_company_id == null ? null : Number(company.odoo_company_id),
            new Date().toISOString(),
            companyId
          ).run();
        }

        for (const key of OPERATIONAL_SETTING_KEYS) {
          if (!(key in operationalSettings)) continue;
          if (!callerIsAdmin && !MANAGER_EDITABLE_OPERATIONAL_SETTING_KEYS.has(key)) continue;

          await upsertSettingValue(
            env,
            companyId,
            key,
            String(operationalSettings[key] ?? '').trim(),
            OPERATIONAL_KEY_DESCRIPTIONS[key] || 'Operational setting',
            updatedBy
          );
        }

        if (callerIsAdmin) {
          for (const key of MODULE_SETTING_KEYS) {
            if (!(key in modules)) continue;
            await upsertSettingValue(
              env,
              companyId,
              key,
              modules[key] ? 'enabled' : 'disabled',
              MODULE_KEY_DESCRIPTIONS[key] || 'Module toggle',
              updatedBy
            );
          }

          if ('module_membership_management' in modules) {
            await upsertSettingValue(
              env,
              companyId,
              'module_founder_program',
              modules.module_membership_management ? 'enabled' : 'disabled',
              MODULE_KEY_DESCRIPTIONS.module_founder_program || 'Legacy module alias',
              updatedBy
            );
          }
        }

        const config = await getAdminPlatformConfig(env, companyId);
        return Response.json({ success: true, companyId, ...config });
        } catch (e) {
          console.error('Admin platform-config POST error:', e);
          return Response.json({ success: false, error: e.message }, { status: 500 });
        }
      });
    }

    // ==================== API: ADMIN STAFF ====================
    if (url.pathname === "/api/admin/staff" && request.method === "GET") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const pin = String(url.searchParams.get("pin") || request.headers.get("x-admin-pin") || '').trim();
        const auth = await authorizeAdminByPin(env, companyId, pin);

        if (!auth.ok) {
          return Response.json({ success: false, error: auth.error }, { status: auth.status });
        }

        const result = await env.DB.prepare(`
          SELECT id, name, pin, role, is_active, permissions, last_login, updated_at
          FROM staff
          WHERE company_id = ?
          ORDER BY name ASC
        `).bind(companyId).all();

        return Response.json({ success: true, staff: result.results || [] });
        } catch (e) {
          console.error('Admin staff GET error:', e);
          return Response.json({ success: false, error: e.message }, { status: 500 });
        }
      });
    }

    if (url.pathname === "/api/admin/staff" && request.method === "POST") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const body = await request.json();
        const pin = String(body?.pin || '').trim();
        const auth = await authorizeAdminByPin(env, companyId, pin);

        if (!auth.ok) {
          return Response.json({ success: false, error: auth.error }, { status: auth.status });
        }

        const item = body?.staff;
        if (!item || typeof item !== 'object') {
          return Response.json({ success: false, error: 'Staff payload required' }, { status: 400 });
        }

        const name = String(item.name || '').trim();
        const staffPin = String(item.pin || '').trim();
        const role = String(item.role || '').trim().toLowerCase();
        const isActive = item.is_active === false || item.is_active === 0 || item.is_active === '0' ? 0 : 1;
        const allowedRoles = new Set(['hostess', 'manager', 'admin', 'staff', 'supervisor']);

        if (!name || staffPin.length < 4) {
          return Response.json({ success: false, error: 'Staff name and PIN are required' }, { status: 400 });
        }

        if (!allowedRoles.has(role)) {
          return Response.json({ success: false, error: 'Invalid staff role' }, { status: 400 });
        }

        const existingConflict = await env.DB.prepare(
          `SELECT id FROM staff WHERE company_id = ? AND pin = ? AND id != ? LIMIT 1`
        ).bind(companyId, staffPin, String(item.id || '')).first();

        if (existingConflict) {
          return Response.json({ success: false, error: 'PIN already used by another staff member' }, { status: 409 });
        }

        const staffId = String(item.id || `staff_${companyId}_${Date.now()}`);
        const now = new Date().toISOString();
        const updatedBy = String(auth.staff.name || auth.staff.id || 'admin');
        const permissions = String(item.permissions || (role === 'admin' ? '["*"]' : '[]'));

        await env.DB.prepare(`
          INSERT INTO staff (id, company_id, name, pin, role, is_active, permissions, created_at, updated_at, created_by, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            pin = excluded.pin,
            role = excluded.role,
            is_active = excluded.is_active,
            permissions = excluded.permissions,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by
        `).bind(
          staffId,
          companyId,
          name,
          staffPin,
          role,
          isActive,
          permissions,
          now,
          now,
          updatedBy,
          updatedBy
        ).run();

        const staffSyncPromise = syncStaffToOdoo(env, {
          companyId,
          staffId,
          name,
          role,
          isActive,
          permissions,
          updatedBy,
          updatedAt: now
        }).then((syncResult) => {
          if (!syncResult.ok) {
            console.warn('Staff Odoo sync failed:', syncResult.error || 'Unknown error');
          }
        }).catch((syncError) => {
          console.warn('Staff Odoo sync error:', syncError);
        });

        if (ctx?.waitUntil) {
          ctx.waitUntil(staffSyncPromise);
        }

        await recalculateCompanyBillingSummary(env, companyId);

        return Response.json({ success: true, staffId });
        } catch (e) {
          console.error('Admin staff POST error:', e);
          return Response.json({ success: false, error: e.message }, { status: 500 });
        }
      });
    }

    // ==================== API: ADMIN MEDIA ASSETS ====================
    if (url.pathname === "/api/admin/media-assets" && request.method === "GET") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const pin = String(url.searchParams.get("pin") || request.headers.get("x-admin-pin") || request.headers.get("x-staff-pin") || '').trim();
        const auth = await authorizeManagerOrAdminByPin(env, companyId, pin);

        if (!auth.ok) {
          return Response.json({ success: false, error: auth.error }, { status: auth.status });
        }

        const result = await env.DB.prepare(`
          SELECT id, title, alt_text, mime_type, data_url, tags, is_active, created_at, updated_at
          FROM media_assets
          WHERE company_id = ?
          ORDER BY updated_at DESC
          LIMIT 200
        `).bind(companyId).all();

        const assets = (result.results || [])
          .map(mapMediaAssetRow)
          .filter(Boolean);

        return Response.json({ success: true, companyId, assets });
        } catch (e) {
          console.error('Admin media-assets GET error:', e);
          return Response.json({ success: false, error: e.message }, { status: 500 });
        }
      });
    }

    if (url.pathname === "/api/admin/media-assets" && request.method === "POST") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const body = await request.json();
        const pin = String(body?.pin || '').trim();
        const auth = await authorizeManagerOrAdminByPin(env, companyId, pin);

        if (!auth.ok) {
          return Response.json({ success: false, error: auth.error }, { status: auth.status });
        }

        const action = String(body?.action || 'upsert').trim().toLowerCase();

        if (action === 'delete') {
          const assetId = String(body?.id || body?.assetId || '').trim();
          if (!assetId) {
            return Response.json({ success: false, error: 'Asset id is required' }, { status: 400 });
          }

          const deleted = await env.DB.prepare(
            `DELETE FROM media_assets WHERE company_id = ? AND id = ?`
          ).bind(companyId, assetId).run();

          if (!deleted.success || Number(deleted.meta?.changes || 0) === 0) {
            return Response.json({ success: false, error: 'Asset not found' }, { status: 404 });
          }

          return Response.json({ success: true, deletedId: assetId });
        }

        const payload = body?.asset && typeof body.asset === 'object' ? body.asset : body;
        const requestedId = String(payload?.id || '').trim();
        let existing = null;

        if (requestedId) {
          existing = await env.DB.prepare(`
            SELECT id, company_id, title, alt_text, mime_type, data_url, tags, is_active, created_at, created_by
            FROM media_assets
            WHERE id = ?
            LIMIT 1
          `).bind(requestedId).first();

          if (existing && Number(existing.company_id) !== Number(companyId)) {
            return Response.json({ success: false, error: 'Asset belongs to a different tenant' }, { status: 403 });
          }
        }

        const assetId = requestedId || `media_${companyId}_${Date.now()}`;
        const now = new Date().toISOString();
        const updatedBy = String(auth.staff.name || auth.staff.id || 'admin');

        const title = String(payload?.title ?? existing?.title ?? '').trim();
        const altText = String(payload?.altText ?? payload?.alt_text ?? existing?.alt_text ?? '').trim();
        let mimeType = String(payload?.mimeType ?? payload?.mime_type ?? existing?.mime_type ?? '').trim().toLowerCase();
        let dataUrl = String(payload?.dataUrl ?? payload?.data_url ?? existing?.data_url ?? '').trim();

        if (!title) {
          return Response.json({ success: false, error: 'Asset title is required' }, { status: 400 });
        }

        if (title.length > 120) {
          return Response.json({ success: false, error: 'Asset title is too long (max 120 characters)' }, { status: 400 });
        }

        if (altText.length > 240) {
          return Response.json({ success: false, error: 'Alt text is too long (max 240 characters)' }, { status: 400 });
        }

        if (!dataUrl) {
          return Response.json({ success: false, error: 'Asset image data is required' }, { status: 400 });
        }

        if (!dataUrl.startsWith('data:image/')) {
          return Response.json({ success: false, error: 'Only image data URLs are supported' }, { status: 400 });
        }

        if (dataUrl.length > MAX_MEDIA_ASSET_DATA_URL_LENGTH) {
          return Response.json({ success: false, error: 'Asset payload is too large (max 1.2MB)' }, { status: 413 });
        }

        const inferredMimeType = inferImageMimeTypeFromDataUrl(dataUrl);
        mimeType = inferredMimeType || mimeType;

        if (!MEDIA_ASSET_ALLOWED_MIME_TYPES.has(mimeType)) {
          return Response.json({ success: false, error: 'Unsupported image type' }, { status: 400 });
        }

        const tags = normalizeMediaTags(payload?.tags ?? existing?.tags ?? []);
        const isActive = parseBooleanLike(
          payload?.isActive ?? payload?.is_active ?? existing?.is_active ?? 1,
          true
        ) ? 1 : 0;

        await env.DB.prepare(`
          INSERT INTO media_assets (
            id, company_id, title, alt_text, media_type, mime_type, data_url,
            tags, is_active, created_at, updated_at, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            alt_text = excluded.alt_text,
            mime_type = excluded.mime_type,
            data_url = excluded.data_url,
            tags = excluded.tags,
            is_active = excluded.is_active,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by
        `).bind(
          assetId,
          companyId,
          title,
          altText,
          'image',
          mimeType,
          dataUrl,
          JSON.stringify(tags),
          isActive,
          existing?.created_at || now,
          now,
          existing?.created_by || updatedBy,
          updatedBy
        ).run();

        const row = await env.DB.prepare(`
          SELECT id, title, alt_text, mime_type, data_url, tags, is_active, created_at, updated_at
          FROM media_assets
          WHERE company_id = ? AND id = ?
          LIMIT 1
        `).bind(companyId, assetId).first();

        return Response.json({
          success: true,
          action: existing ? 'updated' : 'created',
          asset: mapMediaAssetRow(row)
        });
        } catch (e) {
          console.error('Admin media-assets POST error:', e);
          return Response.json({ success: false, error: e.message }, { status: 500 });
        }
      });
    }

    // ==================== API: NOTIFICATIONS STREAM (SSE) ====================
    if (url.pathname === "/api/notifications/stream" && request.method === "GET") {
      return runTenantRoute(async ({ companyId }) => {
        const requestedCompanyId = Number(url.searchParams.get("company_id") || 0);
        let effectiveCompanyId = companyId;

        if (Number.isInteger(requestedCompanyId) && requestedCompanyId > 0) {
          if (requestedCompanyId === companyId) {
            effectiveCompanyId = requestedCompanyId;
          } else if (canOverrideCompanyIdForHost(tenant, url)) {
            effectiveCompanyId = requestedCompanyId;
          } else {
            return Response.json(
              { ok: false, error: "company_id override is not allowed for this host" },
              { status: 403 }
            );
          }
        }

        // Create SSE response
        let clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            // Store client
            if (!sseClients.has(effectiveCompanyId)) {
              sseClients.set(effectiveCompanyId, new Set());
            }
            const client = {
              id: clientId,
              send: (event, data) => {
                const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
                controller.enqueue(encoder.encode(msg));
              }
            };
            sseClients.get(effectiveCompanyId).add(client);

            // Send initial connected message
            client.send("connected", { ok: true });

            // Cleanup on close
            const closeInterval = setInterval(() => {
              try {
                controller.enqueue(encoder.encode(":\n\n"));
              } catch (e) {
                clearInterval(closeInterval);
                sseClients.get(effectiveCompanyId).delete(client);
              }
            }, 30000);
          }
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*"
          }
        });
      });
    }

    // ==================== API: CREATE BOOKING (FORM HANDLER) ====================
    if (url.pathname === "/api/bookings/create" && request.method === "POST") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const formData = await request.formData();
        const bookingEnabled = await isModuleEnabled(env, companyId, 'module_booking_management');

        if (!bookingEnabled) {
          return Response.json(
            { ok: false, error: "Booking management module is disabled" },
            { status: 403 }
          );
        }

        const name = String(formData.get("name") || "").trim();
        const phone = String(formData.get("phone") || "").trim();
        const emailRaw = String(formData.get("email") || "").trim();
        const email = normalizeOptionalEmail(emailRaw);
        const date = String(formData.get("date") || "").trim();
        const time = String(formData.get("time") || "").trim();
        const pax = parseInt(formData.get("pax") || 0);
        const areaRaw = String(formData.get('area') || 'indoor').trim().toLowerCase();
        const area = ['indoor', 'outdoor', 'garden', 'bar'].includes(areaRaw) ? areaRaw : 'indoor';
        const cfToken = String(formData.get("cf_token") || "").trim();

        if (emailRaw && !email) {
          return Response.json(
            { ok: false, error: "Invalid email format" },
            { status: 400 }
          );
        }

        const founderSecretConfig = await getFounderSecretRuntimeConfig(env, companyId);
        const turnstileData = await verifyTurnstileToken(
          cfToken,
          env,
          request.headers.get('CF-Connecting-IP'),
          founderSecretConfig,
          url
        );

        if (!turnstileData.success) {
          return Response.json(
            { ok: false, error: "CAPTCHA verification failed" },
            { status: 400 }
          );
        }

        if (!name || !phone || !date || !time || !pax) {
          return Response.json(
            { ok: false, error: "Missing required fields" },
            { status: 400 }
          );
        }

        // Create booking
        const bookingId = `booking_${companyId}_${Date.now()}`;
        const now = new Date().toISOString();
        const bookingDateTime = `${date}T${time}:00Z`;

        await env.DB.prepare(`
          INSERT INTO bookings 
          (id, company_id, contact_name, phone, email, guests_pax, booking_date, booking_time, booking_datetime, area, stage, stage_id, source, submitted_at, updated_at, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          bookingId, companyId, name, phone, email || null, pax, date, time, bookingDateTime, area, "pending", 1, "web", now, now, "system"
        ).run();

        let odooLeadId = null;
        const bookingCreateSyncResult = await syncBookingCreateToOdoo(env, {
          bookingId,
          companyId,
          name,
          phone,
          email,
          pax,
          date,
          time,
          bookingDateTime,
          area,
          submittedAt: now
        });

        if (!bookingCreateSyncResult.ok) {
          console.warn('Booking create Odoo sync failed:', bookingCreateSyncResult.error);
        } else if (bookingCreateSyncResult.odooLeadId) {
          odooLeadId = bookingCreateSyncResult.odooLeadId;
          await env.DB.prepare(
            `UPDATE bookings SET odoo_lead_id = ?, updated_at = ?, updated_by = ? WHERE id = ? AND company_id = ?`
          ).bind(odooLeadId, now, 'odoo_sync', bookingId, companyId).run();
        }

        syncBookingStageToBoard(env, {
          bookingId,
          companyId,
          newStage: 'pending',
          changedAt: now
        }).catch((err) => console.warn('Booking create board sync error:', err));

        // Notify SSE clients
        if (sseClients.has(companyId)) {
          const booking = {
            id: bookingId,
            contact_name: name,
            phone,
            email: email || null,
            guests_pax: pax,
            booking_date: date,
            booking_time: time,
            area,
            odoo_lead_id: odooLeadId,
            stage: "pending"
          };

          for (const client of sseClients.get(companyId)) {
            try {
              client.send("booking", booking);
            } catch {
              sseClients.get(companyId).delete(client);
            }
          }
        }

        return Response.json({
          ok: true,
          bookingId,
          odoo_lead_id: odooLeadId,
          redirect_url: "/danke-reservierung"
        });
        } catch (e) {
          console.error("Booking create error:", e);
          return Response.json(
            { ok: false, error: e.message },
            { status: 500 }
          );
        }
      });
    }

    // ==================== API: UPDATE BOOKING STAGE ====================
    if (url.pathname.match(/^\/api\/bookings\/([^\/]+)\/stage$/) && request.method === "POST") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const bookingId = url.pathname.match(/^\/api\/bookings\/([^\/]+)\/stage$/)[1];
        const body = await request.json();
        const { stage: newStage, staffId } = body;

        let effectiveCompanyId = companyId;
        const reqCompanyId = Number(body?.companyId || 0);
        if (Number.isInteger(reqCompanyId) && reqCompanyId > 0) {
          if (reqCompanyId === companyId) {
            effectiveCompanyId = reqCompanyId;
          } else if (canOverrideCompanyIdForHost(tenant, url)) {
            effectiveCompanyId = reqCompanyId;
          } else {
            return Response.json(
              { ok: false, error: "company_id override is not allowed for this host" },
              { status: 403 }
            );
          }
        }

        if (!bookingId || !newStage) {
          return Response.json(
            { ok: false, error: "bookingId and stage required" },
            { status: 400 }
          );
        }

        // Get existing booking
        const booking = await env.DB.prepare(
          `SELECT stage, odoo_lead_id FROM bookings WHERE id = ? AND company_id = ?`
        ).bind(bookingId, effectiveCompanyId).first();

        if (!booking) {
          return Response.json(
            { ok: false, error: "Booking not found" },
            { status: 404 }
          );
        }

        // Update booking
        const now = new Date().toISOString();
        await env.DB.prepare(
          `UPDATE bookings SET stage = ?, updated_at = ?, updated_by = ? WHERE id = ? AND company_id = ?`
        ).bind(newStage, now, staffId || "staff", bookingId, effectiveCompanyId).run();

        // Create audit log
        const actionId = `action_${Date.now()}`;
        await env.DB.prepare(
          `INSERT INTO booking_actions (id, company_id, booking_id, action_type, old_stage, new_stage, changed_by, changed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          actionId, effectiveCompanyId, bookingId, "stage_changed", booking.stage, newStage, staffId || "staff", now
        ).run();

        // Notify SSE clients
        if (sseClients.has(effectiveCompanyId)) {
          for (const client of sseClients.get(effectiveCompanyId)) {
            try {
              client.send("stage-update", { bookingId, newStage });
            } catch {
              sseClients.get(effectiveCompanyId).delete(client);
            }
          }
        }

        // Sync stage to Odoo (fire-and-forget; failure is non-blocking)
        syncBookingStageToOdoo(env, {
          bookingId,
          companyId: effectiveCompanyId,
          newStage,
          odooLeadId: booking.odoo_lead_id || null,
          changedBy: staffId || 'staff',
          changedAt: now
        }).catch((err) => console.warn('Booking stage Odoo sync error:', err));

        // Sync stage to booking board KV (no-op when BOARD_KV binding is absent)
        syncBookingStageToBoard(env, {
          bookingId,
          companyId: effectiveCompanyId,
          newStage,
          changedAt: now
        }).catch((err) => console.warn('Booking stage board sync error:', err));

        return Response.json({
          ok: true,
          message: `Stage updated to ${newStage}`,
          bookingId
        });
        } catch (e) {
          console.error("Stage update error:", e);
          return Response.json(
            { ok: false, error: e.message },
            { status: 500 }
          );
        }
      });
    }

    // ==================== API: GET BOOKINGS BY COMPANY ====================
    if (url.pathname === "/api/bookings" && request.method === "GET") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const date = url.searchParams.get("date");

        let query = "SELECT * FROM bookings WHERE company_id = ?";
        let params = [companyId];

        if (date) {
          query += " AND booking_date = ?";
          params.push(date);
        }

        query += " ORDER BY booking_date DESC, booking_time DESC LIMIT 100";

        const result = await env.DB.prepare(query).bind(...params).all();

        return Response.json({
          ok: true,
          companyId,
          data: result.results || []
        });
        } catch (e) {
          return Response.json(
            { ok: false, error: e.message },
            { status: 500 }
          );
        }
      });
    }

    // ==================== API: STAFF BOARD BOOKING (onsite, no Turnstile) ====================
    // Used by the /board kiosk — authentication replaces Turnstile.
    if (url.pathname === "/api/bookings/staff-create" && request.method === "POST") {
      return runTenantRoute(async ({ companyId }) => {
        try {
          const body = await request.json();

          const pin      = String(body.pin      || '').trim();
          const name     = String(body.name     || '').trim();
          const phone    = String(body.phone    || '').trim();
          const emailRaw = String(body.email    || '').trim();
          const date     = String(body.date     || '').trim();
          const time     = String(body.time     || '').trim();
          const pax      = parseInt(body.pax    || 0);
          const areaRaw  = String(body.area     || 'indoor').trim().toLowerCase();
          const area     = ['indoor', 'outdoor', 'garden', 'bar'].includes(areaRaw) ? areaRaw : 'indoor';
          const flag     = String(body.flag     || '').trim().toLowerCase();
          const notes    = String(body.notes    || '').trim();
          const duration = parseInt(body.duration || 120);

          // Verify staff PIN — this replaces Turnstile
          if (!pin) {
            return Response.json({ ok: false, error: 'Staff PIN required' }, { status: 400 });
          }
          const auth = await authorizeStaffByPin(env, companyId, pin);
          if (!auth.ok) {
            return Response.json({ ok: false, error: auth.error }, { status: 401 });
          }
          const staffUser = auth.staff.name;

          const bookingEnabled = await isModuleEnabled(env, companyId, 'module_booking_management');
          if (!bookingEnabled) {
            return Response.json({ ok: false, error: 'Booking management module is disabled' }, { status: 403 });
          }

          const email = normalizeOptionalEmail(emailRaw);
          if (emailRaw && !email) {
            return Response.json({ ok: false, error: 'Invalid email format' }, { status: 400 });
          }

          if (!name || !phone || !date || !time || !pax) {
            return Response.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
          }

          const bookingId      = `booking_${companyId}_${Date.now()}`;
          const now            = new Date().toISOString();
          const bookingDateTime = `${date}T${time}:00Z`;

          await env.DB.prepare(`
            INSERT INTO bookings
            (id, company_id, contact_name, phone, email, guests_pax, booking_date, booking_time,
             booking_datetime, area, flag, notes, duration_minutes, stage, stage_id, source,
             submitted_at, updated_at, created_by, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            bookingId, companyId, name, phone, email || null, pax, date, time,
            bookingDateTime, area, flag || null, notes || null, duration,
            'pending', 1, 'onsite',
            now, now, staffUser, staffUser
          ).run();

          let odooLeadId = null;
          const syncResult = await syncBookingCreateToOdoo(env, {
            bookingId, companyId, name, phone, email, pax, date, time,
            bookingDateTime, area, submittedAt: now,
            flag, notes, duration, staffUser, source: 'onsite'
          });
          if (syncResult.ok && syncResult.odooLeadId) {
            odooLeadId = syncResult.odooLeadId;
            await env.DB.prepare(
              `UPDATE bookings SET odoo_lead_id = ?, updated_at = ?, updated_by = ? WHERE id = ? AND company_id = ?`
            ).bind(odooLeadId, now, 'odoo_sync', bookingId, companyId).run();
          }

          syncBookingStageToBoard(env, {
            bookingId, companyId, newStage: 'pending', changedAt: now
          }).catch(() => {});

          if (sseClients.has(companyId)) {
            const booking = {
              id: bookingId, contact_name: name, phone,
              email: email || null, guests_pax: pax, booking_date: date,
              booking_time: time, area, flag: flag || null, source: 'onsite',
              odoo_lead_id: odooLeadId, stage: 'pending'
            };
            for (const client of sseClients.get(companyId)) {
              try { client.send('booking', booking); } catch {
                sseClients.get(companyId).delete(client);
              }
            }
          }

          return Response.json({ ok: true, bookingId, odoo_lead_id: odooLeadId });
        } catch (e) {
          console.error('Staff create error:', e);
          return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
      });
    }

    // ==================== BOOKING BOARD (per-tenant kiosk) ====================
    if (url.pathname === '/board' || url.pathname === '/board/') {
      return runTenantRoute(async ({ companyId }) => {
        const settingsMap = await getOperationalSettingsMap(env, companyId);
        const areaCapacity = {
          indoor:  Number(settingsMap.area_capacity_indoor  || 12),
          outdoor: Number(settingsMap.area_capacity_outdoor || 10),
          garden:  Number(settingsMap.area_capacity_garden  || 8),
          bar:     Number(settingsMap.area_capacity_bar     || 6)
        };
        const maxLanes = Object.values(areaCapacity).reduce((s, v) => s + v, 0);
        const html = String(boardUI || '')
          .replace(/__AREA_CAPACITY_JSON__/g, JSON.stringify(areaCapacity))
          .replace(/__MAX_LANES__/g, String(maxLanes));
        return new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=UTF-8' }
        });
      });
    }

    // ==================== API: TEST BOOKING (Development) ====================
    if (url.pathname === "/api/test/booking/create" && request.method === "POST") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const bookingEnabled = await isModuleEnabled(env, companyId, 'module_booking_management');
        if (!bookingEnabled) {
          return Response.json({ ok: false, error: 'Booking management module is disabled' }, { status: 403 });
        }

        const body = await request.json();
        const bodyEmailRaw = String(body.email || '').trim();
        const bodyEmail = normalizeOptionalEmail(bodyEmailRaw);

        if (bodyEmailRaw && !bodyEmail) {
          return Response.json({ ok: false, error: 'Invalid email format' }, { status: 400 });
        }

        const bookingId = `booking_${companyId}_${Date.now()}`;
        const now = new Date().toISOString();
        const bookingDateTime = `${body.date}T${body.time}:00Z`;

        await env.DB.prepare(`
          INSERT INTO bookings 
          (id, company_id, contact_name, phone, email, guests_pax, booking_date, booking_time, booking_datetime, area, stage, stage_id, source, submitted_at, updated_at, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          bookingId, companyId, body.name, body.phone, bodyEmail || null, body.pax, body.date, body.time, bookingDateTime, body.area || "indoor", "pending", 1, "test", now, now, "test"
        ).run();

        // Notify SSE clients
        if (sseClients.has(companyId)) {
          for (const client of sseClients.get(companyId)) {
            try {
              client.send("booking", {
                id: bookingId,
                contact_name: body.name,
                phone: body.phone,
                email: bodyEmail || null,
                guests_pax: body.pax,
                booking_date: body.date,
                booking_time: body.time,
                area: body.area || "indoor",
                stage: "pending"
              });
            } catch {
              sseClients.get(companyId).delete(client);
            }
          }
        }

        return Response.json({
          ok: true,
          bookingId,
          message: "Test booking created"
        });
        } catch (e) {
          return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
      });
    }

    // ==================== API: GET CUSTOMERS ====================
    if (url.pathname === "/api/customers" && request.method === "GET") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const result = await env.DB.prepare(
          `SELECT * FROM customers WHERE company_id = ? ORDER BY created_at DESC LIMIT 100`
        ).bind(companyId).all();

        return Response.json({
          ok: true,
          data: result.results || []
        });
        } catch (e) {
          return Response.json(
            { ok: false, error: e.message },
            { status: 500 }
          );
        }
      });
    }

    // ==================== 404 ====================
    return Response.json(
      { ok: false, error: "Not found" },
      { status: 404 }
    );
  }
};
