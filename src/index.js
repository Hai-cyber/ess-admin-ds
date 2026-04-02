// Import UIs
import adminUI from '../public/admin.html';
import bookingForm from '../public/booking-form.html';
import reservieungPage from '../public/reservierung.html';
import thankYouPage from '../public/danke-reservierung.html';
import appUI from '../public/app.html';
import founderFormUI from '../public/founder-form.html';

// Import utilities
import { getTenantContext, validateTenantAccess } from './utils/tenant.js';
import { initializeDatabase } from './db/init.js';
import { getOrganizationSecret, getOrganizationSecretStatuses } from './utils/organization-secrets.js';

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
const PLATFORM_PUBLIC_DOMAIN = 'gooddining.app';
const PLATFORM_PRICING_DEFAULTS = {
  platform_core_price_per_user: '9.98',
  platform_core_name: 'Online',
  platform_core_description: 'For restaurants that need a branded website on a managed subdomain.',
  platform_core_features: 'Restaurant website\nHosted on your gooddining.app subdomain\nContact and info page\nNo booking workflow included\nHosting included\nSSL included',
  platform_commerce_price_per_user: '59',
  platform_commerce_name: 'Service',
  platform_commerce_description: 'For restaurants that need POS, service flow, and a German-standard checkout.',
  platform_commerce_features: 'Everything in Online\nRestaurant POS\nLive booking board, reminders, and confirmations\nFast staff PIN login and walk-ins\nGerman-standard cash register workflow\nTSE available as add-on for German compliance',
  platform_growth_price_per_user: '89',
  platform_growth_name: 'Repeat Guests',
  platform_growth_description: 'For restaurants that want SMS marketing and loyal-guest management built in.',
  platform_growth_features: 'Everything in Service\nSMS marketing for previous guests\nLoyal guest profiles and segments\nSimple win-back campaigns\nRepeat-guest overview and follow-up',
  platform_enterprise_price_per_user: '',
  platform_enterprise_name: 'Groups',
  platform_enterprise_description: 'Multi-location, custom integrations, dedicated SLA support.',
  platform_enterprise_features: 'Everything in Repeat Guests\nMulti-location support\nCustom integrations API\nDedicated onboarding + SLA',
  platform_setup_fee_once: '349',
  platform_tse_fee_monthly: '19',
  platform_it_support_hourly: '95',
  platform_it_support_monthly: '249',
  platform_price_note: 'Billed per active user. Included: hosting, platform maintenance, SSL, and a managed gooddining.app subdomain. Add-ons only apply for SMS usage, TSE, onboarding, and optional IT support.'
};
const PLATFORM_PLAN_DEFINITIONS = [
  {
    id: 'core',
    priceKey: 'platform_core_price_per_user',
    nameKey: 'platform_core_name',
    descriptionKey: 'platform_core_description',
    featuresKey: 'platform_core_features'
  },
  {
    id: 'commerce',
    priceKey: 'platform_commerce_price_per_user',
    nameKey: 'platform_commerce_name',
    descriptionKey: 'platform_commerce_description',
    featuresKey: 'platform_commerce_features'
  },
  {
    id: 'growth',
    priceKey: 'platform_growth_price_per_user',
    nameKey: 'platform_growth_name',
    descriptionKey: 'platform_growth_description',
    featuresKey: 'platform_growth_features'
  },
  {
    id: 'enterprise',
    priceKey: 'platform_enterprise_price_per_user',
    nameKey: 'platform_enterprise_name',
    descriptionKey: 'platform_enterprise_description',
    featuresKey: 'platform_enterprise_features'
  }
];
const WEBSITE_SUPPORTED_LANGUAGES = new Set(['en', 'de']);
const WEBSITE_SUPPORTED_THEME_VARIANTS = new Set([
  'theme-basic',
  'theme-minimal',
  'theme-diner',
  'theme-luxury-a',
  'theme-luxury-b'
]);
const WEBSITE_THEME_FALLBACK_BY_TEMPLATE = {
  minimal: 'theme-minimal',
  modern: 'theme-basic',
  premium: 'theme-luxury-a'
};
const WEBSITE_BUILDER_DEFAULTS = {
  site_template: 'premium',
  site_theme_variant: 'theme-luxury-a',
  site_language: 'en',
  site_tagline: 'Seasonal dining with warm service and a room built for repeat visits.',
  site_hero_title: 'A dining room shaped by the full service rhythm',
  site_hero_subtitle: 'Lunch, aperitif, dinner, and the quieter hours around them.',
  site_about_title: 'About',
  site_about_body: 'Tell guests what kind of restaurant you are, how you cook, and why the room feels distinct.',
  site_primary_cta_text: 'Reserve',
  site_secondary_cta_text: 'Menu',
  site_contact_address: '',
  site_accent_color: '#9a3412'
};
const OPERATIONAL_SETTING_KEYS = [
  'website_url',
  'standard_contact_link',
  'booking_email',
  'social_instagram_url',
  'social_facebook_url',
  'social_tiktok_url',
  'social_google_business_url',
  'business_hours_open',
  'business_hours_close',
  'business_hours_schedule_json',
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
  'site_theme_variant',
  'site_content_preset',
  'site_language',
  'site_tagline',
  'site_hero_title',
  'site_hero_subtitle',
  'site_about_title',
  'site_about_body',
  'site_primary_cta_text',
  'site_secondary_cta_text',
  'site_contact_address',
  'site_accent_color',
  'site_branding_json',
  'site_navigation_json',
  'site_content_json',
  'site_career_json'
];
const MANAGER_EDITABLE_OPERATIONAL_SETTING_KEYS = new Set([
  'social_instagram_url',
  'social_facebook_url',
  'social_tiktok_url',
  'social_google_business_url',
  'business_hours_schedule_json',
]);
const MODULE_SETTING_KEYS = [
  'module_membership_management',
  'module_marketing_management',
  'module_booking_management',
  'module_digital_management',
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
  social_instagram_url: 'Instagram profile URL',
  social_facebook_url: 'Facebook page URL',
  social_tiktok_url: 'TikTok profile URL',
  social_google_business_url: 'Google Business profile URL',
  business_hours_open: 'Opening hour',
  business_hours_close: 'Closing hour',
  business_hours_schedule_json: 'Structured weekly opening-hours schedule in JSON for website/shop/order reuse',
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
  site_theme_variant: 'Theme variant override used by website previews and published pages',
  site_content_preset: 'Content preset identifier used to seed website-master content',
  site_language: 'Public website language code (en or de)',
  site_tagline: 'Public website tagline shown near the brand lockup',
  site_hero_title: 'Public website hero headline',
  site_hero_subtitle: 'Public website hero supporting copy',
  site_about_title: 'Public website about section title',
  site_about_body: 'Public website about section body copy',
  site_primary_cta_text: 'Primary call-to-action label on the website',
  site_secondary_cta_text: 'Secondary call-to-action label on the website',
  site_contact_address: 'Public contact address shown on website pages',
  site_accent_color: 'Accent color override for the public website',
  site_branding_json: 'JSON overrides for website branding, language, and logo asset references',
  site_navigation_json: 'JSON overrides for website navigation labels, page visibility, and secondary nav items',
  site_content_json: 'JSON overrides for website content blocks, images, and section copy',
  site_career_json: 'JSON overrides for website career page copy and roles'
};
const MODULE_KEY_DESCRIPTIONS = {
  module_membership_management: 'Product line: community & membership (Founder/KC forms, OTP, member lifecycle automation)',
  module_marketing_management: 'Product line: marketing automation (social, SMS, email engagement)',
  module_booking_management: 'Product line: booking management (booking form, stage automation, booking board/staff app)',
  module_digital_management: 'Product line: digital management (SEO, hosting, domain operations)',
  module_loyalty_rewards: 'Product line: advanced loyalty/rewards programs',
  module_contact_crm: 'Product line: first-party CRM operations (contacts, guest profiles, pipelines, product/menu data workflows)',
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
  'FOUNDER_OTP_BRAND_NAME',
  'TWILIO_WHATSAPP_FROM',
  'TWILIO_SMS_FROM',
  'TWILIO_MESSAGING_SERVICE_SID'
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
  FOUNDER_OTP_BRAND_NAME: 'Optional brand name injected into OTP greeting (empty = neutral message)',
  TWILIO_WHATSAPP_FROM: 'Twilio WhatsApp sender (format: whatsapp:+E164)',
  TWILIO_SMS_FROM: 'Twilio SMS sender (E.164)',
  TWILIO_MESSAGING_SERVICE_SID: 'Twilio Messaging Service SID for outbound SMS/WhatsApp'
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

function buildTenantWebsiteUrl(subdomain) {
  return `https://${subdomain}.${PLATFORM_PUBLIC_DOMAIN}`;
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

function normalizeBusinessHoursTime(rawValue) {
  const value = String(rawValue || '').trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : '';
}

function buildFallbackBusinessHoursSchedule({ open, close, closedWeekday } = {}) {
  const normalizedOpen = normalizeBusinessHoursTime(open);
  const normalizedClose = normalizeBusinessHoursTime(close);
  const normalizedClosedWeekday = String(closedWeekday || '').trim();
  const orderedDays = ['1', '2', '3', '4', '5', '6', '0'];

  return orderedDays.map((day) => {
    const isClosed = normalizedClosedWeekday === day;
    return {
      day,
      closed: isClosed,
      open: isClosed ? '' : normalizedOpen,
      close: isClosed ? '' : normalizedClose
    };
  });
}

function parseBusinessHoursSchedule(rawValue, fallback = {}) {
  const fallbackSchedule = buildFallbackBusinessHoursSchedule(fallback);
  if (typeof rawValue !== 'string' || !rawValue.trim()) return fallbackSchedule;

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed) || !parsed.length) return fallbackSchedule;

    const parsedMap = new Map();
    for (const row of parsed) {
      const day = String(row?.day || '').trim();
      if (!day) continue;
      parsedMap.set(day, {
        day,
        closed: row?.closed === true,
        open: normalizeBusinessHoursTime(row?.open),
        close: normalizeBusinessHoursTime(row?.close)
      });
    }

    return fallbackSchedule.map((fallbackRow) => {
      const parsedRow = parsedMap.get(fallbackRow.day);
      if (!parsedRow) return fallbackRow;
      if (parsedRow.closed) {
        return { day: fallbackRow.day, closed: true, open: '', close: '' };
      }

      return {
        day: fallbackRow.day,
        closed: false,
        open: parsedRow.open || fallbackRow.open,
        close: parsedRow.close || fallbackRow.close
      };
    });
  } catch {
    return fallbackSchedule;
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

    const organizationKeys = Array.from(new Set(companyKeys.map(key => organizationKeyMap[key] || key).filter(Boolean)));

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

function parsePlatformPlanFeatures(rawValue) {
  return String(rawValue || '')
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean);
}

function buildPlatformPlanDefinition(settingsMap, definition) {
  const name = String(settingsMap[definition.nameKey] || PLATFORM_PRICING_DEFAULTS[definition.nameKey] || '').trim();
  const description = String(settingsMap[definition.descriptionKey] || PLATFORM_PRICING_DEFAULTS[definition.descriptionKey] || '').trim();
  const priceRaw = String(settingsMap[definition.priceKey] || PLATFORM_PRICING_DEFAULTS[definition.priceKey] || '').trim();
  const features = parsePlatformPlanFeatures(settingsMap[definition.featuresKey] || PLATFORM_PRICING_DEFAULTS[definition.featuresKey] || '');

  return {
    id: definition.id,
    name,
    description,
    priceEurPerUserMonthly: priceRaw === '' ? null : Number(priceRaw),
    features
  };
}

function buildPlatformPlansResponse(settingsMap) {
  const plans = PLATFORM_PLAN_DEFINITIONS.map((definition) => {
    return buildPlatformPlanDefinition(settingsMap, definition);
  });

  return {
    ok: true,
    plans,
    extras: {
      oneTimeSetupFeeEur: Number(settingsMap.platform_setup_fee_once || PLATFORM_PRICING_DEFAULTS.platform_setup_fee_once || 0),
      tseMonthlyFeeEur: Number(settingsMap.platform_tse_fee_monthly || PLATFORM_PRICING_DEFAULTS.platform_tse_fee_monthly || 0),
      itSupportHourlyEur: Number(settingsMap.platform_it_support_hourly || PLATFORM_PRICING_DEFAULTS.platform_it_support_hourly || 0),
      itSupportMonthlyRetainerEur: Number(settingsMap.platform_it_support_monthly || PLATFORM_PRICING_DEFAULTS.platform_it_support_monthly || 0)
    },
    pricingNote: String(settingsMap.platform_price_note || PLATFORM_PRICING_DEFAULTS.platform_price_note || '').trim()
  };
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
    SELECT id, organization_id, subdomain, name, email, phone, is_active, timezone
    FROM companies
    WHERE id = ?
    LIMIT 1
  `).bind(companyId).first();

  return company || null;
}

async function getOrganizationProfile(env, organizationId) {
  if (!organizationId) return null;

  const organization = await env.DB.prepare(`
    SELECT id, slug, name, billing_email, phone, is_active, timezone
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

function safeParseJsonObject(rawValue, fallback = {}) {
  const text = String(rawValue || '').trim();
  if (!text) return { ...fallback };

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function normalizeWebsiteLanguage(rawLanguage) {
  const normalized = String(rawLanguage || '').trim().toLowerCase();
  return WEBSITE_SUPPORTED_LANGUAGES.has(normalized) ? normalized : WEBSITE_BUILDER_DEFAULTS.site_language;
}

function normalizeWebsiteThemeVariant(rawTheme, templateValue = WEBSITE_BUILDER_DEFAULTS.site_template) {
  const normalized = String(rawTheme || '').trim().toLowerCase();
  if (WEBSITE_SUPPORTED_THEME_VARIANTS.has(normalized)) return normalized;
  const templateKey = String(templateValue || '').trim().toLowerCase();
  return WEBSITE_THEME_FALLBACK_BY_TEMPLATE[templateKey] || WEBSITE_BUILDER_DEFAULTS.site_theme_variant;
}

function inferWebsiteTierFromModules(modules = {}) {
  if (!modules.module_booking_management && !modules.module_membership_management) return 'basic';
  if (modules.module_booking_management && !modules.module_membership_management) return 'plus';
  return 'premium';
}

function getDefaultWebsiteLabels(language) {
  if (language === 'de') {
    return {
      home: 'Startseite',
      menu: 'Speisekarte',
      reservation: 'Reservierung',
      about: 'Uber uns',
      contact: 'Kontakt',
      career: 'Karriere',
      founder: 'Founder',
      shop: 'Shop',
      contactButton: 'Kontakt',
      reserveButton: 'Reservieren'
    };
  }

  return {
    home: 'Home',
    menu: 'Menu',
    reservation: 'Reservations',
    about: 'About',
    contact: 'Contact',
    career: 'Careers',
    founder: 'Founder',
    shop: 'Shop',
    contactButton: 'Contact',
    reserveButton: 'Reserve'
  };
}

async function buildPublicWebsitePayload(env, companyId, currentUrl) {
  const { company, operationalSettings, modules } = await getAdminPlatformConfig(env, companyId);
  const settings = operationalSettings || {};
  const brandingOverrides = safeParseJsonObject(settings.site_branding_json);
  const navigationOverrides = safeParseJsonObject(settings.site_navigation_json);
  const contentOverrides = safeParseJsonObject(settings.site_content_json);
  const careerOverrides = safeParseJsonObject(settings.site_career_json);
  const requestedPreviewTheme = String(currentUrl?.searchParams?.get('theme') || '').trim();
  const theme = normalizeWebsiteThemeVariant(
    requestedPreviewTheme || settings.site_theme_variant || settings.site_template,
    settings.site_template
  );
  const language = normalizeWebsiteLanguage(settings.site_language || brandingOverrides.language_code);
  const defaultLabels = getDefaultWebsiteLabels(language);
  const themePreset = String(requestedPreviewTheme || settings.site_content_preset || theme).trim() || theme;
  const tenantSubdomain = normalizeTenantSubdomain(company?.subdomain);
  const websiteUrl = String(settings.website_url || '').trim() || (tenantSubdomain ? buildTenantWebsiteUrl(tenantSubdomain) : String(currentUrl?.origin || '').trim());
  const openingHoursSchedule = parseBusinessHoursSchedule(settings.business_hours_schedule_json, {
    open: settings.business_hours_open,
    close: settings.business_hours_close,
    closedWeekday: settings.closed_weekday
  });

  return {
    tenant: {
      id: tenantSubdomain || `tenant-${String(companyId || '').trim()}`,
      company_id: Number(companyId),
      theme,
      tier: inferWebsiteTierFromModules(modules),
      content_preset: themePreset
    },
    theme_presets_url: '/website-master/theme-presets.example.json',
    company: {
      name: String(company?.name || '').trim() || 'Restaurant Name',
      city: String(brandingOverrides.city || '').trim() || 'Berlin',
      cuisine: String(brandingOverrides.cuisine || '').trim() || 'Restaurant Cuisine',
      phone: String(company?.phone || '').trim(),
      email: String(settings.booking_email || company?.email || '').trim(),
      address: String(settings.site_contact_address || '').trim()
    },
    settings: {
      site_template: String(settings.site_template || WEBSITE_BUILDER_DEFAULTS.site_template).trim(),
      site_tagline: String(settings.site_tagline || WEBSITE_BUILDER_DEFAULTS.site_tagline).trim(),
      site_hero_title: String(settings.site_hero_title || WEBSITE_BUILDER_DEFAULTS.site_hero_title).trim(),
      site_hero_subtitle: String(settings.site_hero_subtitle || WEBSITE_BUILDER_DEFAULTS.site_hero_subtitle).trim(),
      site_about_title: String(settings.site_about_title || WEBSITE_BUILDER_DEFAULTS.site_about_title).trim(),
      site_about_body: String(settings.site_about_body || WEBSITE_BUILDER_DEFAULTS.site_about_body).trim(),
      site_primary_cta_text: String(settings.site_primary_cta_text || defaultLabels.reserveButton).trim(),
      site_secondary_cta_text: String(settings.site_secondary_cta_text || 'Menu').trim(),
      site_contact_address: String(settings.site_contact_address || '').trim(),
      site_accent_color: String(settings.site_accent_color || WEBSITE_BUILDER_DEFAULTS.site_accent_color).trim(),
      site_language: language,
      business_hours_open: String(settings.business_hours_open || '').trim(),
      business_hours_close: String(settings.business_hours_close || '').trim(),
      closed_weekday: String(settings.closed_weekday || '').trim(),
      opening_hours_schedule: openingHoursSchedule,
      booking_email: String(settings.booking_email || company?.email || '').trim(),
      website_url: websiteUrl
    },
    branding: brandingOverrides,
    navigation: {
      labels: {
        ...defaultLabels,
        ...(navigationOverrides.labels && typeof navigationOverrides.labels === 'object' ? navigationOverrides.labels : {})
      },
      page_visibility: navigationOverrides.page_visibility && typeof navigationOverrides.page_visibility === 'object'
        ? navigationOverrides.page_visibility
        : {},
      secondary_items: Array.isArray(navigationOverrides.secondary_items) ? navigationOverrides.secondary_items : [],
      header_contact_label: String(navigationOverrides.header_contact_label || defaultLabels.contactButton).trim(),
      header_reserve_label: String(navigationOverrides.header_reserve_label || defaultLabels.reserveButton).trim()
    },
    content: contentOverrides,
    career: careerOverrides,
    modules: modules || {}
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
    founderOtpBrandName: settingsMap.FOUNDER_OTP_BRAND_NAME || String(env.FOUNDER_OTP_BRAND_NAME || '').trim(),
    twilioWhatsappFrom: settingsMap.TWILIO_WHATSAPP_FROM || String(env.TWILIO_WHATSAPP_FROM || '').trim(),
    twilioSmsFrom: settingsMap.TWILIO_SMS_FROM || String(env.TWILIO_SMS_FROM || env.TWILIO_PHONE || env.TWILIO_PHONE_NUMBER || '').trim(),
    twilioMessagingServiceSid: settingsMap.TWILIO_MESSAGING_SERVICE_SID || String(env.TWILIO_MESSAGING_SERVICE_SID || '').trim()
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

async function resolveActiveCompanyId(env, tenant, url) {
  const fallbackCompanyId = 1;
  if (!env?.DB) return fallbackCompanyId;

  const host = String(tenant?.hostname || '').toLowerCase();
  const allowQueryOverride = host.includes('workers.dev') || host.startsWith('localhost');

  if (allowQueryOverride) {
    const queryCompanyId = Number(url.searchParams.get('company_id') || 0);
    if (Number.isInteger(queryCompanyId) && queryCompanyId > 0) {
      let row = null;
      try {
        row = await env.DB.prepare(
          `SELECT id FROM companies WHERE id = ? AND is_active = 1 LIMIT 1`
        ).bind(queryCompanyId).first();
      } catch (error) {
        const message = String(error?.message || error || '');
        if (message.toLowerCase().includes('no such table: companies')) {
          return queryCompanyId;
        }
        throw error;
      }

      if (row?.id) return Number(row.id);
    }
  }

  const tenantCompanyId = Number(tenant?.companyId || 0);
  if (Number.isInteger(tenantCompanyId) && tenantCompanyId > 0) {
    return tenantCompanyId;
  }

  const subdomain = String(tenant?.subdomain || '').trim().toLowerCase();
  if (subdomain && subdomain !== 'www') {
    let row = null;
    try {
      row = await env.DB.prepare(
        `SELECT id FROM companies WHERE lower(subdomain) = ? AND is_active = 1 LIMIT 1`
      ).bind(subdomain).first();
    } catch (error) {
      const message = String(error?.message || error || '');
      if (message.toLowerCase().includes('no such table: companies')) {
        return fallbackCompanyId;
      }
      throw error;
    }

    if (row?.id) return Number(row.id);
  }

  return fallbackCompanyId;
}

function getTurnstileSiteKey(env) {
  const siteKey = String(env?.TURNSTILE_SITE_KEY || '').trim();
  return siteKey || TURNSTILE_SITE_KEY_FALLBACK;
}

function isLocalDevelopmentHost(url) {
  const hostname = String(url?.hostname || '').trim().toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
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
  const [settings, company] = await Promise.all([
    getOperationalSettingsMap(env, companyId),
    getCompanyProfile(env, companyId)
  ]);
  const tenantSubdomain = normalizeTenantSubdomain(company?.subdomain);
  const fallbackBaseUrl = String(currentUrl || '').trim();
  const websiteUrl = String(settings.website_url || '').trim() || (tenantSubdomain ? buildTenantWebsiteUrl(tenantSubdomain) : fallbackBaseUrl);
  const configuredFallback = String(settings.standard_contact_link || '').trim() || websiteUrl;
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

function resolveRequestedMembershipProgram({
  membershipTypeRaw = '',
  programModeRaw = '',
  founderTermsAccepted = false,
  kcTermsAccepted = false,
  notesRaw = '',
  requestedPathIsKc = false
}) {
  const membershipType = String(membershipTypeRaw || '').trim();
  const programMode = String(programModeRaw || '').trim().toLowerCase();
  const notes = String(notesRaw || '').trim().toLowerCase();

  const isKcProgram =
    requestedPathIsKc ||
    programMode === 'kc' ||
    membershipType.toLowerCase() === 'kc' ||
    kcTermsAccepted ||
    notes.includes('kc form');

  if (isKcProgram) {
    return {
      membershipType: membershipType || 'KC',
      founderTermsFlag: 0,
      kcTermsFlag: 1,
      notes: notesRaw || 'KC Form Registration'
    };
  }

  return {
    membershipType: membershipType || FOUNDER_DEFAULT_MEMBERSHIP_TYPE,
    founderTermsFlag: 1,
    kcTermsFlag: 0,
    notes: notesRaw || 'Founder Form Registration'
  };
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

function formatIsoToBerlinDateTime(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(safeDate).replace(' ', ' ');
}

function formatIsoToBerlinDate(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(safeDate);
}

function getFounderOtpBrandPart(env, runtimeConfig = null) {
  const brandName = String(runtimeConfig?.founderOtpBrandName || env.FOUNDER_OTP_BRAND_NAME || '').trim();
  return brandName ? ` bei ${brandName}` : '';
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

async function syncBookingStageToBoard(env, { bookingId, companyId, newStage, changedAt }) {
  // Requires a KV namespace bound as BOARD_KV in wrangler.jsonc.
  // When the binding is absent the sync is silently skipped.
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

    const customerRecord = await env.DB.prepare(
      `SELECT founder_terms_accepted, kc_terms_accepted FROM customers WHERE company_id = ? AND phone = ? LIMIT 1`
    ).bind(companyId, phone).first();

    if (!customerRecord) {
      return respond('error', 'Kein gueltiges Kontaktprofil gefunden.', 400);
    }

    await env.DB.prepare(
      `UPDATE otp_cache SET verified = 1, last_attempt = ? WHERE company_id = ? AND phone = ?`
    ).bind(now, companyId, phone).run();

    await env.DB.prepare(
      `UPDATE customers SET founder_status = ?, otp_verified = 1, updated_at = ?, updated_by = ? WHERE company_id = ? AND phone = ?`
    ).bind('live', now, 'otp_verify', companyId, phone).run();

    if (!twilioWebhookMode) {
      await sendFounderVerifyResultViaTwilio(env, phone, inboundFromRaw, true, founderRuntimeConfig, founderSecretConfig);
    }

    return respond('success', 'OTP verifiziert. Ihre Anmeldung ist jetzt bestaetigt.', 200);
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
  const firstName = String(name || '').trim().split(/\s+/)[0] || '';
  const greeting = firstName ? `Hallo ${firstName}` : 'Hallo';
  const brandPart = getFounderOtpBrandPart(env, runtimeConfig);
  const otpValidMinutes = Math.max(1, Math.floor(FOUNDER_OTP_EXPIRES_SECONDS / 60));
  const whatsappMsg = `${greeting}, willkommen${brandPart}. Ihr persoenlicher Verifizierungscode lautet: *${otpCode}*. Er ist ${otpValidMinutes} Minuten gueltig. Bitte nicht weitergeben.`;
  const smsMsg = `${greeting}, willkommen${brandPart}. Ihr persoenlicher Verifizierungscode lautet: ${otpCode}. Er ist ${otpValidMinutes} Minuten gueltig. Bitte nicht weitergeben.`;

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

    let activeCompanyId = 1;
    try {
      activeCompanyId = await resolveActiveCompanyId(env, tenant, url);
    } catch (e) {
      console.warn('Company resolution fallback to default company_id=1:', e?.message || e);
    }

    // ==================== HEALTH CHECK ====================
    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        service: "ess-admin-ds",
        time: new Date().toISOString()
      });
    }

    if (url.pathname === "/api/website/payload" && request.method === "GET") {
      try {
        const companyId = activeCompanyId;
        const source = await buildPublicWebsitePayload(env, companyId, url);
        return Response.json({ ok: true, companyId, source });
      } catch (e) {
        console.error('Website payload GET error:', e);
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
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

    // ==================== BOOKING FORM ====================
    if (url.pathname === "/booking-form.html" || url.pathname === "/booking-form") {
      const companyId = activeCompanyId;
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
    }

    // ==================== RESERVIERUNG PAGE ====================
    if (url.pathname === "/reservierung" || url.pathname === "/reservierung.html") {
      const companyId = activeCompanyId;
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
      const companyId = activeCompanyId;
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
    }

    // ==================== API: FOUNDER REGISTER ====================
    if ((url.pathname === "/api/founder/register" || url.pathname === '/api/kc/register') && request.method === "POST") {
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

        const companyId = activeCompanyId;
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
        const programModeRaw = getField('program_mode');
        const optInTextRaw = getField('x_studio_opt_in_text', FOUNDER_OPT_IN_TEXT);
        const optInText = optInTextRaw || FOUNDER_OPT_IN_TEXT;
        const notesRaw = getField('x_studio_notes');
        const membershipTypeRaw = getField('x_studio_membership_type');
        const programSelection = resolveRequestedMembershipProgram({
          membershipTypeRaw,
          programModeRaw,
          founderTermsAccepted,
          kcTermsAccepted,
          notesRaw,
          requestedPathIsKc: url.pathname === '/api/kc/register'
        });
        const membershipType = programSelection.membershipType;
        const founderTermsFlag = programSelection.founderTermsFlag;
        const kcTermsFlag = programSelection.kcTermsFlag;
        const notes = programSelection.notes;

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
            founder_terms_accepted = excluded.founder_terms_accepted,
            kc_terms_accepted = excluded.kc_terms_accepted,
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

        const skipRegisterSyncForTestException = isFounderTestExceptionPhone && existingStatus === 'live' && alreadyActiveForRequestedProgram;

        const otpCode = generateOtpCode();
        await upsertFounderOtpRecord(env, companyId, phone, otpCode, now);

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
    }

    // ==================== API: FOUNDER OTP RESEND ====================
    if ((url.pathname === '/api/founder/resend-otp' || url.pathname === '/api/kc/resend-otp') && request.method === 'POST') {
      try {
        const companyId = activeCompanyId;
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
    }

    // ==================== API: FOUNDER OTP VERIFY (TWILIO WEBHOOK) ====================
    if ((url.pathname === '/webhooks/twilio/founder-otp' || url.pathname === '/api/webhooks/twilio/founder-otp') && request.method === 'POST') {
      const companyId = activeCompanyId;
      return handleFounderOtpVerificationRequest(request, env, companyId, { twilioWebhookMode: true });
    }

    // ==================== API: FOUNDER OTP VERIFY ====================
    if ((url.pathname === '/api/founder/verify' || url.pathname === '/api/kc/verify') && request.method === 'POST') {
      const companyId = activeCompanyId;
      return handleFounderOtpVerificationRequest(request, env, companyId);
    }

    // ==================== API: STAFF AUTH ====================
    if (url.pathname === "/api/staff/auth" && request.method === "GET") {
      try {
        const pin = url.searchParams.get("pin");
        if (!pin) {
          return Response.json({ success: false, error: "PIN required" }, { status: 400 });
        }

        const companyId = activeCompanyId;
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
    }

    // ==================== API: CONTACTS ====================
    if (url.pathname === "/api/contacts" && request.method === "GET") {
      try {
        const companyId = activeCompanyId;
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
    }

    if (url.pathname.match(/^\/api\/contacts\/([^\/]+)\/push$/) && request.method === "POST") {
      try {
        const companyId = activeCompanyId;
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
    }

    // ==================== API: ADMIN INTEGRATION CONFIG ====================
    if (url.pathname === "/api/admin/integration-config" && request.method === "GET") {
      try {
        const companyId = activeCompanyId;
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
    }

    if (url.pathname === "/api/admin/integration-config" && request.method === "POST") {
      try {
        const companyId = activeCompanyId;
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
    }

    // ==================== API: ADMIN PLATFORM CONFIG ====================
    if (url.pathname === "/api/admin/platform-config" && request.method === "GET") {
      try {
        const companyId = activeCompanyId;
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
    }

    if (url.pathname === "/api/admin/platform-config" && request.method === "POST") {
      try {
        const companyId = activeCompanyId;
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
            SET subdomain = ?, name = ?, email = ?, phone = ?, timezone = ?, updated_at = ?
            WHERE id = ?
          `).bind(
            requestedSubdomain,
            String(company.name || '').trim(),
            String(company.email || '').trim(),
            String(company.phone || '').trim(),
            String(company.timezone || 'UTC').trim(),
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
    }

    // ==================== API: ADMIN STAFF ====================
    if (url.pathname === "/api/admin/staff" && request.method === "GET") {
      try {
        const companyId = activeCompanyId;
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
    }

    if (url.pathname === "/api/admin/staff" && request.method === "POST") {
      try {
        const companyId = activeCompanyId;
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

        return Response.json({ success: true, staffId });
      } catch (e) {
        console.error('Admin staff POST error:', e);
        return Response.json({ success: false, error: e.message }, { status: 500 });
      }
    }

    // ==================== API: ADMIN MEDIA ASSETS ====================
    if (url.pathname === "/api/admin/media-assets" && request.method === "GET") {
      try {
        const companyId = activeCompanyId;
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
    }

    if (url.pathname === "/api/admin/media-assets" && request.method === "POST") {
      try {
        const companyId = activeCompanyId;
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
    }

    // ==================== API: NOTIFICATIONS STREAM (SSE) ====================
    if (url.pathname === "/api/notifications/stream" && request.method === "GET") {
      const requestedCompanyId = Number(url.searchParams.get("company_id") || 0);
      const companyId = Number.isInteger(requestedCompanyId) && requestedCompanyId > 0
        ? requestedCompanyId
        : activeCompanyId;

      // Create SSE response
      let clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Store client
          if (!sseClients.has(companyId)) {
            sseClients.set(companyId, new Set());
          }
          const client = {
            id: clientId,
            send: (event, data) => {
              const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
              controller.enqueue(encoder.encode(msg));
            }
          };
          sseClients.get(companyId).add(client);

          // Send initial connected message
          client.send("connected", { ok: true });

          // Cleanup on close
          const closeInterval = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(":\n\n"));
            } catch (e) {
              clearInterval(closeInterval);
              sseClients.get(companyId).delete(client);
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
    }

    // ==================== API: CREATE BOOKING (FORM HANDLER) ====================
    if (url.pathname === "/api/bookings/create" && request.method === "POST") {
      try {
        const formData = await request.formData();
        const companyId = activeCompanyId;
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
          bookingId, companyId, name, phone, email || null, pax, date, time, bookingDateTime, "indoor", "pending", 1, "web", now, now, "system"
        ).run();

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
            area: "indoor",
            stage: "pending"
          };

          for (const client of sseClients.get(companyId)) {
            client.send("booking", booking);
          }
        }

        return Response.json({
          ok: true,
          bookingId,
          redirect_url: "/danke-reservierung"
        });
      } catch (e) {
        console.error("Booking create error:", e);
        return Response.json(
          { ok: false, error: e.message },
          { status: 500 }
        );
      }
    }

    // ==================== API: UPDATE BOOKING STAGE ====================
    if (url.pathname.match(/^\/api\/bookings\/([^\/]+)\/stage$/) && request.method === "POST") {
      try {
        const bookingId = url.pathname.match(/^\/api\/bookings\/([^\/]+)\/stage$/)[1];
        const body = await request.json();
        const { stage: newStage, staffId } = body;

        let companyId = activeCompanyId;
        const reqCompanyId = Number(body?.companyId || 0);
        if (Number.isInteger(reqCompanyId) && reqCompanyId > 0) {
          companyId = reqCompanyId;
        }

        if (!bookingId || !newStage) {
          return Response.json(
            { ok: false, error: "bookingId and stage required" },
            { status: 400 }
          );
        }

        // Get existing booking
        const booking = await env.DB.prepare(
          `SELECT stage FROM bookings WHERE id = ? AND company_id = ?`
        ).bind(bookingId, companyId).first();

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
        ).bind(newStage, now, staffId || "staff", bookingId, companyId).run();

        // Create audit log
        const actionId = `action_${Date.now()}`;
        await env.DB.prepare(
          `INSERT INTO booking_actions (id, company_id, booking_id, action_type, old_stage, new_stage, changed_by, changed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          actionId, companyId, bookingId, "stage_changed", booking.stage, newStage, staffId || "staff", now
        ).run();

        // Notify SSE clients
        if (sseClients.has(companyId)) {
          for (const client of sseClients.get(companyId)) {
            client.send("stage-update", { bookingId, newStage });
          }
        }

        // Sync stage to booking board KV (no-op when BOARD_KV binding is absent)
        syncBookingStageToBoard(env, {
          bookingId,
          companyId,
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
    }

    // ==================== API: GET BOOKINGS BY COMPANY ====================
    if (url.pathname === "/api/bookings" && request.method === "GET") {
      try {
        const companyId = activeCompanyId;
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
    }

    // ==================== API: TEST BOOKING (Development) ====================
    if (url.pathname === "/api/test/booking/create" && request.method === "POST") {
      try {
        const companyId = activeCompanyId;
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
    }

    // ==================== API: GET CUSTOMERS ====================
    if (url.pathname === "/api/customers" && request.method === "GET") {
      try {
        const companyId = activeCompanyId;

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
    }

    // ==================== 404 ====================
    return Response.json(
      { ok: false, error: "Not found" },
      { status: 404 }
    );
  }
};
