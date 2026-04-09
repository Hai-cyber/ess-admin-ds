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
  platform_price_note: 'Billed per active user. Included: hosting, platform maintenance, SSL, and a managed gooddining.app subdomain. Add-ons only apply for SMS usage, TSE, onboarding, and optional IT support.',
  platform_payment_method_paypal: 'enabled',
  platform_payment_method_bankcard: 'enabled',
  platform_payment_method_cash: 'enabled',
  platform_payment_method_pickup_at_store: 'enabled'
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
const SUBDOMAIN_DECISION_SEVERITY = {
  allow: 0,
  review: 1,
  block: 2
};
const WEBSITE_BLOCK_PATTERNS = [
  { code: 'sexual_explicit_content', pattern: /\bonlyfans\b|\bporn\b|\bescort\b|\bsex cam\b|\bxxx\b/i },
  { code: 'phishing_or_impersonation_copy', pattern: /verify your account|confirm your bank|wallet recovery|seed phrase|password reset required/i },
  { code: 'hate_or_harassment_copy', pattern: /kill all|ethnic cleansing|racial purity/i }
];
const WEBSITE_REVIEW_PATTERNS = [
  { code: 'suspicious_external_link', pattern: /https?:\/\/(?:t\.me|telegram\.me|bit\.ly|tinyurl\.com|rb\.gy)\//i },
  { code: 'political_sensitive_copy', pattern: /\belection\b|\bvote for\b|\bpolitical movement\b/i },
  { code: 'religious_sensitive_copy', pattern: /\bchurch donation\b|\breligious mission\b|\bfaith healing\b/i },
  { code: 'crypto_or_investment_copy', pattern: /\bcrypto\b|\bairdrop\b|\binvest now\b|\btrading signal\b/i }
];
const WEBSITE_BUILDER_DEFAULTS = {
  site_template: 'modern',
  site_theme_variant: 'theme-luxury-a',
  site_content_preset: 'theme-luxury-a',
  site_language: 'en',
  site_tagline: 'Neighborhood restaurant with a modern booking experience.',
  site_hero_title: 'Welcome to our restaurant',
  site_hero_subtitle: 'Book a table, explore our menu, and discover what makes us special.',
  site_about_title: 'About us',
  site_about_body: 'Tell guests what your restaurant is about, what style of cuisine you serve, and why they should visit.',
  site_primary_cta_text: 'Book a table',
  site_secondary_cta_text: 'View menu',
  site_contact_address: '27 Alder Quay, Berlin 10407',
  site_accent_color: '#A54A7B',
  site_branding_json: '{}',
  site_navigation_json: '{}',
  site_content_json: '{}',
  site_career_json: '{}'
};
const WEBSITE_THEME_PREVIEW_PROFILES = {
  'theme-basic-a': {
    company: {
      name: 'Common Table',
      city: 'Berlin',
      cuisine: 'Casual Grill & Lunch',
      phone: '+49 30 2201 4810',
      email: 'hello@common-table.example',
      address: '18 Lindenhof Passage, 10435 Berlin'
    },
    settings: {
      site_tagline: 'Straightforward neighborhood dining with fast booking and big food cues.',
      site_hero_title: 'Common Table',
      site_hero_subtitle: 'A direct, friendly restaurant site built to sell dishes clearly and convert fast.'
    }
  },
  'theme-basic-b': {
    company: {
      name: 'Brick & Pepper',
      city: 'Berlin',
      cuisine: 'Fire Kitchen',
      phone: '+49 30 2201 4820',
      email: 'table@brick-pepper.example',
      address: '44 Gartenmarkt, 10999 Berlin'
    },
    settings: {
      site_tagline: 'Warm casual food, louder appetite cues, and a practical conversion flow.',
      site_hero_title: 'Brick & Pepper',
      site_hero_subtitle: 'Built for hearty dishes, visible value, and a simpler neighborhood sales language.'
    }
  },
  'theme-luxury-a': {
    company: {
      name: 'Maison Cendree',
      city: 'Berlin',
      cuisine: 'Seasonal Fine Dining',
      phone: '+49 30 2201 4830',
      email: 'reservations@maison-cendree.example',
      address: '7 Monbijou Platz, 10178 Berlin'
    },
    settings: {
      site_tagline: 'Seasonal hospitality with a composed, editorial luxury tone.',
      site_hero_title: 'Maison Cendree',
      site_hero_subtitle: 'A quieter luxury expression built around light, space, and a restrained dining-room rhythm.'
    }
  },
  'theme-luxury-b': {
    company: {
      name: 'Maison Verenne',
      city: 'Berlin',
      cuisine: 'French Dining & Cocktails',
      phone: '+49 30 2201 4840',
      email: 'soir@maison-verenne.example',
      address: '112 Augustufer, 10117 Berlin'
    },
    settings: {
      site_tagline: 'A cinematic evening house shaped by shadow, copper detail, and appetite.',
      site_hero_title: 'Maison Verenne',
      site_hero_subtitle: 'An atmosphere-led restaurant concept where the homepage sells emotion first and practical navigation stays quiet.'
    }
  },
  'theme-minimal-a': {
    company: {
      name: 'Studio Aster',
      city: 'Berlin',
      cuisine: 'Modern Seasonal Plates',
      phone: '+49 30 2201 4850',
      email: 'hello@studio-aster.example',
      address: '39 Linienufer, 10115 Berlin'
    },
    settings: {
      site_tagline: 'Editorial calm, asymmetry, and a modern neighborhood story.',
      site_hero_title: 'Studio Aster',
      site_hero_subtitle: 'Built for brands that want a quieter, more directional visual language with more whitespace and narrative.'
    }
  },
  'theme-minimal-b': {
    company: {
      name: 'North Vale',
      city: 'Berlin',
      cuisine: 'Contemporary Kitchen',
      phone: '+49 30 2201 4860',
      email: 'bookings@north-vale.example',
      address: '53 Helioshof, 10243 Berlin'
    },
    settings: {
      site_tagline: 'Clean structure, restrained typography, and a sharper editorial edge.',
      site_hero_title: 'North Vale',
      site_hero_subtitle: 'A minimal concept that trades decorative UI for proportion, image placement, and quiet confidence.'
    }
  },
  'theme-diner-a': {
    company: {
      name: 'Lucky Jet Diner',
      city: 'Berlin',
      cuisine: 'Burgers, Shakes & Late Bites',
      phone: '+49 30 2201 4870',
      email: 'hello@lucky-jet.example',
      address: '91 Neon Arcade, 10967 Berlin'
    },
    settings: {
      site_tagline: 'Big appetite cues, color, and fast ordering energy.',
      site_hero_title: 'Lucky Jet Diner',
      site_hero_subtitle: 'A louder family built for food-first merchandising, category blocks, and high-clarity action paths.'
    }
  },
  'theme-diner-b': {
    company: {
      name: 'Turbo Melt',
      city: 'Berlin',
      cuisine: 'Street Burgers & Fries',
      phone: '+49 30 2201 4880',
      email: 'crew@turbo-melt.example',
      address: '12 Signal Yard, 12043 Berlin'
    },
    settings: {
      site_tagline: 'Hotter color, denser merchandising, and a stronger impulse-ordering rhythm.',
      site_hero_title: 'Turbo Melt',
      site_hero_subtitle: 'Made for louder diner brands that need category visibility and immediate commercial energy.'
    }
  }
};
const WEBSITE_THEME_FALLBACK_BY_TEMPLATE = {
  minimal: 'theme-minimal-a',
  modern: 'theme-basic-a',
  premium: 'theme-luxury-a'
};
const WEBSITE_SUPPORTED_THEME_VARIANTS = new Set([
  'theme-basic-a',
  'theme-basic-b',
  'theme-luxury-a',
  'theme-luxury-b',
  'theme-minimal-a',
  'theme-minimal-b',
  'theme-diner-a',
  'theme-diner-b'
]);
const WEBSITE_SUPPORTED_LANGUAGES = new Set(['en', 'de']);
const DEMO_PAYMENT_METHODS = new Set(['paypal', 'bankcard', 'cash', 'pickup_at_store']);
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
  'accepted_payment_methods_json',
  'demo_payment_method',
  'company_plan',
  'billable_staff_count',
  'billing_include_tse',
  'billing_include_support_retainer',
  'billing_include_setup',
  'demo_payment_status',
  'demo_payment_reference',
  'demo_payment_confirmed_at',
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
  accepted_payment_methods_json: 'Accepted payment methods exposed to the tenant and checkout flow',
  demo_payment_method: 'Chosen payment method for the demo payment signup flow',
  company_plan: 'Current tenant subscription plan',
  billable_staff_count: 'Current count of active billable staff users',
  billing_include_tse: 'Whether the tenant invoice includes TSE monthly surcharge',
  billing_include_support_retainer: 'Whether the tenant invoice includes monthly IT support retainer',
  billing_include_setup: 'Whether the tenant invoice includes one-time setup fee',
  demo_payment_status: 'Current payment status for signup/demo billing',
  demo_payment_reference: 'External payment reference such as a Stripe checkout session id',
  demo_payment_confirmed_at: 'Timestamp when payment moved from pending to confirmed',
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
  site_theme_variant: 'Exact tenant website theme variant key (for example theme-luxury-a)',
  site_content_preset: 'Content preset key used by the website master payload',
  site_language: 'Public website language code (en or de)',
  site_tagline: 'Short public-facing tagline for the restaurant website',
  site_hero_title: 'Main hero title on the tenant website',
  site_hero_subtitle: 'Hero subtitle on the tenant website',
  site_about_title: 'About section title on the tenant website',
  site_about_body: 'About section body text on the tenant website',
  site_primary_cta_text: 'Primary call-to-action label on the tenant website',
  site_secondary_cta_text: 'Secondary call-to-action label on the tenant website',
  site_contact_address: 'Public contact address shown on the tenant website',
  site_accent_color: 'Primary brand accent color for the tenant website',
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

function stripDiacritics(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeTenantSubdomain(rawSubdomain) {
  return stripDiacritics(rawSubdomain)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

function buildTenantWebsiteUrl(subdomain) {
  return 'https://' + subdomain + '.' + PLATFORM_PUBLIC_DOMAIN;
}

function normalizePublicUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function normalizeCustomDomainHostname(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/\.+$/, '');
}

function isValidCustomDomainHostname(hostname) {
  const normalized = normalizeCustomDomainHostname(hostname);
  if (!normalized) return false;
  if (normalized === PLATFORM_PUBLIC_DOMAIN || normalized.endsWith(`.${PLATFORM_PUBLIC_DOMAIN}`)) return false;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(normalized)) return false;
  return normalized.split('.').length >= 3;
}

function buildCustomDomainDnsTarget(company) {
  const subdomain = normalizeTenantSubdomain(company?.subdomain || '');
  return subdomain ? `${subdomain}.${PLATFORM_PUBLIC_DOMAIN}` : '';
}

function buildPublishedWebsiteUrlForCompany(company, operationalSettings = {}) {
  const customDomain = normalizePublicUrl(operationalSettings.custom_domain);
  if (customDomain) return customDomain;

  const subdomain = String(company?.subdomain || '').trim().toLowerCase();
  if (subdomain) return buildTenantWebsiteUrl(subdomain);

  return normalizePublicUrl(operationalSettings.website_url);
}

function isValidTenantSubdomain(subdomain) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(String(subdomain || ''));
}

function pickStrongerDecision(currentDecision, nextDecision) {
  return SUBDOMAIN_DECISION_SEVERITY[nextDecision] > SUBDOMAIN_DECISION_SEVERITY[currentDecision]
    ? nextDecision
    : currentDecision;
}

function buildSubdomainSuggestions(slug) {
  const base = normalizeTenantSubdomain(slug);
  if (!base) return [];
  return [
    `${base}-restaurant`,
    `${base}-dining`,
    `${base}-kitchen`
  ].map((candidate) => normalizeTenantSubdomain(candidate)).filter(Boolean);
}

function matchReservedTerm(slug, rule) {
  const target = normalizeTenantSubdomain(slug);
  const term = normalizeTenantSubdomain(rule?.normalized_term || rule?.term || '');
  if (!target || !term) return false;

  switch (String(rule?.match_type || '').trim().toLowerCase()) {
    case 'exact':
      return target === term;
    case 'contains':
      return target.includes(term);
    case 'prefix':
      return target.startsWith(term);
    case 'suffix':
      return target.endsWith(term);
    case 'fuzzy':
      return target === term || target.startsWith(`${term}-`) || target.endsWith(`-${term}`) || target.includes(term);
    default:
      return false;
  }
}

async function getReservedTerms(env) {
  try {
    const result = await env.DB.prepare(`
      SELECT term, normalized_term, match_type, category, action
      FROM reserved_terms
      WHERE is_active = 1
    `).all();
    return result?.results || [];
  } catch (error) {
    if (String(error?.message || '').toLowerCase().includes('no such table')) {
      return [];
    }
    throw error;
  }
}

async function upsertSubdomainReservation(env, slug, companyId, status, reasonCode, decisionSource = 'system') {
  const normalizedSlug = normalizeTenantSubdomain(slug);
  if (!normalizedSlug) return;
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO subdomain_reservations
    (id, slug, normalized_slug, company_id, status, reason_code, decision_source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    `${status}_${normalizedSlug}`,
    slug,
    normalizedSlug,
    companyId || null,
    status,
    reasonCode || null,
    decisionSource,
    now,
    now
  ).run();

  await env.DB.prepare(`
    UPDATE subdomain_reservations
    SET slug = ?,
        company_id = ?,
        reason_code = ?,
        decision_source = ?,
        updated_at = ?
    WHERE normalized_slug = ? AND status = ?
  `).bind(
    slug,
    companyId || null,
    reasonCode || null,
    decisionSource,
    now,
    normalizedSlug,
    status
  ).run();
}

async function evaluateSubdomainPolicy(env, rawSubdomain, options = {}) {
  const { companyId = null, allowEmpty = false } = options;
  const slug = normalizeTenantSubdomain(rawSubdomain);

  if (!slug) {
    return {
      slug,
      decision: allowEmpty ? 'allow' : 'block',
      available: !!allowEmpty,
      reasonCodes: allowEmpty ? [] : ['subdomain_required'],
      message: allowEmpty ? '' : 'Subdomain is required.',
      suggestions: []
    };
  }

  if (!isValidTenantSubdomain(slug)) {
    return {
      slug,
      decision: 'block',
      available: false,
      reasonCodes: ['subdomain_invalid_syntax'],
      message: 'Subdomain must use lowercase letters, numbers, and hyphens.',
      suggestions: buildSubdomainSuggestions(slug)
    };
  }

  let decision = 'allow';
  const reasonCodes = [];
  const reservedTerms = await getReservedTerms(env);

  for (const rule of reservedTerms) {
    if (!matchReservedTerm(slug, rule)) continue;
    const action = String(rule?.action || '').trim().toLowerCase();
    const reasonBase = String(rule?.category || 'reserved_term').trim().toLowerCase() || 'reserved_term';
    reasonCodes.push(`${reasonBase}_${action || 'match'}`);
    decision = pickStrongerDecision(decision, action === 'review' ? 'review' : 'block');
  }

  const reservation = await env.DB.prepare(`
    SELECT company_id, status, reason_code
    FROM subdomain_reservations
    WHERE normalized_slug = ?
      AND status IN ('reserved', 'quarantine', 'blocked')
    ORDER BY updated_at DESC
    LIMIT 1
  `).bind(slug).first();

  if (reservation && Number(reservation.company_id || 0) !== Number(companyId || 0)) {
    const status = String(reservation.status || '').trim().toLowerCase();
    if (status) {
      reasonCodes.push(reservation.reason_code || `subdomain_${status}`);
      decision = pickStrongerDecision(decision, 'block');
    }
  }

  const existingCompany = await env.DB.prepare(`
    SELECT id FROM companies WHERE lower(subdomain) = lower(?) LIMIT 1
  `).bind(slug).first();

  if (existingCompany?.id && Number(existingCompany.id) !== Number(companyId || 0)) {
    reasonCodes.push('subdomain_taken');
    decision = pickStrongerDecision(decision, 'block');
  }

  const suggestions = buildSubdomainSuggestions(slug);
  const uniqueReasonCodes = Array.from(new Set(reasonCodes));
  const message = decision === 'allow'
    ? 'Subdomain available.'
    : decision === 'review'
      ? 'Subdomain requires operator review before approval.'
      : uniqueReasonCodes.includes('subdomain_taken')
        ? 'Subdomain already in use.'
        : 'Subdomain is blocked by platform policy.';

  return {
    slug,
    decision,
    available: decision === 'allow',
    reasonCodes: uniqueReasonCodes,
    message,
    suggestions
  };
}

function reviewWebsitePayload(source) {
  const text = JSON.stringify(source || {}).toLowerCase();
  let decision = 'allow';
  let riskScore = 0;
  const reasonCodes = [];

  for (const rule of WEBSITE_BLOCK_PATTERNS) {
    if (!rule.pattern.test(text)) continue;
    decision = 'block';
    riskScore += 90;
    reasonCodes.push(rule.code);
  }

  if (decision !== 'block') {
    for (const rule of WEBSITE_REVIEW_PATTERNS) {
      if (!rule.pattern.test(text)) continue;
      decision = pickStrongerDecision(decision, 'review');
      riskScore += 35;
      reasonCodes.push(rule.code);
    }
  }

  return {
    decision,
    riskScore,
    reasonCodes: Array.from(new Set(reasonCodes))
  };
}

async function sendTelegramReviewAlert(env, payload) {
  const botToken = String(env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(env.TELEGRAM_REVIEW_CHAT_ID || '').trim();
  if (!botToken || !chatId) {
    return { ok: false, skipped: true };
  }

  const reviewUrl = String(payload.reviewUrl || '').trim();
  const tenantAdminUrl = String(payload.tenantAdminUrl || '').trim();
  const previewUrl = String(payload.previewUrl || '').trim();

  const text = [
    `Moderation alert: ${payload.eventType || 'review'}`,
    `Tenant: ${payload.companyId}${payload.companyName ? ` / ${payload.companyName}` : ''}`,
    payload.host ? `Host: ${payload.host}` : '',
    payload.decision ? `Decision: ${payload.decision}` : '',
    Number.isFinite(payload.riskScore) ? `Risk score: ${payload.riskScore}` : '',
    payload.reasonCodes?.length ? `Reasons: ${payload.reasonCodes.join(', ')}` : '',
    previewUrl ? `Preview: ${previewUrl}` : '',
    reviewUrl ? `Review Console: ${reviewUrl}` : '',
    tenantAdminUrl ? `Tenant Admin: ${tenantAdminUrl}` : '',
    payload.reviewId ? `Review ID: ${payload.reviewId}` : ''
  ].filter(Boolean).join('\n');

  const inlineKeyboard = [];
  if (reviewUrl) {
    inlineKeyboard.push([{ text: 'Open Review Console', url: reviewUrl }]);
  }
  if (previewUrl) {
    inlineKeyboard.push([{ text: 'Open Preview', url: previewUrl }]);
  }
  if (tenantAdminUrl) {
    inlineKeyboard.push([{ text: 'Open Tenant Admin', url: tenantAdminUrl }]);
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      reply_markup: inlineKeyboard.length ? { inline_keyboard: inlineKeyboard } : undefined
    })
  });

  return { ok: response.ok, status: response.status };
}

async function sendMailChannelsEmail({ from, to, subject, text }) {
  const recipients = String(to || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!from || !recipients.length || !subject || !text) {
    return { ok: false, skipped: true };
  }

  const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: recipients.map((email) => ({ email })) }],
      from: { email: from },
      subject,
      content: [{ type: 'text/plain', value: text }]
    })
  });

  return { ok: response.ok, status: response.status };
}

function buildDomainRenewalReminderPreview(domainRequest) {
  const request = annotateCustomDomainRequest(domainRequest);
  const dueAt = String(request?.renewal_due_at || '').trim();
  const daysUntilDue = Number.isFinite(Number(request?.daysUntilDue)) ? Number(request.daysUntilDue) : null;
  const timingLine = daysUntilDue == null
    ? 'Renewal timing: not scheduled'
    : (daysUntilDue >= 0
      ? `Renewal timing: due in ${daysUntilDue} day(s)`
      : `Renewal timing: overdue by ${Math.abs(daysUntilDue)} day(s)`);

  const subject = `Managed domain renewal: ${String(request?.requested_domain || 'unknown-domain').trim()}`;
  const text = [
    'Managed domain renewal reminder',
    `Domain: ${String(request?.requested_domain || '').trim()}`,
    `Company ID: ${Number(request?.company_id || 0)}`,
    `Request status: ${String(request?.request_status || 'n/a').trim()}`,
    `Renewal status: ${String(request?.renewalStatus || request?.renewal_status || 'n/a').trim()}`,
    dueAt ? `Renewal due at: ${dueAt}` : '',
    timingLine,
    `Auto renew: ${Number(request?.auto_renew_enabled || 0) === 1 ? 'enabled' : 'disabled'}`,
    request?.operator_note ? `Operator note: ${String(request.operator_note).trim()}` : ''
  ].filter(Boolean).join('\n');

  return { subject, text };
}

async function sendManagedDomainRenewalDigest(env, payload = {}) {
  const summary = payload.summary || { reminders: [] };
  const reminders = Array.isArray(summary.reminders) ? summary.reminders : [];
  if (!reminders.length) {
    return { ok: false, skipped: true, channels: [] };
  }

  const subject = `Domain renewal digest: ${reminders.length} reminder(s)`;
  const text = [
    'Managed domain renewal digest',
    `Reminded: ${Number(summary.reminded || 0)}`,
    `Updated: ${Number(summary.updated || 0)}`,
    `Skipped: ${Number(summary.skipped || 0)}`,
    '',
    ...reminders.map((item) => `- ${item.requestedDomain} | company ${item.companyId} | ${item.renewalStatus} | ${item.daysUntilDue} day(s) | ${item.eventType}`)
  ].join('\n');

  const channels = [];

  const telegramResult = await sendTelegramReviewAlert(env, {
    eventType: 'domain_renewal_digest',
    companyId: 'platform',
    companyName: `reminders=${reminders.length}`,
    decision: 'digest',
    reasonCodes: reminders.map((item) => `${item.requestedDomain}:${item.eventType}`),
    reviewId: '',
    reviewUrl: String(payload.reviewUrl || '').trim(),
    tenantAdminUrl: '',
    previewUrl: ''
  });
  channels.push({ channel: 'telegram', ...telegramResult });

  const emailTo = String(env.OPERATOR_DIGEST_EMAIL_TO || '').trim();
  const emailFrom = String(env.OPERATOR_DIGEST_EMAIL_FROM || '').trim();
  const emailResult = await sendMailChannelsEmail({
    from: emailFrom,
    to: emailTo,
    subject,
    text
  });
  channels.push({ channel: 'email', ...emailResult });

  return {
    ok: channels.some((item) => item.ok),
    skipped: channels.every((item) => item.skipped),
    channels,
    subject,
    text
  };
}

function buildPlatformReviewLinks(origin, reviewId, companyId) {
  const baseOrigin = String(origin || '').trim();
  const reviewPart = reviewId ? `?review=${encodeURIComponent(reviewId)}` : '';
  return {
    reviewUrl: baseOrigin ? `${baseOrigin}/platform/admin.html${reviewPart}` : '',
    tenantAdminUrl: baseOrigin && companyId ? `${baseOrigin}/admin?company_id=${encodeURIComponent(companyId)}` : ''
  };
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

function normalizeDemoPaymentMethod(value, fallback = 'bankcard') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return DEMO_PAYMENT_METHODS.has(normalized) ? normalized : fallback;
}

function parseAcceptedPaymentMethods(rawValue) {
  const source = Array.isArray(rawValue)
    ? rawValue
    : (typeof rawValue === 'string' ? parseJsonArray(rawValue) : []);

  return source
    .map((item) => normalizeDemoPaymentMethod(item, ''))
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index);
}

function getPlatformPaymentMethodSettingKey(method) {
  return `platform_payment_method_${normalizeDemoPaymentMethod(method, '')}`;
}

function getEnabledPlatformPaymentMethods(settingsMap = {}) {
  const enabled = [];
  for (const method of DEMO_PAYMENT_METHODS) {
    const key = getPlatformPaymentMethodSettingKey(method);
    const fallback = PLATFORM_PRICING_DEFAULTS[key] || 'disabled';
    if (parseBooleanLike(settingsMap[key], parseBooleanLike(fallback, false))) {
      enabled.push(method);
    }
  }
  return enabled;
}

function buildPaymentMethodPolicy(settingsMap = {}) {
  const enabled = getEnabledPlatformPaymentMethods(settingsMap);
  return {
    enabled,
    toggles: Object.fromEntries(Array.from(DEMO_PAYMENT_METHODS).map((method) => [method, enabled.includes(method)]))
  };
}

function normalizeDemoPaymentMethodForPlatform(method, platformSettings = {}, fallback = 'bankcard') {
  const enabled = getEnabledPlatformPaymentMethods(platformSettings);
  const preferred = normalizeDemoPaymentMethod(method, fallback);
  if (enabled.includes(preferred)) return preferred;
  if (enabled.includes(fallback)) return fallback;
  return enabled[0] || fallback;
}

function canUseStripeCheckout(env) {
  const stripeMode = String(env?.STRIPE_MODE || '').trim().toLowerCase();
  return stripeMode === 'mock' || !!String(env?.STRIPE_API_KEY || '').trim();
}

async function createStripeCheckoutSession(env, payload = {}) {
  const amountEur = Number(payload.amountEur || 0);
  const amountCents = Math.round(amountEur * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { ok: false, status: 400, code: 'validation_failed', error: 'Stripe checkout amount must be greater than zero.' };
  }

  const stripeMode = String(env?.STRIPE_MODE || '').trim().toLowerCase();
  if (stripeMode === 'mock') {
    const sessionId = `cs_test_mock_${crypto.randomUUID()}`;
    const successUrl = String(payload.successUrl || '').trim();
    return {
      ok: true,
      id: sessionId,
      url: successUrl.includes('{CHECKOUT_SESSION_ID}')
        ? successUrl.replaceAll('{CHECKOUT_SESSION_ID}', encodeURIComponent(sessionId))
        : `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id=${encodeURIComponent(sessionId)}&mock_stripe_session=1`
    };
  }

  const stripeKey = String(env?.STRIPE_API_KEY || '').trim();
  if (!stripeKey) {
    return { ok: false, status: 503, code: 'stripe_unavailable', error: 'Stripe API key is not configured.' };
  }

  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', String(payload.successUrl || '').trim());
  form.set('cancel_url', String(payload.cancelUrl || '').trim());
  form.append('payment_method_types[]', 'card');
  form.set('line_items[0][price_data][currency]', 'eur');
  form.set('line_items[0][price_data][unit_amount]', String(amountCents));
  form.set('line_items[0][price_data][product_data][name]', String(payload.productName || 'Restaurant OS signup').trim());
  form.set('line_items[0][quantity]', '1');
  if (payload.customerEmail) {
    form.set('customer_email', String(payload.customerEmail).trim());
  }

  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  for (const [key, value] of Object.entries(metadata)) {
    form.set(`metadata[${key}]`, String(value || '').trim());
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: 503,
      code: 'stripe_unavailable',
      error: String(data?.error?.message || 'Unable to create Stripe checkout session.'),
      stripeErrorCode: String(data?.error?.code || '').trim()
    };
  }

  return {
    ok: true,
    id: String(data?.id || '').trim(),
    url: String(data?.url || '').trim()
  };
}

async function retrieveStripeCheckoutSession(env, sessionId) {
  const stripeMode = String(env?.STRIPE_MODE || '').trim().toLowerCase();
  if (stripeMode === 'mock') {
    return {
      ok: true,
      id: String(sessionId || '').trim(),
      status: 'complete',
      payment_status: 'paid'
    };
  }

  const stripeKey = String(env?.STRIPE_API_KEY || '').trim();
  if (!stripeKey) {
    return { ok: false, status: 503, code: 'stripe_unavailable', error: 'Stripe API key is not configured.' };
  }

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(String(sessionId || '').trim())}`, {
    headers: {
      Authorization: `Bearer ${stripeKey}`
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: 503,
      code: 'stripe_unavailable',
      error: String(data?.error?.message || 'Unable to retrieve Stripe checkout session.'),
      stripeErrorCode: String(data?.error?.code || '').trim()
    };
  }

  return {
    ok: true,
    id: String(data?.id || '').trim(),
    status: String(data?.status || '').trim(),
    payment_status: String(data?.payment_status || '').trim()
  };
}

async function confirmPlatformSignupPayment(env, payload = {}) {
  const companyId = Number(payload.companyId || 0);
  const sessionId = String(payload.sessionId || '').trim();
  if (!companyId || !sessionId) {
    return { ok: false, status: 400, code: 'validation_failed', error: 'company_id and session_id are required.' };
  }

  const signup = await env.DB.prepare(`
    SELECT id, company_id, payment_status, payment_method, payment_reference
    FROM platform_signups
    WHERE company_id = ? AND payment_reference = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(companyId, sessionId).first();

  if (!signup) {
    return { ok: false, status: 404, code: 'payment_not_found', error: 'Pending checkout record not found.' };
  }

  if (String(signup.payment_status || '').trim().toLowerCase() === 'stripe_paid') {
    return { ok: true, alreadyConfirmed: true, paymentStatus: 'stripe_paid', sessionId };
  }

  const checkoutSession = await retrieveStripeCheckoutSession(env, sessionId);
  if (!checkoutSession.ok) {
    return checkoutSession;
  }

  if (String(checkoutSession.payment_status || '').trim().toLowerCase() !== 'paid') {
    return {
      ok: false,
      status: 409,
      code: 'payment_not_completed',
      error: 'Stripe checkout is not paid yet.',
      stripe_status: checkoutSession.status,
      stripe_payment_status: checkoutSession.payment_status
    };
  }

  const now = new Date().toISOString();
  await setPlatformSignupPaymentState(env, {
    signupId: signup.id,
    companyId,
    sessionId,
    paymentStatus: 'stripe_paid',
    confirmedAt: now,
    updatedBy: 'stripe-confirmation'
  });

  return {
    ok: true,
    paymentStatus: 'stripe_paid',
    confirmedAt: now,
    sessionId
  };
}

async function setPlatformSignupPaymentState(env, payload = {}) {
  const signupId = String(payload.signupId || '').trim();
  const companyId = Number(payload.companyId || 0);
  const sessionId = String(payload.sessionId || '').trim();
  const paymentStatus = String(payload.paymentStatus || '').trim();
  const confirmedAt = String(payload.confirmedAt || '').trim() || null;
  const updatedBy = String(payload.updatedBy || 'payment-state').trim();

  if (!signupId || !companyId || !paymentStatus) {
    return false;
  }

  await env.DB.prepare(`
    UPDATE platform_signups
    SET payment_status = ?, payment_reference = ?, payment_confirmed_at = ?
    WHERE id = ?
  `).bind(paymentStatus, sessionId || null, confirmedAt, signupId).run();

  await Promise.all([
    upsertSettingValue(env, companyId, 'demo_payment_status', paymentStatus, OPERATIONAL_KEY_DESCRIPTIONS.demo_payment_status, updatedBy),
    upsertSettingValue(env, companyId, 'demo_payment_confirmed_at', confirmedAt || '', OPERATIONAL_KEY_DESCRIPTIONS.demo_payment_confirmed_at, updatedBy),
    upsertSettingValue(env, companyId, 'demo_payment_reference', sessionId, OPERATIONAL_KEY_DESCRIPTIONS.demo_payment_reference, updatedBy)
  ]);

  await logPlatformSignupPaymentEvent(env, {
    signupId,
    companyId,
    paymentReference: sessionId,
    paymentStatus,
    eventType: 'payment_status_updated',
    eventSource: updatedBy,
    note: confirmedAt ? `Confirmed at ${confirmedAt}` : `Status set to ${paymentStatus}`
  });

  return true;
}

async function logPlatformSignupPaymentEvent(env, payload = {}) {
  const now = payload.createdAt || new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO payment_events (
      id, signup_id, company_id, payment_reference, payment_method, payment_status,
      event_type, event_source, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    payload.id || crypto.randomUUID(),
    payload.signupId || null,
    Number(payload.companyId || 0) || null,
    payload.paymentReference || null,
    payload.paymentMethod || null,
    payload.paymentStatus || null,
    String(payload.eventType || 'payment_event').trim(),
    payload.eventSource || null,
    payload.note || null,
    now
  ).run();
}

async function createPlatformSignupCheckoutRetry(env, payload = {}) {
  const signupId = String(payload.signupId || '').trim();
  const origin = String(payload.origin || '').trim();
  if (!signupId || !origin) {
    return { ok: false, status: 400, code: 'validation_failed', error: 'signupId and origin are required.' };
  }

  const signup = await env.DB.prepare(`
    SELECT id, company_id, organization_id, restaurant_name, owner_email, plan, payment_method,
           due_today_eur, recurring_monthly_eur, payment_status
    FROM platform_signups
    WHERE id = ?
    LIMIT 1
  `).bind(signupId).first();

  if (!signup?.id) {
    return { ok: false, status: 404, code: 'signup_not_found', error: 'Signup not found.' };
  }

  if (String(signup.payment_method || '').trim() !== 'bankcard') {
    return { ok: false, status: 409, code: 'payment_retry_not_supported', error: 'Retry checkout is only available for bank card signups.' };
  }

  if (!canUseStripeCheckout(env)) {
    return { ok: false, status: 503, code: 'stripe_unavailable', error: 'Stripe checkout is unavailable right now.' };
  }

  const amountEur = Number(signup.due_today_eur || 0) > 0
    ? Number(signup.due_today_eur || 0)
    : Number(signup.recurring_monthly_eur || 0);

  const checkoutSession = await createStripeCheckoutSession(env, {
    amountEur,
    customerEmail: signup.owner_email,
    productName: `${signup.restaurant_name} ${signup.plan} signup retry`,
    successUrl: `${origin}/platform/signup.html?checkout=success&company_id=${signup.company_id}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/platform/signup.html?checkout=cancelled&company_id=${signup.company_id}`,
    metadata: {
      company_id: signup.company_id,
      organization_id: signup.organization_id,
      restaurant_name: signup.restaurant_name,
      plan: signup.plan,
      signup_id: signup.id
    }
  });

  if (!checkoutSession.ok) {
    return checkoutSession;
  }

  await setPlatformSignupPaymentState(env, {
    signupId: signup.id,
    companyId: Number(signup.company_id || 0),
    sessionId: checkoutSession.id,
    paymentStatus: 'stripe_checkout_pending',
    confirmedAt: null,
    updatedBy: String(payload.updatedBy || 'stripe-retry').trim()
  });

  await logPlatformSignupPaymentEvent(env, {
    signupId: signup.id,
    companyId: Number(signup.company_id || 0),
    paymentReference: checkoutSession.id,
    paymentMethod: signup.payment_method,
    paymentStatus: 'stripe_checkout_pending',
    eventType: 'checkout_retry_created',
    eventSource: String(payload.updatedBy || 'stripe-retry').trim(),
    note: 'New Stripe checkout session created for retry.'
  });

  return {
    ok: true,
    signupId: signup.id,
    companyId: Number(signup.company_id || 0),
    checkoutUrl: checkoutSession.url,
    sessionId: checkoutSession.id,
    paymentStatus: 'stripe_checkout_pending'
  };
}

function hexEncode(bytes) {
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyStripeWebhookSignature(payloadText, signatureHeader, secret) {
  const parts = String(signatureHeader || '').split(',').map((item) => item.trim()).filter(Boolean);
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2) || '';
  const signature = parts.find((part) => part.startsWith('v1='))?.slice(3) || '';
  if (!timestamp || !signature || !secret) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payloadText}`));
  return hexEncode(signed) === signature;
}

async function parseStripeWebhookEvent(env, request) {
  const payloadText = await request.text();
  const stripeMode = String(env?.STRIPE_MODE || '').trim().toLowerCase();
  if (stripeMode === 'mock') {
    return { ok: true, event: JSON.parse(payloadText || '{}') };
  }

  const secret = String(env?.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    return { ok: false, status: 503, code: 'stripe_webhook_unconfigured', error: 'Stripe webhook secret is not configured.' };
  }

  const signatureHeader = request.headers.get('stripe-signature') || '';
  const valid = await verifyStripeWebhookSignature(payloadText, signatureHeader, secret);
  if (!valid) {
    return { ok: false, status: 400, code: 'invalid_webhook_signature', error: 'Invalid Stripe webhook signature.' };
  }

  return { ok: true, event: JSON.parse(payloadText || '{}') };
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
    SELECT id, organization_id, subdomain, subdomain_status, website_status, trust_state, risk_score,
           suspended_reason, suspended_at, last_reviewed_at, name, email, phone, is_active, timezone
    FROM companies
    WHERE id = ?
    LIMIT 1
  `).bind(companyId).first();

  return company || null;
}

async function getPublishReviewById(env, reviewId) {
  if (!reviewId) return null;
  const review = await env.DB.prepare(`
    SELECT id, company_id, website_version_id, host, subdomain, decision, review_status, risk_score,
           reason_codes_json, evidence_json, payload_snapshot_json, reviewer_type, reviewer_id,
           review_note, created_at, updated_at
    FROM publish_reviews
    WHERE id = ?
    LIMIT 1
  `).bind(reviewId).first();
  return review || null;
}

async function getLatestWebsiteRelease(env, companyId) {
  if (!companyId) return null;
  const release = await env.DB.prepare(`
    SELECT id, company_id, review_id, release_status, publish_target, preview_url, published_url,
           payload_snapshot_json, reason_codes_json, release_note, reviewer_type, reviewer_id,
           published_at, suspended_at, created_at, updated_at
    FROM website_releases
    WHERE company_id = ?
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `).bind(companyId).first();
  return release || null;
}

async function getWebsiteReleaseHistory(env, companyId, limit = 8) {
  if (!companyId) return [];
  const result = await env.DB.prepare(`
    SELECT id, company_id, review_id, release_status, publish_target, preview_url, published_url,
           payload_snapshot_json, reason_codes_json, release_note, reviewer_type, reviewer_id,
           published_at, suspended_at, created_at, updated_at
    FROM website_releases
    WHERE company_id = ?
    ORDER BY updated_at DESC, created_at DESC
    LIMIT ?
  `).bind(companyId, Math.max(1, Number(limit || 8))).all();
  return result?.results || [];
}

async function getLatestPublishedWebsiteRelease(env, companyId) {
  if (!companyId) return null;
  const release = await env.DB.prepare(`
    SELECT id, company_id, review_id, release_status, publish_target, preview_url, published_url,
           payload_snapshot_json, reason_codes_json, release_note, reviewer_type, reviewer_id,
           published_at, suspended_at, created_at, updated_at
    FROM website_releases
    WHERE company_id = ? AND release_status = 'published'
    ORDER BY published_at DESC, updated_at DESC, created_at DESC
    LIMIT 1
  `).bind(companyId).first();
  return release || null;
}

async function getCustomDomainRequestHistory(env, companyId, limit = 12) {
  if (!companyId) return [];
  const result = await env.DB.prepare(`
    SELECT id, company_id, organization_id, requested_domain, registration_mode, request_status,
           dns_record_type, dns_name, dns_value, request_note, operator_note, renewal_mode,
           renewal_status, renewal_due_at, renewal_last_reminded_at, auto_renew_enabled,
           approved_at, approved_by, dns_ready_at, verified_at, activated_at, activated_by,
           last_health_check_at, last_health_check_status, last_health_check_note,
           rejected_at, rejected_by, created_at, updated_at
    FROM custom_domain_requests
    WHERE company_id = ?
    ORDER BY updated_at DESC, created_at DESC
    LIMIT ?
  `).bind(companyId, Math.max(1, Number(limit || 12))).all();
  return result?.results || [];
}

async function getLatestCustomDomainRequest(env, companyId) {
  const history = await getCustomDomainRequestHistory(env, companyId, 1);
  return history[0] || null;
}

async function getCustomDomainRequestById(env, requestId) {
  if (!requestId) return null;
  const request = await env.DB.prepare(`
    SELECT id, company_id, organization_id, requested_domain, registration_mode, request_status,
           dns_record_type, dns_name, dns_value, request_note, operator_note, renewal_mode,
           renewal_status, renewal_due_at, renewal_last_reminded_at, auto_renew_enabled,
           approved_at, approved_by, dns_ready_at, verified_at, activated_at, activated_by,
           last_health_check_at, last_health_check_status, last_health_check_note,
           rejected_at, rejected_by, created_at, updated_at
    FROM custom_domain_requests
    WHERE id = ?
    LIMIT 1
  `).bind(requestId).first();
  return request || null;
}

async function getCustomDomainRequestEvents(env, requestId, limit = 20) {
  if (!requestId) return [];
  const result = await env.DB.prepare(`
    SELECT id, request_id, company_id, event_type, request_status, actor_type, actor_id, note, metadata_json, created_at
    FROM custom_domain_request_events
    WHERE request_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(requestId, Math.max(1, Number(limit || 20))).all();
  return result?.results || [];
}

async function logCustomDomainRequestEvent(env, payload = {}) {
  const now = String(payload.createdAt || new Date().toISOString());
  await env.DB.prepare(`
    INSERT INTO custom_domain_request_events (
      id, request_id, company_id, event_type, request_status, actor_type, actor_id, note, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    payload.id || crypto.randomUUID(),
    String(payload.requestId || '').trim(),
    Number(payload.companyId || 0),
    String(payload.eventType || 'domain_event').trim(),
    String(payload.requestStatus || '').trim() || null,
    String(payload.actorType || '').trim() || null,
    String(payload.actorId || '').trim() || null,
    String(payload.note || '').trim() || null,
    payload.metadataJson ? JSON.stringify(payload.metadataJson) : null,
    now
  ).run();
}

function normalizeDnsHostnameValue(value) {
  return String(value || '').trim().toLowerCase().replace(/\.+$/, '');
}

function addDaysIso(value, days) {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString();
}

function computeRenewalTrackingForRequest(domainRequest) {
  const renewalMode = String(domainRequest?.renewal_mode || 'external').trim() || 'external';
  const persistedStatus = String(domainRequest?.renewal_status || '').trim() || 'external';
  const renewalDueAt = String(domainRequest?.renewal_due_at || '').trim();
  const now = Date.now();
  if (!renewalDueAt) {
    return {
      renewalMode,
      renewalStatus: persistedStatus === 'renewal_overdue' ? 'renewal_overdue' : (renewalMode === 'platform_managed' ? 'managed_active' : 'external'),
      reminderDue: false
    };
  }

  const dueTime = new Date(renewalDueAt).getTime();
  if (Number.isNaN(dueTime)) {
    return { renewalMode, renewalStatus: persistedStatus === 'renewal_overdue' ? 'renewal_overdue' : (renewalMode === 'platform_managed' ? 'managed_active' : 'external'), reminderDue: false };
  }

  const daysUntilDue = Math.ceil((dueTime - now) / 86400000);
  if (['renewal_overdue', 'transfer_out_requested', 'transferred_out'].includes(persistedStatus)) {
    return { renewalMode, renewalStatus: persistedStatus, reminderDue: true, daysUntilDue };
  }
  if (daysUntilDue < 0) {
    return { renewalMode, renewalStatus: 'renewal_overdue', reminderDue: true, daysUntilDue };
  }
  if (daysUntilDue <= 30) {
    return { renewalMode, renewalStatus: 'renewal_due_soon', reminderDue: true, daysUntilDue };
  }
  return { renewalMode, renewalStatus: renewalMode === 'platform_managed' ? 'managed_active' : 'external', reminderDue: false, daysUntilDue };
}

function annotateCustomDomainRequest(domainRequest) {
  if (!domainRequest || typeof domainRequest !== 'object') return domainRequest;
  return {
    ...domainRequest,
    ...computeRenewalTrackingForRequest(domainRequest)
  };
}

const DOMAIN_RENEWAL_REMINDER_THRESHOLDS = [30, 14, 7, 1, -1, -7];

function getDomainRenewalReminderEventType(daysUntilDue) {
  if (daysUntilDue >= 0) return `renewal_reminder_${daysUntilDue}d`;
  return `renewal_overdue_${Math.abs(daysUntilDue)}d`;
}

function getApplicableRenewalReminderThreshold(daysUntilDue) {
  for (const threshold of DOMAIN_RENEWAL_REMINDER_THRESHOLDS) {
    if (daysUntilDue === threshold) return threshold;
  }
  return null;
}

async function hasCustomDomainRequestEvent(env, requestId, eventType) {
  const row = await env.DB.prepare(
    `SELECT id FROM custom_domain_request_events WHERE request_id = ? AND event_type = ? LIMIT 1`
  ).bind(requestId, eventType).first();
  return !!row?.id;
}

async function processManagedDomainRenewalReminders(env, options = {}) {
  const dryRun = !!options.dryRun;
  const actorId = String(options.actorId || 'system-renewal-job').trim();
  const sendDigest = options.sendDigest !== false;
  const result = await env.DB.prepare(`
    SELECT id, company_id, organization_id, requested_domain, registration_mode, request_status,
           dns_record_type, dns_name, dns_value, request_note, operator_note, renewal_mode,
           renewal_status, renewal_due_at, renewal_last_reminded_at, auto_renew_enabled,
           approved_at, approved_by, dns_ready_at, verified_at, activated_at, activated_by,
           last_health_check_at, last_health_check_status, last_health_check_note,
           rejected_at, rejected_by, created_at, updated_at
    FROM custom_domain_requests
    WHERE request_status = 'active' AND renewal_mode = 'platform_managed'
    ORDER BY renewal_due_at ASC, updated_at DESC
  `).all();

  const requests = (result?.results || []).map((item) => annotateCustomDomainRequest(item));
  const summary = {
    scanned: requests.length,
    reminded: 0,
    updated: 0,
    skipped: 0,
    dryRun,
    reminders: [],
    digest: null
  };

  for (const request of requests) {
    const daysUntilDue = Number(request.daysUntilDue);
    const renewalStatus = String(request.renewalStatus || request.renewal_status || 'managed_active');
    const shouldUpdateStatus = renewalStatus !== String(request.renewal_status || '').trim();
    const threshold = Number.isFinite(daysUntilDue) ? getApplicableRenewalReminderThreshold(daysUntilDue) : null;

    if (shouldUpdateStatus && !dryRun) {
      await updateCustomDomainRequestState(env, request.id, {
        renewalStatus,
        actorType: 'system',
        actorId,
        eventType: 'renewal_status_recomputed',
        eventNote: `Renewal status recomputed to ${renewalStatus}.`
      });
      summary.updated += 1;
    }

    if (threshold === null) {
      summary.skipped += 1;
      continue;
    }

    const eventType = getDomainRenewalReminderEventType(threshold);
    const alreadySent = await hasCustomDomainRequestEvent(env, request.id, eventType);
    if (alreadySent) {
      summary.skipped += 1;
      continue;
    }

    const note = threshold >= 0
      ? `Managed domain renewal is due in ${threshold} day(s).`
      : `Managed domain renewal is overdue by ${Math.abs(threshold)} day(s).`;

    if (!dryRun) {
      await updateCustomDomainRequestState(env, request.id, {
        renewalStatus,
        renewalLastRemindedAt: new Date().toISOString(),
        actorType: 'system',
        actorId,
        eventType,
        eventNote: note,
        metadataJson: {
          daysUntilDue,
          renewalDueAt: request.renewal_due_at || null,
          autoRenewEnabled: Number(request.auto_renew_enabled || 0)
        }
      });
    }

    summary.reminded += 1;
    summary.reminders.push({
      requestId: request.id,
      companyId: Number(request.company_id || 0),
      requestedDomain: request.requested_domain,
      eventType,
      daysUntilDue,
      renewalStatus
    });
  }

  if (!dryRun && sendDigest) {
    summary.digest = await sendManagedDomainRenewalDigest(env, { summary });
  }

  return summary;
}

async function runCustomDomainActivationHealthCheck(env, domainRequest) {
  const requestedDomain = normalizeCustomDomainHostname(domainRequest?.requested_domain || '');
  const healthCheckMode = String(env?.CUSTOM_DOMAIN_ACTIVATION_HEALTHCHECK_MODE || '').trim().toLowerCase();
  if (!requestedDomain) {
    return { ok: false, status: 'failed', note: 'Missing domain for activation health check.' };
  }
  if (healthCheckMode === 'mock') {
    return {
      ok: true,
      status: 'healthy',
      note: 'Mock activation health check passed for health and website payload endpoints.',
      checks: {
        health: { ok: true, status: 200 },
        payload: { ok: true, status: 200, companyId: Number(domainRequest?.company_id || 0) }
      }
    };
  }

  try {
    const [healthResponse, payloadResponse] = await Promise.all([
      fetch(`https://${requestedDomain}/api/health`),
      fetch(`https://${requestedDomain}/api/website/payload`)
    ]);
    if (!healthResponse.ok) {
      return { ok: false, status: 'unhealthy', note: `Health check returned HTTP ${healthResponse.status}.` };
    }
    const healthBody = await healthResponse.json().catch(() => null);
    if (!healthBody?.ok) {
      return { ok: false, status: 'unhealthy', note: 'Health payload did not report ok=true.' };
    }

    if (!payloadResponse.ok) {
      return { ok: false, status: 'unhealthy', note: `Website payload check returned HTTP ${payloadResponse.status}.` };
    }
    const payloadBody = await payloadResponse.json().catch(() => null);
    if (!payloadBody?.ok || Number(payloadBody?.companyId || 0) !== Number(domainRequest?.company_id || 0)) {
      return { ok: false, status: 'unhealthy', note: 'Website payload did not resolve the expected tenant company.' };
    }

    return {
      ok: true,
      status: 'healthy',
      note: 'Activation health check passed for health and website payload endpoints.',
      checks: {
        health: { ok: true, status: healthResponse.status },
        payload: { ok: true, status: payloadResponse.status, companyId: Number(payloadBody.companyId || 0) }
      }
    };
  } catch (error) {
    return { ok: false, status: 'unreachable', note: error.message || 'Activation health check failed.' };
  }
}

async function verifyCustomDomainDns(env, domainRequest) {
  const requestedDomain = normalizeCustomDomainHostname(domainRequest?.requested_domain || '');
  const expectedTarget = normalizeDnsHostnameValue(domainRequest?.dns_value || '');
  const verifyMode = String(env?.CUSTOM_DOMAIN_DNS_VERIFY_MODE || '').trim().toLowerCase();

  if (!requestedDomain || !expectedTarget) {
    return { ok: false, code: 'dns_verification_unavailable', error: 'DNS verification data is incomplete.' };
  }

  if (verifyMode === 'mock') {
    return {
      ok: true,
      matched: true,
      dnsAnswers: [{ name: requestedDomain, type: 'CNAME', data: expectedTarget }],
      expectedTarget
    };
  }

  const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(requestedDomain)}&type=CNAME`, {
    headers: {
      accept: 'application/dns-json'
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, code: 'dns_lookup_failed', error: 'Unable to verify DNS right now.' };
  }

  const answers = Array.isArray(data?.Answer) ? data.Answer : [];
  const normalizedAnswers = answers.map((answer) => ({
    name: normalizeDnsHostnameValue(answer?.name || requestedDomain),
    type: Number(answer?.type || 0) === 5 ? 'CNAME' : String(answer?.type || ''),
    data: normalizeDnsHostnameValue(answer?.data || '')
  }));
  const matched = normalizedAnswers.some((answer) => answer.type === 'CNAME' && answer.data === expectedTarget);

  if (!matched) {
    return {
      ok: false,
      code: 'dns_record_mismatch',
      error: `Expected ${requestedDomain} to CNAME to ${expectedTarget}.`,
      expectedTarget,
      dnsAnswers: normalizedAnswers
    };
  }

  return {
    ok: true,
    matched: true,
    expectedTarget,
    dnsAnswers: normalizedAnswers
  };
}

async function createCustomDomainUpgradeRequest(env, payload = {}) {
  const companyId = Number(payload.companyId || 0);
  const company = payload.company || await getCompanyProfile(env, companyId);
  const requestedDomain = normalizeCustomDomainHostname(payload.requestedDomain || '');
  const registrationMode = ['byod', 'managed_registration'].includes(String(payload.registrationMode || '').trim())
    ? String(payload.registrationMode || '').trim()
    : 'byod';
  const requestNote = String(payload.requestNote || '').trim();

  if (!companyId || !company?.id) {
    return { ok: false, status: 404, code: 'company_not_found', error: 'Company not found.' };
  }

  if (!isValidCustomDomainHostname(requestedDomain)) {
    return {
      ok: false,
      status: 400,
      code: 'invalid_custom_domain',
      error: 'Use a hostname like www.example.com for the current CNAME-based custom-domain MVP.'
    };
  }

  const openRequest = await env.DB.prepare(`
    SELECT id, request_status
    FROM custom_domain_requests
    WHERE company_id = ? AND request_status IN ('requested', 'approved_waiting_dns', 'verification_pending', 'verified_waiting_activation')
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `).bind(companyId).first();
  if (openRequest?.id) {
    return { ok: false, status: 409, code: 'domain_request_already_open', error: 'There is already an open custom-domain request for this tenant.' };
  }

  const dnsTarget = buildCustomDomainDnsTarget(company);
  const now = new Date().toISOString();
  const requestId = crypto.randomUUID();
  const renewalDueAt = registrationMode === 'managed_registration' ? addDaysIso(now, 365) : null;
  await env.DB.prepare(`
    INSERT INTO custom_domain_requests (
      id, company_id, organization_id, requested_domain, registration_mode, request_status,
      dns_record_type, dns_name, dns_value, request_note, renewal_mode, renewal_status, renewal_due_at, auto_renew_enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'requested', 'CNAME', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    requestId,
    companyId,
    company.organization_id || null,
    requestedDomain,
    registrationMode,
    requestedDomain,
    dnsTarget,
    requestNote,
    registrationMode === 'managed_registration' ? 'platform_managed' : 'external',
    registrationMode === 'managed_registration' ? 'managed_active' : 'external',
    renewalDueAt,
    registrationMode === 'managed_registration' ? 1 : 0,
    now,
    now
  ).run();

  await logCustomDomainRequestEvent(env, {
    requestId,
    companyId,
    eventType: 'request_created',
    requestStatus: 'requested',
    actorType: 'tenant_admin',
    actorId: String(payload.actorId || 'tenant-admin'),
    note: requestNote || 'Custom-domain upgrade requested.',
    metadataJson: {
      requestedDomain,
      registrationMode,
      dnsTarget
    }
  });

  return { ok: true, request: await getCustomDomainRequestById(env, requestId) };
}

async function updateCustomDomainRequestState(env, requestId, updates = {}) {
  const existing = await getCustomDomainRequestById(env, requestId);
  if (!existing) return null;

  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE custom_domain_requests
    SET request_status = ?,
        operator_note = ?,
        renewal_status = ?,
        renewal_due_at = ?,
        renewal_last_reminded_at = ?,
        auto_renew_enabled = ?,
        approved_at = ?,
        approved_by = ?,
        dns_ready_at = ?,
        verified_at = ?,
        activated_at = ?,
        activated_by = ?,
        last_health_check_at = ?,
        last_health_check_status = ?,
        last_health_check_note = ?,
        rejected_at = ?,
        rejected_by = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(
    updates.requestStatus ?? existing.request_status,
    updates.operatorNote ?? existing.operator_note ?? null,
    updates.renewalStatus ?? existing.renewal_status ?? null,
    updates.renewalDueAt ?? existing.renewal_due_at ?? null,
    updates.renewalLastRemindedAt ?? existing.renewal_last_reminded_at ?? null,
    typeof updates.autoRenewEnabled === 'number' || typeof updates.autoRenewEnabled === 'boolean' ? Number(updates.autoRenewEnabled) : (existing.auto_renew_enabled ?? null),
    updates.approvedAt ?? existing.approved_at ?? null,
    updates.approvedBy ?? existing.approved_by ?? null,
    updates.dnsReadyAt ?? existing.dns_ready_at ?? null,
    updates.verifiedAt ?? existing.verified_at ?? null,
    updates.activatedAt ?? existing.activated_at ?? null,
    updates.activatedBy ?? existing.activated_by ?? null,
    updates.lastHealthCheckAt ?? existing.last_health_check_at ?? null,
    updates.lastHealthCheckStatus ?? existing.last_health_check_status ?? null,
    updates.lastHealthCheckNote ?? existing.last_health_check_note ?? null,
    updates.rejectedAt ?? existing.rejected_at ?? null,
    updates.rejectedBy ?? existing.rejected_by ?? null,
    now,
    requestId
  ).run();

  const nextRequest = await getCustomDomainRequestById(env, requestId);
  await logCustomDomainRequestEvent(env, {
    requestId,
    companyId: Number(existing.company_id || 0),
    eventType: String(updates.eventType || 'status_updated').trim(),
    requestStatus: String((updates.requestStatus ?? nextRequest?.request_status ?? existing.request_status) || '').trim(),
    actorType: String(updates.actorType || 'system').trim(),
    actorId: String(updates.actorId || '').trim(),
    note: String(updates.eventNote || updates.operatorNote || '').trim(),
    metadataJson: updates.metadataJson || null
  });

  return nextRequest;
}

function parseWebsiteReleaseSnapshot(release) {
  try {
    const parsed = JSON.parse(String(release?.payload_snapshot_json || ''));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function getGoLiveReadiness(env, companyId, context = {}) {
  const company = context.company || await getCompanyProfile(env, companyId);
  const operationalSettings = context.operationalSettings || await getOperationalSettingsMap(env, companyId);
  const websiteRelease = context.websiteRelease || await getLatestWebsiteRelease(env, companyId);
  const activeStaffRow = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM staff WHERE company_id = ? AND is_active = 1`
  ).bind(companyId).first();

  const normalizeScheduleTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '').trim());
  const schedule = (() => {
    try {
      const parsed = JSON.parse(String(operationalSettings.business_hours_schedule_json || ''));
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      // Ignore invalid JSON and fall back to legacy open/close values.
    }

    const fallbackOpen = String(operationalSettings.business_hours_open || '').trim();
    const fallbackClose = String(operationalSettings.business_hours_close || '').trim();
    if (!normalizeScheduleTime(fallbackOpen) || !normalizeScheduleTime(fallbackClose)) return [];

    return ['1', '2', '3', '4', '5', '6', '0'].map((day) => ({
      day,
      closed: String(operationalSettings.closed_weekday || '').trim() === day,
      open: fallbackOpen,
      close: fallbackClose
    }));
  })();

  const hasOpeningHours = schedule.some((row) => row?.closed !== true && normalizeScheduleTime(row?.open) && normalizeScheduleTime(row?.close));
  const hasCapacity = ['area_capacity_indoor', 'area_capacity_outdoor', 'area_capacity_garden', 'area_capacity_bar']
    .some((key) => Number(operationalSettings[key] || 0) > 0);
  const activeStaffCount = Number(activeStaffRow?.count || 0);
  const bookingEmail = String(operationalSettings.booking_email || company?.email || '').trim();
  const hostTarget = buildPublishedWebsiteUrlForCompany(company, operationalSettings);
  const stripeAccountId = String(operationalSettings.stripe_account_id || '').trim();
  const acceptedPaymentMethods = parseAcceptedPaymentMethods(operationalSettings.accepted_payment_methods_json);
  const paymentStatus = String(operationalSettings.demo_payment_status || '').trim().toLowerCase();
  const demoPaymentMethod = normalizeDemoPaymentMethod(operationalSettings.demo_payment_method || paymentStatus || 'bankcard');
  const releaseStatus = String(websiteRelease?.release_status || '').trim().toLowerCase();

  const items = [
    {
      key: 'restaurant_identity',
      section: 'Restaurant profile',
      label: 'Restaurant identity',
      ok: !!String(company?.name || '').trim(),
      detail: String(company?.name || '').trim() ? 'Restaurant name saved.' : 'Restaurant name is still missing.',
      required: true,
      requiredForPublish: true,
      requiredForGoLive: true,
      targetPage: 'settings',
      targetSection: 'settings-company-profile',
      actionLabel: 'Open restaurant profile'
    },
    {
      key: 'contact_email',
      section: 'Restaurant profile',
      label: 'Contact email',
      ok: !!String(company?.email || '').trim(),
      detail: String(company?.email || '').trim() ? 'Public contact email saved.' : 'Company email is still missing.',
      required: true,
      requiredForPublish: true,
      requiredForGoLive: true,
      targetPage: 'settings',
      targetSection: 'settings-company-profile',
      actionLabel: 'Open restaurant profile'
    },
    {
      key: 'contact_phone',
      section: 'Restaurant profile',
      label: 'Contact phone',
      ok: !!String(company?.phone || '').trim(),
      detail: String(company?.phone || '').trim() ? 'Public contact phone saved.' : 'Company phone is still missing.',
      required: true,
      requiredForPublish: true,
      requiredForGoLive: true,
      targetPage: 'settings',
      targetSection: 'settings-company-profile',
      actionLabel: 'Open restaurant profile'
    },
    {
      key: 'booking_email',
      section: 'Restaurant profile',
      label: 'Booking inbox',
      ok: !!bookingEmail,
      detail: bookingEmail ? `Booking notices go to ${bookingEmail}.` : 'Booking email is still missing.',
      required: true,
      requiredForPublish: true,
      requiredForGoLive: true,
      targetPage: 'settings',
      targetSection: 'settings-company-profile',
      actionLabel: 'Open restaurant profile'
    },
    {
      key: 'opening_hours',
      section: 'Operations',
      label: 'Opening hours',
      ok: hasOpeningHours,
      detail: hasOpeningHours ? 'Structured opening hours exist for at least one open day.' : 'Opening hours need at least one valid open day.',
      required: true,
      requiredForPublish: true,
      requiredForGoLive: true,
      targetPage: 'settings',
      targetSection: 'settings-website-content',
      actionLabel: 'Open website content'
    },
    {
      key: 'area_capacity',
      section: 'Operations',
      label: 'Area capacities',
      ok: hasCapacity,
      detail: hasCapacity ? 'At least one seating area capacity is configured.' : 'At least one seating area capacity should be configured.',
      required: true,
      requiredForPublish: false,
      requiredForGoLive: true,
      targetPage: 'settings',
      targetSection: 'settings-operations-capacity',
      actionLabel: 'Open operations settings'
    },
    {
      key: 'staff_setup',
      section: 'Staff',
      label: 'Staff PIN setup',
      ok: activeStaffCount > 0,
      detail: activeStaffCount > 0 ? `${activeStaffCount} active staff account(s) exist.` : 'No active staff accounts exist yet.',
      required: true,
      requiredForPublish: false,
      requiredForGoLive: true,
      targetPage: 'settings',
      targetSection: 'settings-staff-management',
      actionLabel: 'Open staff management'
    },
    {
      key: 'public_host',
      section: 'Go live',
      label: 'Public host target',
      ok: !!hostTarget,
      detail: hostTarget ? `Public host target: ${hostTarget}` : 'Set a tenant subdomain, custom domain, or website URL.',
      required: true,
      requiredForPublish: false,
      requiredForGoLive: true,
      targetPage: 'settings',
      targetSection: 'settings-domain-upgrade',
      actionLabel: 'Open domain settings'
    },
    {
      key: 'payment_setup',
      section: 'Payments',
      label: 'Payment setup',
      ok: !!stripeAccountId || acceptedPaymentMethods.length > 0,
      detail: stripeAccountId
        ? `Stripe account linked: ${stripeAccountId}`
        : acceptedPaymentMethods.length > 0
          ? `Configured methods: ${acceptedPaymentMethods.join(', ')}. Demo signup method: ${demoPaymentMethod}.`
          : paymentStatus === 'demo_paid'
            ? 'Only demo payment is configured. Select at least one payment method or link Stripe.'
            : 'Stripe account is not linked yet.',
      required: true,
      requiredForPublish: false,
      requiredForGoLive: true,
      targetPage: 'settings',
      targetSection: 'settings-payment-billing',
      actionLabel: 'Open payments & billing'
    },
    {
      key: 'publish_status',
      section: 'Go live',
      label: 'Publish status',
      ok: releaseStatus === 'published',
      detail: releaseStatus === 'published'
        ? 'Latest release is already published.'
        : releaseStatus === 'pending_review'
          ? 'Latest release is waiting for operator approval.'
          : 'Run publish review and complete operator approval.',
      required: true,
      requiredForPublish: false,
      requiredForGoLive: true,
      targetPage: 'settings',
      targetSection: 'settings-website-release',
      actionLabel: 'Open website release'
    }
  ];

  const publishRequiredItems = items.filter((item) => item.requiredForPublish);
  const goLiveRequiredItems = items.filter((item) => item.requiredForGoLive);
  const publishPassedRequired = publishRequiredItems.filter((item) => item.ok).length;
  const goLivePassedRequired = goLiveRequiredItems.filter((item) => item.ok).length;

  return {
    ready: goLiveRequiredItems.every((item) => item.ok),
    publishReady: publishRequiredItems.every((item) => item.ok),
    publishPassedRequired,
    publishTotalRequired: publishRequiredItems.length,
    publishSummary: `${publishPassedRequired}/${publishRequiredItems.length} required publish checks passed.`,
    goLiveReady: goLiveRequiredItems.every((item) => item.ok),
    goLivePassedRequired,
    goLiveTotalRequired: goLiveRequiredItems.length,
    goLiveSummary: `${goLivePassedRequired}/${goLiveRequiredItems.length} required go-live checks passed.`,
    passed_required: goLivePassedRequired,
    total_required: goLiveRequiredItems.length,
    items,
    summary: `${goLivePassedRequired}/${goLiveRequiredItems.length} required go-live checks passed.`
  };
}

async function createWebsiteRelease(env, payload = {}) {
  const now = new Date().toISOString();
  const companyId = Number(payload.companyId || 0);
  const releaseId = payload.id || crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO website_releases (
      id, company_id, review_id, release_status, publish_target, preview_url, published_url,
      payload_snapshot_json, reason_codes_json, release_note, reviewer_type, reviewer_id,
      published_at, suspended_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    releaseId,
    companyId,
    payload.reviewId || null,
    String(payload.releaseStatus || 'draft').trim(),
    String(payload.publishTarget || 'managed_subdomain').trim(),
    String(payload.previewUrl || '').trim(),
    String(payload.publishedUrl || '').trim(),
    payload.payloadSnapshotJson || null,
    JSON.stringify(Array.isArray(payload.reasonCodes) ? payload.reasonCodes : []),
    String(payload.releaseNote || '').trim(),
    payload.reviewerType || null,
    payload.reviewerId || null,
    payload.publishedAt || null,
    payload.suspendedAt || null,
    now,
    now
  ).run();

  return getLatestWebsiteRelease(env, companyId);
}

async function updateWebsiteReleaseByReviewId(env, reviewId, updates = {}) {
  if (!reviewId) return null;
  const existing = await env.DB.prepare(`
    SELECT id, company_id, release_status, publish_target, preview_url, published_url,
           payload_snapshot_json, reason_codes_json, release_note, reviewer_type, reviewer_id,
           published_at, suspended_at
    FROM website_releases
    WHERE review_id = ?
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `).bind(reviewId).first();

  if (!existing) return null;

  const existingReasonCodes = (() => {
    try {
      const parsed = JSON.parse(String(existing.reason_codes_json || '[]'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    UPDATE website_releases
    SET release_status = ?,
        publish_target = ?,
        preview_url = ?,
        published_url = ?,
        payload_snapshot_json = ?,
        reason_codes_json = ?,
        release_note = ?,
        reviewer_type = ?,
        reviewer_id = ?,
        published_at = ?,
        suspended_at = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(
    updates.releaseStatus ?? existing.release_status,
    updates.publishTarget ?? existing.publish_target,
    updates.previewUrl ?? existing.preview_url,
    updates.publishedUrl ?? existing.published_url,
    updates.payloadSnapshotJson ?? existing.payload_snapshot_json,
    JSON.stringify(Array.isArray(updates.reasonCodes) ? updates.reasonCodes : existingReasonCodes),
    updates.releaseNote ?? existing.release_note,
    updates.reviewerType ?? existing.reviewer_type,
    updates.reviewerId ?? existing.reviewer_id,
    updates.publishedAt ?? existing.published_at,
    updates.suspendedAt ?? existing.suspended_at,
    now,
    existing.id
  ).run();

  return getLatestWebsiteRelease(env, Number(existing.company_id || 0));
}

async function updateLatestWebsiteReleaseForCompany(env, companyId, updates = {}) {
  const existing = await getLatestWebsiteRelease(env, companyId);
  if (!existing) return null;

  const existingReasonCodes = (() => {
    try {
      const parsed = JSON.parse(String(existing.reason_codes_json || '[]'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    UPDATE website_releases
    SET release_status = ?,
        publish_target = ?,
        preview_url = ?,
        published_url = ?,
        payload_snapshot_json = ?,
        reason_codes_json = ?,
        release_note = ?,
        reviewer_type = ?,
        reviewer_id = ?,
        published_at = ?,
        suspended_at = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(
    updates.releaseStatus ?? existing.release_status,
    updates.publishTarget ?? existing.publish_target,
    updates.previewUrl ?? existing.preview_url,
    updates.publishedUrl ?? existing.published_url,
    updates.payloadSnapshotJson ?? existing.payload_snapshot_json,
    JSON.stringify(Array.isArray(updates.reasonCodes) ? updates.reasonCodes : existingReasonCodes),
    updates.releaseNote ?? existing.release_note,
    updates.reviewerType ?? existing.reviewer_type,
    updates.reviewerId ?? existing.reviewer_id,
    updates.publishedAt ?? existing.published_at,
    updates.suspendedAt ?? existing.suspended_at,
    now,
    existing.id
  ).run();

  return getLatestWebsiteRelease(env, companyId);
}

async function updateCompanyWebsiteState(env, companyId, updates = {}) {
  const company = await getCompanyProfile(env, companyId);
  if (!company) return false;

  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE companies
    SET website_status = ?,
        trust_state = ?,
        risk_score = ?,
        suspended_reason = ?,
        suspended_at = ?,
        last_reviewed_at = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(
    updates.websiteStatus ?? company.website_status ?? 'draft',
    updates.trustState ?? company.trust_state ?? 'pending_verification',
    updates.riskScore ?? company.risk_score ?? 0,
    updates.suspendedReason ?? company.suspended_reason ?? null,
    updates.suspendedAt ?? company.suspended_at ?? null,
    updates.lastReviewedAt ?? company.last_reviewed_at ?? now,
    now,
    companyId
  ).run();

  return true;
}

async function updateCompanySubdomainState(env, companyId, subdomainStatus) {
  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE companies
    SET subdomain_status = ?, updated_at = ?
    WHERE id = ?
  `).bind(subdomainStatus, now, companyId).run();
}

async function updatePublishReviewDecision(env, reviewId, updates = {}) {
  const review = await getPublishReviewById(env, reviewId);
  if (!review) return null;

  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE publish_reviews
    SET decision = ?,
        review_status = ?,
        reviewer_type = ?,
        reviewer_id = ?,
        review_note = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(
    updates.decision ?? review.decision,
    updates.reviewStatus ?? review.review_status,
    updates.reviewerType ?? review.reviewer_type ?? 'operator',
    updates.reviewerId ?? review.reviewer_id ?? null,
    updates.reviewNote ?? review.review_note ?? null,
    now,
    reviewId
  ).run();

  return getPublishReviewById(env, reviewId);
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
  const [organization, operationalSettings, modules, websiteRelease, websiteReleaseHistory, platformPricingSettings, customDomainRequestHistory] = await Promise.all([
    getOrganizationProfile(env, company?.organization_id || null),
    getOperationalSettingsMap(env, companyId),
    getModuleSettingsMap(env, companyId),
    getLatestWebsiteRelease(env, companyId),
    getWebsiteReleaseHistory(env, companyId),
    getPlatformMarketingSettings(env),
    getCustomDomainRequestHistory(env, companyId)
  ]);
  const goLiveReadiness = await getGoLiveReadiness(env, companyId, {
    company,
    operationalSettings,
    websiteRelease
  });
  const normalizedCustomDomainRequestHistory = customDomainRequestHistory.map((item) => annotateCustomDomainRequest(item));
  const customDomainRequestEvents = normalizedCustomDomainRequestHistory[0]?.id
    ? await getCustomDomainRequestEvents(env, normalizedCustomDomainRequestHistory[0].id)
    : [];

  return {
    organization,
    company,
    operationalSettings,
    modules,
    websiteRelease,
    websiteReleaseHistory,
    customDomainRequest: normalizedCustomDomainRequestHistory[0] || null,
    customDomainRequestHistory: normalizedCustomDomainRequestHistory,
    customDomainRequestEvents,
    paymentMethodPolicy: buildPaymentMethodPolicy(platformPricingSettings),
    goLiveReadiness
  };
}

async function resolveWebsitePayloadForRequest(env, companyId, currentUrl) {
  const hasExplicitPreviewOverride = String(currentUrl?.searchParams?.get('company_id') || '').trim().length > 0;
  if (!hasExplicitPreviewOverride) {
    const release = await getLatestPublishedWebsiteRelease(env, companyId);
    const snapshot = parseWebsiteReleaseSnapshot(release);
    if (snapshot) return snapshot;
  }

  return buildPublicWebsitePayload(env, companyId, currentUrl);
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
    contactButton: 'Contact',
    reserveButton: 'Reserve'
  };
}

function getDefaultWebsiteSecondaryItems(language) {
  if (language === 'de') {
    return [
      { page: 'about', label: 'Haus & Geschichte' },
      { page: 'menu', label: 'Speisekarten' },
      { page: 'career', label: 'Arbeiten mit uns' },
      { page: 'contact', label: 'Kontakt' }
    ];
  }

  return [
    { page: 'about', label: 'House Story' },
    { page: 'menu', label: 'Menus' },
    { page: 'career', label: 'Work With Us' },
    { page: 'contact', label: 'Contact' }
  ];
}

async function getActiveWebsiteMediaAssets(env, companyId) {
  const result = await env.DB.prepare(`
    SELECT id, title, alt_text, data_url, tags
    FROM media_assets
    WHERE company_id = ? AND is_active = 1
    ORDER BY updated_at DESC
    LIMIT 200
  `).bind(companyId).all();

  return (result.results || []).map((row) => ({
    id: String(row.id || '').trim(),
    title: String(row.title || '').trim(),
    altText: String(row.alt_text || '').trim(),
    dataUrl: String(row.data_url || '').trim(),
    tags: (() => {
      try {
        const parsed = JSON.parse(String(row.tags || '[]'));
        return Array.isArray(parsed)
          ? parsed.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
          : [];
      } catch {
        return [];
      }
    })()
  })).filter((asset) => asset.dataUrl);
}

function findMediaAssetDataUrlByTags(assets, tags) {
  const normalizedTags = (tags || []).map((tag) => String(tag || '').trim().toLowerCase()).filter(Boolean);
  if (!normalizedTags.length) return '';
  const match = (assets || []).find((asset) => normalizedTags.some((tag) => asset.tags.includes(tag)));
  return match?.dataUrl || '';
}

function buildWebsiteMediaSlots(assets) {
  return {
    logo_image: findMediaAssetDataUrlByTags(assets, ['logo', 'brand-logo']),
    hero_image: findMediaAssetDataUrlByTags(assets, ['hero', 'home-hero']),
    team_image: findMediaAssetDataUrlByTags(assets, ['team', 'about-team']),
    journal_feature_image: findMediaAssetDataUrlByTags(assets, ['journal-feature', 'feature-food']),
    location_images: [
      findMediaAssetDataUrlByTags(assets, ['location-1', 'berlin']),
      findMediaAssetDataUrlByTags(assets, ['location-2', 'munich']),
      findMediaAssetDataUrlByTags(assets, ['location-3', 'konstanz'])
    ],
    journal_images: [
      findMediaAssetDataUrlByTags(assets, ['journal-1']),
      findMediaAssetDataUrlByTags(assets, ['journal-2']),
      findMediaAssetDataUrlByTags(assets, ['journal-3'])
    ],
    menu_images: [
      findMediaAssetDataUrlByTags(assets, ['menu-1']),
      findMediaAssetDataUrlByTags(assets, ['menu-2']),
      findMediaAssetDataUrlByTags(assets, ['menu-3'])
    ]
  };
}

function getWebsiteThemePreviewProfile(theme) {
  const normalizedTheme = normalizeWebsiteThemeVariant(theme, WEBSITE_BUILDER_DEFAULTS.site_template);
  return WEBSITE_THEME_PREVIEW_PROFILES[normalizedTheme] || null;
}

async function buildPublicWebsitePayload(env, companyId, currentUrl) {
  const [{ company, operationalSettings, modules }, assets] = await Promise.all([
    getAdminPlatformConfig(env, companyId),
    getActiveWebsiteMediaAssets(env, companyId)
  ]);

  const settings = operationalSettings || {};
  const brandingOverrides = safeParseJsonObject(settings.site_branding_json);
  const navigationOverrides = safeParseJsonObject(settings.site_navigation_json);
  const contentOverrides = safeParseJsonObject(settings.site_content_json);
  const careerOverrides = safeParseJsonObject(settings.site_career_json);
  const requestedPreviewTheme = String(currentUrl?.searchParams?.get('theme') || '').trim();
  const theme = normalizeWebsiteThemeVariant(requestedPreviewTheme || settings.site_theme_variant || settings.site_template, settings.site_template);
  const language = normalizeWebsiteLanguage(settings.site_language || brandingOverrides.language_code);
  const themePreset = String(requestedPreviewTheme || settings.site_content_preset || theme).trim() || theme;
  const previewProfile = requestedPreviewTheme ? getWebsiteThemePreviewProfile(theme) : null;
  const mediaSlots = buildWebsiteMediaSlots(assets);
  const defaultLabels = getDefaultWebsiteLabels(language);
  const websiteUrl = String(settings.website_url || currentUrl?.origin || '').trim();
  const contactAddress = String(previewProfile?.company?.address || settings.site_contact_address || '').trim() || '27 Alder Quay, Berlin 10407';
  const fallbackEmail = String(previewProfile?.company?.email || settings.booking_email || company?.email || '').trim() || 'hello@example.com';
  const fallbackPhone = String(previewProfile?.company?.phone || company?.phone || '').trim() || '+49 30 5550 2100';
  const openingHoursSchedule = (() => {
    const normalizeScheduleTime = (value) => {
      const normalized = String(value || '').trim();
      return /^([01]\d|2[0-3]):[0-5]\d$/.test(normalized) ? normalized : '';
    };
    const orderedDays = ['1', '2', '3', '4', '5', '6', '0'];
    const fallbackOpen = normalizeScheduleTime(settings.business_hours_open);
    const fallbackClose = normalizeScheduleTime(settings.business_hours_close);
    const fallbackClosedWeekday = String(settings.closed_weekday || '').trim();
    const fallbackSchedule = orderedDays.map((day) => {
      const isClosed = fallbackClosedWeekday == day;
      return {
        day,
        closed: isClosed,
        open: isClosed ? '' : fallbackOpen,
        close: isClosed ? '' : fallbackClose
      };
    });

    try {
      const parsed = JSON.parse(String(settings.business_hours_schedule_json || ''));
      if (!Array.isArray(parsed) || !parsed.length) return fallbackSchedule;
      const parsedMap = new Map(parsed.map((row) => [String(row?.day || '').trim(), row]));
      return fallbackSchedule.map((row) => {
        const next = parsedMap.get(row.day);
        if (!next) return row;
        const closed = next?.closed === true;
        return {
          day: row.day,
          closed,
          open: closed ? '' : (normalizeScheduleTime(next?.open) || row.open),
          close: closed ? '' : (normalizeScheduleTime(next?.close) || row.close)
        };
      });
    } catch {
      return fallbackSchedule;
    }
  })();

  const content = {
    ...(contentOverrides || {})
  };

  if (!content.logo_image && mediaSlots.logo_image) content.logo_image = mediaSlots.logo_image;
  if (!content.hero_image && mediaSlots.hero_image) content.hero_image = mediaSlots.hero_image;
  if (!content.team_image && mediaSlots.team_image) content.team_image = mediaSlots.team_image;
  if (!content.journal_feature_image && mediaSlots.journal_feature_image) content.journal_feature_image = mediaSlots.journal_feature_image;

  if (Array.isArray(content.location_cards)) {
    content.location_cards = content.location_cards.map((card, index) => ({
      ...card,
      image: String(card?.image || '').trim() || mediaSlots.location_images[index] || ''
    }));
  }

  if (Array.isArray(content.journal_cards)) {
    content.journal_cards = content.journal_cards.map((card, index) => ({
      ...card,
      image: String(card?.image || '').trim() || mediaSlots.journal_images[index] || ''
    }));
  }

  if (Array.isArray(content.menu_link_cards)) {
    content.menu_link_cards = content.menu_link_cards.map((card, index) => ({
      ...card,
      image: String(card?.image || '').trim() || mediaSlots.menu_images[index] || ''
    }));
  }

  const navigationLabels = navigationOverrides?.labels && typeof navigationOverrides.labels === 'object'
    ? navigationOverrides.labels
    : {};
  const companyIdText = String(companyId || '').trim();

  return {
    tenant: {
      id: String(company?.subdomain || `tenant-${companyIdText}`).trim(),
      company_id: Number(companyId),
      theme,
      tier: inferWebsiteTierFromModules(modules),
      content_preset: themePreset
    },
    theme_presets_url: '/website-master/theme-presets.example.json',
    company: {
      name: String(previewProfile?.company?.name || company?.name || 'North & Mercer House').trim(),
      city: String(brandingOverrides.city || previewProfile?.company?.city || 'Berlin').trim(),
      cuisine: String(brandingOverrides.cuisine || previewProfile?.company?.cuisine || 'Contemporary European').trim(),
      phone: fallbackPhone,
      email: fallbackEmail,
      address: contactAddress
    },
    settings: {
      site_template: String(settings.site_template || WEBSITE_BUILDER_DEFAULTS.site_template).trim(),
      site_tagline: String(settings.site_tagline || previewProfile?.settings?.site_tagline || WEBSITE_BUILDER_DEFAULTS.site_tagline).trim(),
      site_hero_title: String(settings.site_hero_title || previewProfile?.settings?.site_hero_title || WEBSITE_BUILDER_DEFAULTS.site_hero_title).trim(),
      site_hero_subtitle: String(settings.site_hero_subtitle || previewProfile?.settings?.site_hero_subtitle || WEBSITE_BUILDER_DEFAULTS.site_hero_subtitle).trim(),
      site_about_title: String(settings.site_about_title || WEBSITE_BUILDER_DEFAULTS.site_about_title).trim(),
      site_about_body: String(settings.site_about_body || WEBSITE_BUILDER_DEFAULTS.site_about_body).trim(),
      site_primary_cta_text: String(settings.site_primary_cta_text || defaultLabels.reserveButton).trim(),
      site_secondary_cta_text: String(settings.site_secondary_cta_text || 'Menu').trim(),
      site_accent_color: String(settings.site_accent_color || WEBSITE_BUILDER_DEFAULTS.site_accent_color).trim(),
      site_language: language,
      business_hours_open: String(settings.business_hours_open || '').trim(),
      business_hours_close: String(settings.business_hours_close || '').trim(),
      closed_weekday: String(settings.closed_weekday || '').trim(),
      opening_hours_schedule: openingHoursSchedule,
      booking_email: fallbackEmail,
      website_url: websiteUrl,
      custom_domain: String(settings.custom_domain || '').trim(),
      standard_contact_link: String(settings.standard_contact_link || '').trim(),
      founder_program_label: String(settings.founder_program_label || 'Circle').trim(),
      founder_membership_type: String(settings.founder_membership_type || FOUNDER_DEFAULT_MEMBERSHIP_TYPE).trim(),
      founder_redirect_link: String(settings.founder_redirect_link || '').trim(),
      privacy_link: String(settings.privacy_link || '/privacy.html').trim(),
      founder_terms_link: String(settings.founder_terms_link || '/terms.html').trim()
    },
    branding: {
      logo_image: String(brandingOverrides.logo_image || content.logo_image || '').trim(),
      locale_label: String(brandingOverrides.locale_label || language.toUpperCase()).trim(),
      language_code: language
    },
    navigation: {
      labels: {
        home: String(navigationLabels.home || defaultLabels.home).trim(),
        menu: String(navigationLabels.menu || defaultLabels.menu).trim(),
        reservation: String(navigationLabels.reservation || defaultLabels.reservation).trim(),
        about: String(navigationLabels.about || defaultLabels.about).trim(),
        contact: String(navigationLabels.contact || defaultLabels.contact).trim(),
        career: String(navigationLabels.career || defaultLabels.career).trim()
      },
      secondary_items: Array.isArray(navigationOverrides.secondary_items)
        ? navigationOverrides.secondary_items
        : getDefaultWebsiteSecondaryItems(language),
      page_visibility: navigationOverrides.page_visibility && typeof navigationOverrides.page_visibility === 'object'
        ? navigationOverrides.page_visibility
        : {
          home: { show_in_nav: true, show_on_home: true },
          menu: { show_in_nav: true, show_on_home: false },
          reservation: { show_in_nav: true, show_on_home: false },
          about: { show_in_nav: true, show_on_home: false },
          contact: { show_in_nav: true, show_on_home: false },
          career: { show_in_nav: true, show_on_home: false }
        },
      header_contact_label: String(navigationOverrides.header_contact_label || defaultLabels.contactButton).trim(),
      header_reserve_label: String(navigationOverrides.header_reserve_label || defaultLabels.reserveButton).trim()
    },
    career: {
      ...(careerOverrides || {})
    },
    modules,
    legal: {
      terms_url: String(settings.founder_terms_link || '/terms.html').trim(),
      privacy_url: String(settings.privacy_link || '/privacy.html').trim(),
      impressum_url: String(brandingOverrides.impressum_url || '/impressum.html').trim()
    },
    social: {
      instagram: String(settings.social_instagram_url || '').trim(),
      facebook: String(settings.social_facebook_url || '').trim(),
      tiktok: String(settings.social_tiktok_url || '').trim(),
      google_business: String(settings.social_google_business_url || '').trim()
    },
    content
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
  const setupFee = Number(settingsMap.platform_setup_fee_once || PLATFORM_PRICING_DEFAULTS.platform_setup_fee_once || 0);
  const tseFee = Number(settingsMap.platform_tse_fee_monthly || PLATFORM_PRICING_DEFAULTS.platform_tse_fee_monthly || 0);
  const supportHourly = Number(settingsMap.platform_it_support_hourly || PLATFORM_PRICING_DEFAULTS.platform_it_support_hourly || 0);
  const supportMonthly = Number(settingsMap.platform_it_support_monthly || PLATFORM_PRICING_DEFAULTS.platform_it_support_monthly || 0);

  return {
    ok: true,
    billingModel: 'per_user_monthly',
    pricingNote: String(settingsMap.platform_price_note || PLATFORM_PRICING_DEFAULTS.platform_price_note),
    paymentMethods: buildPaymentMethodPolicy(settingsMap),
    extras: {
      oneTimeSetupFeeEur: setupFee,
      tseMonthlyFeeEur: tseFee,
      itSupportHourlyEur: supportHourly,
      itSupportMonthlyRetainerEur: supportMonthly
    },
    plans: PLATFORM_PLAN_DEFINITIONS.map(definition => buildPlatformPlanDefinition(settingsMap, definition))
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

function getPlanModuleOverrides(planId) {
  switch (normalizePlanId(planId)) {
    case 'core':
      return {
        module_booking_management: false,
        module_membership_management: false,
        module_founder_program: false
      };
    default:
      return {};
  }
}

function normalizeWebsiteTemplate(templateRaw) {
  const normalized = String(templateRaw || '').trim().toLowerCase();
  return ['minimal', 'modern', 'premium'].includes(normalized) ? normalized : WEBSITE_BUILDER_DEFAULTS.site_template;
}

function computeDemoPaymentSummary(planId, userCount, extras, settingsMap, paymentMethodRaw = 'bankcard') {
  const paymentMethod = normalizeDemoPaymentMethod(paymentMethodRaw, 'bankcard');
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
    paymentStatus: 'demo_paid',
    paymentMethod
  };
}

async function recalculateCompanyBillingSummary(env, companyId) {
  const [pricingSettings, companySettings, staffCountRow] = await Promise.all([
    getPlatformMarketingSettings(env),
    getSettingsMap(env, companyId, [
      'company_plan',
      'billing_include_tse',
      'billing_include_support_retainer',
      'billing_include_setup',
      'demo_payment_method'
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
  const summary = computeDemoPaymentSummary(
    plan,
    activeStaff,
    extras,
    pricingSettings,
    normalizeDemoPaymentMethodForPlatform(companySettings.demo_payment_method || 'bankcard', pricingSettings, 'bankcard')
  );

  await upsertSettingValue(env, companyId, 'billable_staff_count', String(activeStaff), OPERATIONAL_KEY_DESCRIPTIONS.billable_staff_count, 'billing-automation');
  await upsertSettingValue(env, companyId, 'demo_payment_recurring_monthly_eur', String(summary.recurringMonthlyEur), OPERATIONAL_KEY_DESCRIPTIONS.demo_payment_recurring_monthly_eur, 'billing-automation');

  return { activeStaff, summary };
}

async function authorizePlatformOperator(env, pinRaw) {
  return authorizeAdminByPin(env, PLATFORM_OPERATOR_COMPANY_ID, pinRaw);
}

async function getPlatformAdminDashboard(env) {
  const [pricingSettings, signupsResult, contactsResult, reviewsResult, paymentEventsResult, customDomainRequestsResult, customDomainRequestEventsResult] = await Promise.all([
    getPlatformMarketingSettings(env),
    env.DB.prepare(`
      SELECT id, company_id, organization_id, restaurant_name, owner_email, owner_phone, subdomain, plan,
             website_template, staff_users, country, payment_status, payment_method, payment_reference, payment_confirmed_at,
             due_today_eur, recurring_monthly_eur, follow_up_status, follow_up_note, followed_up_at, created_at
      FROM platform_signups
      ORDER BY created_at DESC
      LIMIT 100
    `).all(),
    env.DB.prepare(`
      SELECT id, name, email, subject, message, submitted_at, status
      FROM platform_contacts
      ORDER BY submitted_at DESC
      LIMIT 100
    `).all(),
    env.DB.prepare(`
      SELECT pr.id, pr.company_id, pr.host, pr.subdomain, pr.decision, pr.review_status, pr.risk_score,
             pr.reason_codes_json, pr.review_note, pr.created_at, pr.updated_at,
             c.name AS company_name, c.website_status, c.subdomain_status, c.trust_state
      FROM publish_reviews pr
      LEFT JOIN companies c ON c.id = pr.company_id
      ORDER BY
        CASE pr.review_status
          WHEN 'pending' THEN 0
          WHEN 'approved' THEN 1
          WHEN 'rejected' THEN 2
          ELSE 3
        END,
        pr.created_at DESC
      LIMIT 100
    `).all(),
    env.DB.prepare(`
      SELECT id, signup_id, company_id, payment_reference, payment_method, payment_status,
             event_type, event_source, note, created_at
      FROM payment_events
      ORDER BY created_at DESC
      LIMIT 500
    `).all(),
    env.DB.prepare(`
      SELECT id, company_id, organization_id, requested_domain, registration_mode, request_status,
            dns_record_type, dns_name, dns_value, request_note, operator_note, renewal_mode,
            renewal_status, renewal_due_at, renewal_last_reminded_at, auto_renew_enabled,
             approved_at, approved_by, dns_ready_at, verified_at, activated_at, activated_by,
            last_health_check_at, last_health_check_status, last_health_check_note,
             rejected_at, rejected_by, created_at, updated_at
      FROM custom_domain_requests
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 200
    `).all(),
    env.DB.prepare(`
      SELECT id, request_id, company_id, event_type, request_status, actor_type, actor_id, note, metadata_json, created_at
      FROM custom_domain_request_events
      ORDER BY created_at DESC
      LIMIT 500
    `).all()
  ]);

  return {
    pricingSettings,
    signups: signupsResult?.results || [],
    contacts: contactsResult?.results || [],
    reviews: reviewsResult?.results || [],
    paymentEvents: paymentEventsResult?.results || [],
    customDomainRequests: (customDomainRequestsResult?.results || []).map((item) => annotateCustomDomainRequest(item)),
    customDomainRequestEvents: customDomainRequestEventsResult?.results || []
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

  const enforcePublicTenantAccess = !canOverrideCompanyIdForHost(tenant, url) && isTenantPublicFacingPath(url?.pathname || '');

  const queryCompanyById = async (companyId) => {
    try {
      return await env.DB.prepare(
        `SELECT id, subdomain, subdomain_status, website_status, trust_state
         FROM companies WHERE id = ? AND is_active = 1 LIMIT 1`
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
        `SELECT id, subdomain, subdomain_status, website_status, trust_state
         FROM companies WHERE lower(subdomain) = ? AND is_active = 1 LIMIT 1`
      ).bind(subdomain).first();
    } catch (error) {
      const message = String(error?.message || error || '').toLowerCase();
      if (message.includes('no such table: companies')) {
        return { __error: 'companies_table_missing' };
      }
      throw error;
    }
  };

  const queryCompanyByCustomDomain = async (hostname) => {
    try {
      const normalizedHostname = normalizeCustomDomainHostname(hostname);
      if (!normalizedHostname) return null;
      return await env.DB.prepare(
        `SELECT c.id, c.subdomain, c.subdomain_status, c.website_status, c.trust_state
         FROM companies c
         JOIN settings s ON s.company_id = c.id AND s.key = 'custom_domain'
         WHERE c.is_active = 1
           AND lower(replace(replace(trim(s.value), 'https://', ''), 'http://', '')) = ?
         LIMIT 1`
      ).bind(normalizedHostname).first();
    } catch (error) {
      const message = String(error?.message || error || '').toLowerCase();
      if (message.includes('no such table: companies') || message.includes('no such table: settings')) {
        return { __error: 'companies_table_missing' };
      }
      throw error;
    }
  };

  const allowQueryOverride = canOverrideCompanyIdForHost(tenant, url);
  const queryCompanyId = Number(url.searchParams.get('company_id') || 0);

  const finalizeResolvedCompany = (companyRow, missingReason) => {
    if (companyRow?.__error) {
      return { ok: false, reason: companyRow.__error };
    }
    if (!companyRow?.id) {
      return { ok: false, reason: missingReason };
    }

    const subdomainStatus = String(companyRow.subdomain_status || 'active').trim().toLowerCase();
    const websiteStatus = String(companyRow.website_status || 'draft').trim().toLowerCase();
    const trustState = String(companyRow.trust_state || 'pending_verification').trim().toLowerCase();

    if (enforcePublicTenantAccess) {
      if (subdomainStatus === 'quarantine' || subdomainStatus === 'blocked') {
        return {
          ok: false,
          reason: 'tenant_subdomain_blocked',
          companyId: Number(companyRow.id),
          subdomainStatus,
          websiteStatus,
          trustState
        };
      }

      if (websiteStatus === 'suspended' || trustState === 'suspended') {
        return {
          ok: false,
          reason: 'tenant_website_suspended',
          companyId: Number(companyRow.id),
          subdomainStatus,
          websiteStatus,
          trustState
        };
      }
    }

    return {
      ok: true,
      companyId: Number(companyRow.id),
      subdomainStatus,
      websiteStatus,
      trustState
    };
  };

  if (Number.isInteger(queryCompanyId) && queryCompanyId > 0) {
    if (!allowQueryOverride) {
      return { ok: false, reason: 'override_not_allowed' };
    }

    const overrideCompany = await queryCompanyById(queryCompanyId);
    return finalizeResolvedCompany(overrideCompany, 'override_company_not_found');
  }

  const tenantCompanyId = Number(tenant?.companyId || 0);
  if (Number.isInteger(tenantCompanyId) && tenantCompanyId > 0) {
    const tenantCompany = await queryCompanyById(tenantCompanyId);
    return finalizeResolvedCompany(tenantCompany, 'tenant_company_not_found');
  }

  const hostname = normalizeCustomDomainHostname(url?.hostname || '');
  if (hostname && hostname !== PLATFORM_PUBLIC_DOMAIN && !hostname.endsWith(`.${PLATFORM_PUBLIC_DOMAIN}`) && !hostname.includes('workers.dev') && !isLocalDevelopmentHost(url)) {
    const customDomainCompany = await queryCompanyByCustomDomain(hostname);
    if (customDomainCompany?.id || customDomainCompany?.__error) {
      return finalizeResolvedCompany(customDomainCompany, 'tenant_custom_domain_not_found');
    }
  }

  const subdomain = String(tenant?.subdomain || '').trim().toLowerCase();
  if (subdomain && subdomain !== 'www') {
    const subdomainCompany = await queryCompanyBySubdomain(subdomain);
    return finalizeResolvedCompany(subdomainCompany, 'tenant_subdomain_not_found');
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

function isWebsiteMasterPreviewPath(pathnameRaw) {
  const pathname = String(pathnameRaw || '').trim().toLowerCase();
  return pathname === '/website-master'
    || pathname === '/website-master/'
    || pathname.startsWith('/website-master/')
    || pathname === '/favicon.svg';
}

function isTenantPublicFacingPath(pathnameRaw) {
  const pathname = String(pathnameRaw || '').trim().toLowerCase();
  return pathname === '/api/website/payload'
    || pathname === '/website-master'
    || pathname === '/website-master/'
    || pathname.startsWith('/website-master/')
    || pathname === '/booking-form'
    || pathname === '/booking-form.html'
    || pathname === '/api/contact/create'
    || pathname === '/reservierung'
    || pathname === '/reservierung.html'
    || pathname === '/founder'
    || pathname === '/founder-form'
    || pathname === '/founder-form.html'
    || pathname === '/kc'
    || pathname === '/kc-form'
    || pathname === '/kc-form.html'
    || pathname === '/api/founder/register'
    || pathname === '/api/kc/register'
    || pathname === '/api/founder/resend-otp'
    || pathname === '/api/kc/resend-otp'
    || pathname === '/api/founder/verify'
    || pathname === '/api/kc/verify';
}

function buildTenantWebsiteUnavailableResponse(url, reason) {
  const normalizedReason = String(reason || '').trim().toLowerCase();
  const isApi = String(url?.pathname || '').startsWith('/api/');

  if (isApi) {
    const status = normalizedReason === 'tenant_website_suspended' ? 423 : 423;
    return Response.json({ ok: false, error: normalizedReason || 'tenant_website_unavailable' }, { status });
  }

  const title = normalizedReason === 'tenant_website_suspended'
    ? 'Website Suspended'
    : 'Website Unavailable';
  const body = normalizedReason === 'tenant_website_suspended'
    ? 'This tenant website is currently suspended and not publicly available.'
    : 'This tenant host is currently unavailable.';

  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: Georgia, serif; margin: 0; background: #f6f1ea; color: #201913; }
    main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    section { max-width: 560px; background: rgba(255,255,255,0.9); border: 1px solid #d8cfc2; border-radius: 24px; padding: 32px; box-shadow: 0 20px 60px rgba(32,25,19,0.08); }
    h1 { margin: 0 0 12px; font-size: 2rem; }
    p { margin: 0; line-height: 1.6; color: #5b4c42; }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>${title}</h1>
      <p>${body}</p>
    </section>
  </main>
</body>
</html>`, {
    status: 423,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
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
    founderTermsFlag: founderTermsAccepted ? 1 : 1,
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

    if (url.pathname === '/website/-master' || url.pathname === '/website/-master/') {
      return Response.redirect(`${url.origin}/website-master/`, 301);
    }

    if (url.pathname.startsWith('/website/-master/')) {
      const redirectPath = url.pathname.replace('/website/-master/', '/website-master/');
      return Response.redirect(`${url.origin}${redirectPath}${url.search}`, 301);
    }

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

    let activeCompanyResolution = { ok: false, reason: 'unresolved' };
    const skipActiveCompanyResolution = isWebsiteMasterPreviewPath(url.pathname) && canOverrideCompanyIdForHost(tenant, url);
    if (!skipActiveCompanyResolution) {
      try {
        activeCompanyResolution = await resolveActiveCompanyId(env, tenant, url);
      } catch (e) {
        console.warn('Company resolution error:', e?.message || e);
        activeCompanyResolution = { ok: false, reason: 'resolution_error' };
      }

      if (!activeCompanyResolution.ok) {
        console.warn('Tenant resolution failed:', activeCompanyResolution.reason);
      }
    }

    if (!activeCompanyResolution.ok && isTenantPublicFacingPath(url.pathname)) {
      if (activeCompanyResolution.reason === 'tenant_website_suspended' || activeCompanyResolution.reason === 'tenant_subdomain_blocked') {
        return buildTenantWebsiteUnavailableResponse(url, activeCompanyResolution.reason);
      }
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

    if (url.pathname === "/api/website/payload" && request.method === "GET") {
      return runTenantRoute(async ({ companyId }) => {
        try {
          const source = await resolveWebsitePayloadForRequest(env, companyId, url);
          return Response.json({ ok: true, companyId, source });
        } catch (e) {
          console.error('Website payload GET error:', e);
          return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
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
        const requestedSlug = url.searchParams.get('slug') || '';
        const policy = await evaluateSubdomainPolicy(env, requestedSlug);
        if (!policy.slug || policy.reasonCodes.includes('subdomain_invalid_syntax') || policy.reasonCodes.includes('subdomain_required')) {
          return Response.json({ ok: false, code: 'validation_failed', message: 'Subdomain must use lowercase letters, numbers, and hyphens.' }, { status: 400 });
        }

        if (!policy.available) {
          const code = policy.reasonCodes.includes('subdomain_taken')
            ? 'subdomain_taken'
            : policy.decision === 'review'
              ? 'subdomain_review_required'
              : 'subdomain_blocked';
          return Response.json({
            ok: false,
            code,
            available: false,
            decision: policy.decision,
            slug: policy.slug,
            reason_codes: policy.reasonCodes,
            suggestions: policy.suggestions,
            suggestion: policy.suggestions[0] || `${policy.slug}-2`,
            message: policy.message
          }, { status: 409 });
        }

        return Response.json({
          ok: true,
          available: true,
          decision: policy.decision,
          slug: policy.slug,
          reason_codes: [],
          suggestions: policy.suggestions,
          url: buildTenantWebsiteUrl(policy.slug)
        });
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

    if (url.pathname === "/api/platform/admin/domain-renewals/run-reminders" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const pin = String(body?.pin || '').trim();
        const auth = await authorizePlatformOperator(env, pin);
        if (!auth.ok) {
          return Response.json({ ok: false, error: auth.error }, { status: auth.status });
        }

        const summary = await processManagedDomainRenewalReminders(env, {
          dryRun: !!body?.dryRun,
          sendDigest: body?.sendDigest !== false,
          actorId: String(auth.staff.name || auth.staff.id || 'platform-operator')
        });
        return Response.json({ ok: true, summary });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    if (url.pathname.match(/^\/api\/platform\/admin\/domain-renewals\/([^/]+)\/preview$/) && request.method === "POST") {
      try {
        const routeMatch = url.pathname.match(/^\/api\/platform\/admin\/domain-renewals\/([^/]+)\/preview$/);
        const requestId = decodeURIComponent(String(routeMatch?.[1] || '')).trim();
        const body = await request.json().catch(() => ({}));
        const pin = String(body?.pin || '').trim();
        const auth = await authorizePlatformOperator(env, pin);
        if (!auth.ok) {
          return Response.json({ ok: false, error: auth.error }, { status: auth.status });
        }

        const domainRequest = await getCustomDomainRequestById(env, requestId);
        if (!domainRequest?.id) {
          return Response.json({ ok: false, error: 'Domain request not found.' }, { status: 404 });
        }

        const preview = buildDomainRenewalReminderPreview(domainRequest);
        return Response.json({ ok: true, preview });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    if (url.pathname.match(/^\/api\/platform\/admin\/domain-renewals\/([^/]+)\/force-overdue$/) && request.method === "POST") {
      try {
        const routeMatch = url.pathname.match(/^\/api\/platform\/admin\/domain-renewals\/([^/]+)\/force-overdue$/);
        const requestId = decodeURIComponent(String(routeMatch?.[1] || '')).trim();
        const body = await request.json().catch(() => ({}));
        const pin = String(body?.pin || '').trim();
        const note = String(body?.note || body?.operatorNote || '').trim();
        const auth = await authorizePlatformOperator(env, pin);
        if (!auth.ok) {
          return Response.json({ ok: false, error: auth.error }, { status: auth.status });
        }

        const domainRequest = await getCustomDomainRequestById(env, requestId);
        if (!domainRequest?.id) {
          return Response.json({ ok: false, error: 'Domain request not found.' }, { status: 404 });
        }
        if (String(domainRequest.request_status || '').trim().toLowerCase() !== 'active') {
          return Response.json({ ok: false, error: 'Only active domains can be escalated.' }, { status: 409 });
        }

        const updatedRequest = await updateCustomDomainRequestState(env, requestId, {
          renewalStatus: 'renewal_overdue',
          actorType: 'platform_operator',
          actorId: String(auth.staff.name || auth.staff.id || 'platform-operator'),
          eventType: 'renewal_force_overdue',
          eventNote: note || 'Operator forced overdue escalation.'
        });

        return Response.json({ ok: true, request: annotateCustomDomainRequest(updatedRequest) });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    if (url.pathname.match(/^\/api\/platform\/admin\/domain-requests\/([^/]+)\/(approve|reject|verify|activate)$/) && request.method === "POST") {
      try {
        const routeMatch = url.pathname.match(/^\/api\/platform\/admin\/domain-requests\/([^/]+)\/(approve|reject|verify|activate)$/);
        const requestId = decodeURIComponent(String(routeMatch?.[1] || '')).trim();
        const action = String(routeMatch?.[2] || '').trim().toLowerCase();
        const body = await request.json().catch(() => ({}));
        const pin = String(body?.pin || '').trim();
        const operatorNote = String(body?.operatorNote || body?.note || '').trim();
        const auth = await authorizePlatformOperator(env, pin);
        if (!auth.ok) {
          return Response.json({ ok: false, error: auth.error }, { status: auth.status });
        }

        const domainRequest = await getCustomDomainRequestById(env, requestId);
        if (!domainRequest?.id) {
          return Response.json({ ok: false, error: 'Domain request not found.' }, { status: 404 });
        }

        const actorName = String(auth.staff.name || auth.staff.id || 'platform-operator');
        let updatedRequest = null;

        if (action === 'approve') {
          if (String(domainRequest.request_status || '') !== 'requested') {
            return Response.json({ ok: false, error: 'Only newly requested domains can be approved.' }, { status: 409 });
          }
          updatedRequest = await updateCustomDomainRequestState(env, requestId, {
            requestStatus: 'approved_waiting_dns',
            operatorNote,
            approvedAt: new Date().toISOString(),
            approvedBy: actorName,
            eventType: 'request_approved',
            actorType: 'platform_operator',
            actorId: actorName,
            eventNote: operatorNote || 'Custom-domain upgrade approved.'
          });
        }

        if (action === 'reject') {
          if (['active', 'rejected'].includes(String(domainRequest.request_status || ''))) {
            return Response.json({ ok: false, error: 'This domain request can no longer be rejected.' }, { status: 409 });
          }
          updatedRequest = await updateCustomDomainRequestState(env, requestId, {
            requestStatus: 'rejected',
            operatorNote,
            rejectedAt: new Date().toISOString(),
            rejectedBy: actorName,
            eventType: 'request_rejected',
            actorType: 'platform_operator',
            actorId: actorName,
            eventNote: operatorNote || 'Custom-domain request rejected.'
          });
        }

        if (action === 'verify') {
          if (String(domainRequest.request_status || '') !== 'verification_pending') {
            return Response.json({ ok: false, error: 'DNS can only be verified after the tenant marks it ready.' }, { status: 409 });
          }

          const dnsVerification = await verifyCustomDomainDns(env, domainRequest);
          if (!dnsVerification.ok) {
            await logCustomDomainRequestEvent(env, {
              requestId,
              companyId: Number(domainRequest.company_id || 0),
              eventType: 'dns_verification_failed',
              requestStatus: String(domainRequest.request_status || ''),
              actorType: 'platform_operator',
              actorId: actorName,
              note: String(dnsVerification.error || 'DNS verification failed.').trim(),
              metadataJson: {
                expectedTarget: dnsVerification.expectedTarget || null,
                dnsAnswers: dnsVerification.dnsAnswers || []
              }
            });
            return Response.json({ ok: false, code: dnsVerification.code, error: dnsVerification.error, expected_target: dnsVerification.expectedTarget || null, dns_answers: dnsVerification.dnsAnswers || [] }, { status: 409 });
          }

          updatedRequest = await updateCustomDomainRequestState(env, requestId, {
            requestStatus: 'verified_waiting_activation',
            operatorNote,
            verifiedAt: new Date().toISOString(),
            eventType: 'dns_verified',
            actorType: 'platform_operator',
            actorId: actorName,
            eventNote: operatorNote || 'DNS verified automatically.',
            metadataJson: {
              expectedTarget: dnsVerification.expectedTarget,
              dnsAnswers: dnsVerification.dnsAnswers || []
            }
          });
        }

        if (action === 'activate') {
          if (String(domainRequest.request_status || '') !== 'verified_waiting_activation') {
            return Response.json({ ok: false, error: 'Only verified domains can be activated.' }, { status: 409 });
          }
          const activationHealth = await runCustomDomainActivationHealthCheck(env, domainRequest);
          const renewalTracking = computeRenewalTrackingForRequest(domainRequest);
          updatedRequest = await updateCustomDomainRequestState(env, requestId, {
            requestStatus: 'active',
            operatorNote,
            activatedAt: new Date().toISOString(),
            activatedBy: actorName,
            renewalStatus: renewalTracking.renewalStatus,
            lastHealthCheckAt: new Date().toISOString(),
            lastHealthCheckStatus: activationHealth.status,
            lastHealthCheckNote: activationHealth.note,
            eventType: 'domain_activated',
            actorType: 'platform_operator',
            actorId: actorName,
            eventNote: operatorNote || 'Custom domain activated.',
            metadataJson: {
              activationHealthStatus: activationHealth.status,
              activationHealthNote: activationHealth.note
            }
          });
          await upsertSettingValue(
            env,
            Number(domainRequest.company_id || 0),
            'custom_domain',
            String(domainRequest.requested_domain || '').trim(),
            OPERATIONAL_KEY_DESCRIPTIONS.custom_domain || 'Custom domain mapped for the tenant website',
            actorName
          );
          await logCustomDomainRequestEvent(env, {
            requestId,
            companyId: Number(domainRequest.company_id || 0),
            eventType: 'activation_health_checked',
            requestStatus: 'active',
            actorType: 'system',
            actorId: 'activation-health-check',
            note: activationHealth.note,
            metadataJson: {
              activationHealthStatus: activationHealth.status
            }
          });
        }

        return Response.json({ ok: true, request: updatedRequest || domainRequest });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    if (url.pathname.match(/^\/api\/platform\/moderation\/review\/([^/]+)\/(approve|reject)$/) && request.method === "POST") {
      try {
        const routeMatch = url.pathname.match(/^\/api\/platform\/moderation\/review\/([^/]+)\/(approve|reject)$/);
        const reviewId = decodeURIComponent(String(routeMatch?.[1] || '')).trim();
        const action = String(routeMatch?.[2] || '').trim().toLowerCase();
        const body = await request.json().catch(() => ({}));
        const pin = String(body?.pin || request.headers.get('x-admin-pin') || '').trim();
        const reviewNote = String(body?.reviewNote || body?.note || '').trim();
        const auth = await authorizePlatformOperator(env, pin);
        if (!auth.ok) {
          return Response.json({ ok: false, error: auth.error }, { status: auth.status });
        }

        if (!reviewId) {
          return Response.json({ ok: false, error: 'Review id is required' }, { status: 400 });
        }

        const existingReview = await getPublishReviewById(env, reviewId);
        if (!existingReview) {
          return Response.json({ ok: false, error: 'Review not found' }, { status: 404 });
        }

        const reviewerId = String(auth.staff.name || auth.staff.id || 'platform-operator');
        const reviewLinks = buildPlatformReviewLinks(url.origin, reviewId, Number(existingReview.company_id));
        const [company, operationalSettings] = await Promise.all([
          getCompanyProfile(env, Number(existingReview.company_id)),
          getOperationalSettingsMap(env, Number(existingReview.company_id))
        ]);
        const publishedUrl = buildPublishedWebsiteUrlForCompany(company, operationalSettings);
        const releaseReasonCodes = (() => {
          try {
            const parsed = JSON.parse(String(existingReview.reason_codes_json || '[]'));
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })();
        const updatedReview = await updatePublishReviewDecision(env, reviewId, {
          decision: action === 'approve' ? 'allow' : 'block',
          reviewStatus: action === 'approve' ? 'approved' : 'rejected',
          reviewerType: 'operator',
          reviewerId,
          reviewNote
        });

        await updateCompanyWebsiteState(env, Number(existingReview.company_id), {
          websiteStatus: action === 'approve' ? 'published' : 'draft',
          trustState: action === 'approve' ? 'trusted' : undefined,
          lastReviewedAt: new Date().toISOString()
        });

        await updateWebsiteReleaseByReviewId(env, reviewId, {
          releaseStatus: action === 'approve' ? 'published' : 'rejected',
          publishedUrl: action === 'approve' ? publishedUrl : '',
          releaseNote: reviewNote,
          reviewerType: 'operator',
          reviewerId,
          publishedAt: action === 'approve' ? new Date().toISOString() : null,
          reasonCodes: releaseReasonCodes
        });

        if (action === 'approve') {
          await upsertSubdomainReservation(
            env,
            company?.subdomain || existingReview.subdomain || '',
            Number(existingReview.company_id),
            'reserved',
            'operator_approved',
            'platform-operator'
          );
        }

        await sendTelegramReviewAlert(env, {
          eventType: action === 'approve' ? 'website_publish_approved' : 'website_publish_rejected',
          companyId: Number(existingReview.company_id),
          companyName: company?.name || '',
          host: existingReview.host || (company?.subdomain ? `${company.subdomain}.${PLATFORM_PUBLIC_DOMAIN}` : ''),
          decision: action === 'approve' ? 'allow' : 'block',
          riskScore: Number(existingReview.risk_score || 0),
          reasonCodes: JSON.parse(String(existingReview.reason_codes_json || '[]')),
          reviewId,
          reviewUrl: reviewLinks.reviewUrl,
          tenantAdminUrl: reviewLinks.tenantAdminUrl
        }).catch((error) => {
          console.error('telegram_review_alert_failed', error);
        });

        return Response.json({
          ok: true,
          review_id: reviewId,
          action,
          company_id: Number(existingReview.company_id),
          review: updatedReview
        });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    if (url.pathname.match(/^\/api\/platform\/tenants\/(\d+)\/suspend-website$/) && request.method === "POST") {
      try {
        const routeMatch = url.pathname.match(/^\/api\/platform\/tenants\/(\d+)\/suspend-website$/);
        const companyId = Number(routeMatch?.[1] || 0);
        const body = await request.json().catch(() => ({}));
        const pin = String(body?.pin || request.headers.get('x-admin-pin') || '').trim();
        const reason = String(body?.reason || body?.suspendedReason || 'operator_suspension').trim();
        const auth = await authorizePlatformOperator(env, pin);
        if (!auth.ok) {
          return Response.json({ ok: false, error: auth.error }, { status: auth.status });
        }

        if (!companyId) {
          return Response.json({ ok: false, error: 'Company id is required' }, { status: 400 });
        }

        const company = await getCompanyProfile(env, companyId);
        if (!company) {
          return Response.json({ ok: false, error: 'Company not found' }, { status: 404 });
        }

        const now = new Date().toISOString();
        await updateCompanyWebsiteState(env, companyId, {
          websiteStatus: 'suspended',
          trustState: 'suspended',
          suspendedReason: reason,
          suspendedAt: now,
          lastReviewedAt: now
        });

        await updateLatestWebsiteReleaseForCompany(env, companyId, {
          releaseStatus: 'suspended',
          releaseNote: reason,
          reviewerType: 'operator',
          reviewerId: String(auth.staff.name || auth.staff.id || 'platform-operator'),
          suspendedAt: now,
          reasonCodes: [reason]
        });

        await sendTelegramReviewAlert(env, {
          eventType: 'website_suspended',
          companyId,
          companyName: company?.name || '',
          host: company?.subdomain ? `${company.subdomain}.${PLATFORM_PUBLIC_DOMAIN}` : '',
          decision: 'suspended',
          riskScore: Number(company?.risk_score || 0),
          reasonCodes: [reason],
          ...buildPlatformReviewLinks(url.origin, '', companyId)
        }).catch((error) => {
          console.error('telegram_review_alert_failed', error);
        });

        return Response.json({
          ok: true,
          company_id: companyId,
          website_status: 'suspended',
          trust_state: 'suspended',
          reason
        });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    if (url.pathname.match(/^\/api\/platform\/subdomains\/([^/]+)\/quarantine$/) && request.method === "POST") {
      try {
        const routeMatch = url.pathname.match(/^\/api\/platform\/subdomains\/([^/]+)\/quarantine$/);
        const slug = normalizeTenantSubdomain(decodeURIComponent(String(routeMatch?.[1] || '')).trim());
        const body = await request.json().catch(() => ({}));
        const pin = String(body?.pin || request.headers.get('x-admin-pin') || '').trim();
        const reason = String(body?.reason || 'operator_quarantine').trim();
        const auth = await authorizePlatformOperator(env, pin);
        if (!auth.ok) {
          return Response.json({ ok: false, error: auth.error }, { status: auth.status });
        }

        if (!slug) {
          return Response.json({ ok: false, error: 'Subdomain slug is required' }, { status: 400 });
        }

        const company = await env.DB.prepare(
          `SELECT id, name, subdomain FROM companies WHERE lower(subdomain) = lower(?) LIMIT 1`
        ).bind(slug).first();

        await upsertSubdomainReservation(
          env,
          slug,
          Number(company?.id || 0) || null,
          'quarantine',
          reason,
          'platform-operator'
        );

        if (company?.id) {
          await updateCompanySubdomainState(env, Number(company.id), 'quarantine');
          await updateLatestWebsiteReleaseForCompany(env, Number(company.id), {
            releaseStatus: 'quarantined',
            releaseNote: reason,
            reviewerType: 'operator',
            reviewerId: String(auth.staff.name || auth.staff.id || 'platform-operator'),
            suspendedAt: new Date().toISOString(),
            reasonCodes: [reason]
          });
        }

        await sendTelegramReviewAlert(env, {
          eventType: 'subdomain_quarantined',
          companyId: Number(company?.id || 0) || 'unassigned',
          companyName: company?.name || '',
          host: `${slug}.${PLATFORM_PUBLIC_DOMAIN}`,
          decision: 'quarantine',
          reasonCodes: [reason],
          ...buildPlatformReviewLinks(url.origin, '', Number(company?.id || 0) || '')
        }).catch((error) => {
          console.error('telegram_review_alert_failed', error);
        });

        return Response.json({
          ok: true,
          slug,
          company_id: Number(company?.id || 0) || null,
          subdomain_status: 'quarantine',
          reason
        });
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
        const demoPaymentMethod = normalizeDemoPaymentMethod(body?.demo_payment_method || 'bankcard');
        const extras = body?.extras && typeof body.extras === 'object' ? body.extras : {};

        if (!restaurantName || !ownerEmail || !requestedSlug || !plan) {
          return Response.json({ ok: false, code: 'validation_failed', message: 'Restaurant name, owner email, plan, and subdomain are required.' }, { status: 400 });
        }

        const subdomainPolicy = await evaluateSubdomainPolicy(env, requestedSlug);
        if (subdomainPolicy.reasonCodes.includes('subdomain_invalid_syntax')) {
          return Response.json({ ok: false, code: 'validation_failed', message: 'Subdomain must use lowercase letters, numbers, and hyphens.' }, { status: 400 });
        }

        if (subdomainPolicy.decision === 'review') {
          const reviewLinks = buildPlatformReviewLinks(url.origin, '', '');
          await sendTelegramReviewAlert(env, {
            eventType: 'signup_subdomain_review',
            companyId: 'pending-signup',
            companyName: restaurantName,
            host: `${subdomainPolicy.slug}.${PLATFORM_PUBLIC_DOMAIN}`,
            decision: subdomainPolicy.decision,
            riskScore: 50,
            reasonCodes: subdomainPolicy.reasonCodes,
            reviewUrl: reviewLinks.reviewUrl
          }).catch((error) => {
            console.error('telegram_review_alert_failed', error);
          });
          return Response.json({
            ok: false,
            code: 'subdomain_review_required',
            message: subdomainPolicy.message,
            reason_codes: subdomainPolicy.reasonCodes,
            suggestions: subdomainPolicy.suggestions
          }, { status: 409 });
        }

        if (subdomainPolicy.decision === 'block') {
          return Response.json({
            ok: false,
            code: subdomainPolicy.reasonCodes.includes('subdomain_taken') ? 'subdomain_taken' : 'subdomain_blocked',
            message: subdomainPolicy.message,
            reason_codes: subdomainPolicy.reasonCodes,
            suggestions: subdomainPolicy.suggestions
          }, { status: 409 });
        }

        if (!/^\d{4}$/.test(adminPin)) {
          return Response.json({ ok: false, code: 'validation_failed', message: 'Admin PIN must be exactly 4 digits.' }, { status: 400 });
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

        const enabledPlatformMethods = getEnabledPlatformPaymentMethods(pricingSettings);
        if (!enabledPlatformMethods.length) {
          return Response.json({ ok: false, code: 'payment_methods_unavailable', message: 'No payment methods are currently enabled for signup.' }, { status: 409 });
        }

        if (!enabledPlatformMethods.includes(demoPaymentMethod)) {
          return Response.json({
            ok: false,
            code: 'payment_method_disabled',
            message: 'Selected payment method is currently disabled by the platform.',
            enabled_payment_methods: enabledPlatformMethods
          }, { status: 409 });
        }

        let paymentSummary = computeDemoPaymentSummary(plan, staffUsers, extras, pricingSettings, demoPaymentMethod);
        if (demoPaymentMethod === 'bankcard' && canUseStripeCheckout(env)) {
          const chargeAmountEur = Number(paymentSummary.dueTodayEur || 0) > 0
            ? Number(paymentSummary.dueTodayEur || 0)
            : Number(paymentSummary.recurringMonthlyEur || 0);
          const checkoutSession = await createStripeCheckoutSession(env, {
            amountEur: chargeAmountEur,
            customerEmail: ownerEmail,
            productName: `${restaurantName} ${plan} signup`,
            successUrl: `${url.origin}/platform/signup.html?checkout=success&company_id=${companyId}&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${url.origin}/platform/signup.html?checkout=cancelled`,
            metadata: {
              company_id: companyId,
              organization_id: organizationId,
              restaurant_name: restaurantName,
              plan
            }
          });

          if (!checkoutSession.ok) {
            return Response.json({
              ok: false,
              code: checkoutSession.code || 'stripe_unavailable',
              message: checkoutSession.error || 'Stripe checkout is unavailable right now.'
            }, { status: checkoutSession.status || 503 });
          }

          paymentSummary = {
            ...paymentSummary,
            billingModel: 'stripe_checkout',
            paymentStatus: 'stripe_checkout_pending',
            checkoutUrl: checkoutSession.url,
            checkoutSessionId: checkoutSession.id
          };
        }

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
          UPDATE companies
          SET subdomain_status = 'active', website_status = 'draft', trust_state = 'trial_limited', risk_score = 0
          WHERE id = ?
        `).bind(companyId).run();

        await upsertSubdomainReservation(env, requestedSlug, companyId, 'reserved', 'active_company_slug', 'platform-signup');

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

        const websiteUrl = buildTenantWebsiteUrl(requestedSlug);
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
          demo_payment_method: paymentSummary.paymentMethod,
          demo_payment_reference: paymentSummary.checkoutSessionId || '',
          demo_payment_confirmed_at: paymentSummary.paymentStatus === 'stripe_paid' || paymentSummary.paymentStatus === 'demo_paid' ? now : '',
          demo_payment_due_today_eur: String(paymentSummary.dueTodayEur),
          demo_payment_recurring_monthly_eur: String(paymentSummary.recurringMonthlyEur),
          accepted_payment_methods_json: JSON.stringify([paymentSummary.paymentMethod]),
          billable_staff_count: String(Math.max(1, staffUsers)),
          country_code: country
        };

        for (const [key, value] of Object.entries(initialSettings)) {
          await upsertSettingValue(env, companyId, key, String(value || ''), `Platform signup setting: ${key}`, 'platform-signup');
        }

        const planModuleOverrides = getPlanModuleOverrides(plan);
        for (const [key, enabled] of Object.entries(planModuleOverrides)) {
          await upsertSettingValue(
            env,
            companyId,
            key,
            enabled ? 'enabled' : 'disabled',
            MODULE_KEY_DESCRIPTIONS[key] || ('Platform signup module override: ' + key),
            'platform-signup'
          );
        }

        const signupRecordId = crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO platform_signups (
            id, company_id, organization_id, restaurant_name, owner_email, owner_phone, subdomain, plan,
            website_template, staff_users, country, payment_status, payment_method, payment_reference, payment_confirmed_at,
            due_today_eur, recurring_monthly_eur, raw_payload_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          signupRecordId,
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
          paymentSummary.paymentMethod,
          paymentSummary.checkoutSessionId || null,
          paymentSummary.paymentStatus === 'stripe_paid' || paymentSummary.paymentStatus === 'demo_paid' ? now : null,
          Number(paymentSummary.dueTodayEur || 0),
          Number(paymentSummary.recurringMonthlyEur || 0),
          JSON.stringify(body || {}),
          now
        ).run();

        await logPlatformSignupPaymentEvent(env, {
          signupId: signupRecordId,
          companyId,
          paymentReference: paymentSummary.checkoutSessionId || null,
          paymentMethod: paymentSummary.paymentMethod,
          paymentStatus: paymentSummary.paymentStatus,
          eventType: paymentSummary.paymentStatus === 'stripe_checkout_pending' ? 'checkout_created' : 'payment_initialized',
          eventSource: 'platform-signup',
          note: paymentSummary.paymentStatus === 'stripe_checkout_pending'
            ? 'Initial Stripe checkout session created.'
            : 'Initial payment state stored during signup.'
        });

        const previewAdminUrl = `${url.origin}/admin?company_id=${companyId}`;
        const previewBoardUrl = plan === 'core' ? null : url.origin + '/board?company_id=' + companyId;

        return Response.json({
          ok: true,
          message: paymentSummary.paymentStatus === 'stripe_checkout_pending'
            ? 'Account created. Continue with Stripe test checkout.'
            : (demoPayment ? 'Demo payment completed. Account created.' : 'Account created.'),
          company_id: companyId,
          organization_id: organizationId,
          subdomain: requestedSlug,
          website_url: websiteUrl,
          preview_admin_url: previewAdminUrl,
          preview_board_url: previewBoardUrl,
          checkout_url: paymentSummary.checkoutUrl || '',
          payment: paymentSummary,
          admin_pin_hint: adminPin,
          status: 'trial_active'
        }, { status: 201 });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    if (url.pathname === "/api/platform/signup/confirm-payment" && request.method === "GET") {
      try {
        const companyId = Number(url.searchParams.get('company_id') || 0);
        const sessionId = String(url.searchParams.get('session_id') || '').trim();
        const result = await confirmPlatformSignupPayment(env, { companyId, sessionId });
        if (!result.ok) {
          return Response.json({ ok: false, code: result.code, error: result.error, stripe_status: result.stripe_status, stripe_payment_status: result.stripe_payment_status }, { status: result.status || 500 });
        }

        return Response.json({ ok: true, payment_status: result.paymentStatus, confirmed_at: result.confirmedAt || null, session_id: result.sessionId, already_confirmed: !!result.alreadyConfirmed });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    if (url.pathname.match(/^\/api\/platform\/admin\/signups\/([^/]+)\/retry-payment$/) && request.method === "POST") {
      try {
        const routeMatch = url.pathname.match(/^\/api\/platform\/admin\/signups\/([^/]+)\/retry-payment$/);
        const signupId = decodeURIComponent(String(routeMatch?.[1] || '')).trim();
        const body = await request.json().catch(() => ({}));
        const pin = String(body?.pin || '').trim();
        const auth = await authorizePlatformOperator(env, pin);
        if (!auth.ok) {
          return Response.json({ ok: false, error: auth.error }, { status: auth.status });
        }

        const result = await createPlatformSignupCheckoutRetry(env, {
          signupId,
          origin: url.origin,
          updatedBy: String(auth.staff.name || auth.staff.id || 'platform-operator')
        });
        if (!result.ok) {
          return Response.json({ ok: false, code: result.code, error: result.error }, { status: result.status || 500 });
        }

        return Response.json({ ok: true, signup_id: result.signupId, company_id: result.companyId, checkout_url: result.checkoutUrl, session_id: result.sessionId, payment_status: result.paymentStatus });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }

    if (url.pathname === "/api/admin/payment/retry-checkout" && request.method === "POST") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const body = await request.json().catch(() => ({}));
        const pin = String(body?.pin || '').trim();
        const auth = await authorizeAdminByPin(env, companyId, pin);
        if (!auth.ok) {
          return Response.json({ ok: false, error: auth.error }, { status: auth.status });
        }

        const signup = await env.DB.prepare(`
          SELECT id
          FROM platform_signups
          WHERE company_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `).bind(companyId).first();
        if (!signup?.id) {
          return Response.json({ ok: false, error: 'Signup not found for tenant.' }, { status: 404 });
        }

        const result = await createPlatformSignupCheckoutRetry(env, {
          signupId: signup.id,
          origin: url.origin,
          updatedBy: String(auth.staff.name || auth.staff.id || 'tenant-admin')
        });
        if (!result.ok) {
          return Response.json({ ok: false, code: result.code, error: result.error }, { status: result.status || 500 });
        }

        return Response.json({ ok: true, checkout_url: result.checkoutUrl, session_id: result.sessionId, payment_status: result.paymentStatus });
        } catch (e) {
          return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
      });
    }

    if (url.pathname === "/api/integrations/stripe/webhook" && request.method === "POST") {
      try {
        const parsed = await parseStripeWebhookEvent(env, request);
        if (!parsed.ok) {
          return Response.json({ ok: false, code: parsed.code, error: parsed.error }, { status: parsed.status || 400 });
        }

        const event = parsed.event || {};
        const eventType = String(event.type || '').trim();
        const session = event?.data?.object || {};
        const sessionId = String(session.id || '').trim();
        const companyId = Number(session?.metadata?.company_id || 0);

        if (!sessionId || !companyId) {
          return Response.json({ ok: true, received: true, ignored: true, reason: 'missing_checkout_metadata' });
        }

        const signup = await env.DB.prepare(`
          SELECT id, company_id, payment_status
          FROM platform_signups
          WHERE company_id = ? AND payment_reference = ?
          ORDER BY created_at DESC
          LIMIT 1
        `).bind(companyId, sessionId).first();

        if (!signup?.id) {
          return Response.json({ ok: true, received: true, ignored: true, reason: 'signup_not_found' });
        }

        if (eventType === 'checkout.session.completed' || eventType === 'checkout.session.async_payment_succeeded') {
          const confirmedAt = new Date().toISOString();
          await setPlatformSignupPaymentState(env, {
            signupId: signup.id,
            companyId,
            sessionId,
            paymentStatus: 'stripe_paid',
            confirmedAt,
            updatedBy: 'stripe-webhook'
          });

          return Response.json({ ok: true, received: true, action: 'payment_confirmed', payment_status: 'stripe_paid', session_id: sessionId });
        }

        if (eventType === 'checkout.session.expired' || eventType === 'checkout.session.async_payment_failed') {
          await setPlatformSignupPaymentState(env, {
            signupId: signup.id,
            companyId,
            sessionId,
            paymentStatus: eventType === 'checkout.session.expired' ? 'stripe_expired' : 'stripe_failed',
            confirmedAt: null,
            updatedBy: 'stripe-webhook'
          });

          return Response.json({ ok: true, received: true, action: 'payment_failed', payment_status: eventType === 'checkout.session.expired' ? 'stripe_expired' : 'stripe_failed', session_id: sessionId });
        }

        return Response.json({ ok: true, received: true, ignored: true, event_type: eventType });
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

    if (url.pathname === "/api/contact/create" && request.method === "POST") {
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

          const name = getField('name');
          const emailRaw = getField('email');
          const email = normalizeOptionalEmail(emailRaw);
          const phone = getField('phone');
          const subject = getField('subject');
          const message = getField('message');

          if (!name || !message) {
            return Response.json({ ok: false, code: 'validation_failed', message: 'Name and message are required.' }, { status: 400 });
          }

          if (emailRaw && !email) {
            return Response.json({ ok: false, code: 'validation_failed', message: 'Please provide a valid email address.' }, { status: 400 });
          }

          const now = new Date().toISOString();
          const contactId = `contact_${companyId}_${Date.now()}`;

          await env.DB.prepare(`
            INSERT INTO contacts (
              id, company_id, name, email, phone, subject, message,
              is_meaningful, summary, status, pushed_to_gmail,
              submitted_at, processed_at, processed_by, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            contactId,
            companyId,
            name,
            email || null,
            phone || null,
            subject || null,
            message,
            1,
            null,
            'new',
            0,
            now,
            null,
            null,
            'website_master_public_form'
          ).run();

          return Response.json({
            ok: true,
            contactId,
            message: 'Message received.'
          });
        } catch (e) {
          return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
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
        const programModeRaw = getField('program_mode');
        const notesRaw = getField('x_studio_notes');
        const membershipTypeRaw = getField('x_studio_membership_type');
        const requestedMembershipProgram = resolveRequestedMembershipProgram({
          membershipTypeRaw,
          programModeRaw,
          founderTermsAccepted,
          kcTermsAccepted,
          notesRaw,
          requestedPathIsKc: url.pathname === '/api/kc/register'
        });
        const founderTermsFlag = requestedMembershipProgram.founderTermsFlag;
        const kcTermsFlag = requestedMembershipProgram.kcTermsFlag;
        const notes = requestedMembershipProgram.notes;

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
        const shouldSendFreshOtp = !skipRegisterSyncForTestException || isPendingRegistration;

        const otpCode = generateOtpCode();
        if (shouldSendFreshOtp) {
          await upsertFounderOtpRecord(env, companyId, phone, otpCode, now);
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

    if (url.pathname.match(/^\/api\/contacts\/([^/]+)\/push$/) && request.method === "POST") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const routeMatch = url.pathname.match(/^\/api\/contacts\/([^/]+)\/push$/);
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

    if (url.pathname === "/api/admin/domain-upgrade/request" && request.method === "POST") {
      return runTenantRoute(async ({ companyId }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const pin = String(body?.pin || '').trim();
          const auth = await authorizeAdminByPin(env, companyId, pin);
          if (!auth.ok) {
            return Response.json({ ok: false, error: auth.error }, { status: auth.status });
          }

          const result = await createCustomDomainUpgradeRequest(env, {
            companyId,
            requestedDomain: body?.requestedDomain,
            registrationMode: body?.registrationMode,
            requestNote: body?.requestNote,
            actorId: String(auth.staff.name || auth.staff.id || 'tenant-admin')
          });
          if (!result.ok) {
            return Response.json({ ok: false, code: result.code, error: result.error }, { status: result.status || 500 });
          }

          return Response.json({ ok: true, request: result.request });
        } catch (e) {
          return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
      });
    }

    if (url.pathname === "/api/admin/domain-upgrade/mark-dns-ready" && request.method === "POST") {
      return runTenantRoute(async ({ companyId }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const pin = String(body?.pin || '').trim();
          const auth = await authorizeAdminByPin(env, companyId, pin);
          if (!auth.ok) {
            return Response.json({ ok: false, error: auth.error }, { status: auth.status });
          }

          const latestRequest = await getLatestCustomDomainRequest(env, companyId);
          if (!latestRequest?.id) {
            return Response.json({ ok: false, error: 'No custom-domain request found.' }, { status: 404 });
          }
          if (String(latestRequest.request_status || '') !== 'approved_waiting_dns') {
            return Response.json({ ok: false, error: 'DNS can only be marked ready after operator approval.' }, { status: 409 });
          }

          const updatedRequest = await updateCustomDomainRequestState(env, latestRequest.id, {
            requestStatus: 'verification_pending',
            dnsReadyAt: new Date().toISOString(),
            eventType: 'dns_marked_ready',
            actorType: 'tenant_admin',
            actorId: String(auth.staff.name || auth.staff.id || 'tenant-admin'),
            eventNote: 'Tenant reported DNS is configured and ready for verification.'
          });

          return Response.json({ ok: true, request: updatedRequest });
        } catch (e) {
          return Response.json({ ok: false, error: e.message }, { status: 500 });
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
        const platformPricingSettings = await getPlatformMarketingSettings(env);

        if (company) {
          if (!callerIsAdmin) {
            return Response.json({ success: false, error: 'Only admin role can update company profile.' }, { status: 403 });
          }

          const existingCompany = await getCompanyProfile(env, companyId);
          const hasExplicitSubdomain = Object.prototype.hasOwnProperty.call(company, 'subdomain');
          let requestedSubdomain = '';
          if (hasExplicitSubdomain) {
            requestedSubdomain = normalizeTenantSubdomain(company.subdomain);
          } else {
            requestedSubdomain = normalizeTenantSubdomain(existingCompany?.subdomain);
          }

          const subdomainPolicy = await evaluateSubdomainPolicy(env, requestedSubdomain, {
            companyId,
            allowEmpty: true
          });

          if (requestedSubdomain && subdomainPolicy.reasonCodes.includes('subdomain_invalid_syntax')) {
            return Response.json({
              success: false,
              error: 'Tenant subdomain must be 1-63 chars, lowercase letters/numbers, and may include hyphens.'
            }, { status: 400 });
          }

          if (requestedSubdomain && subdomainPolicy.decision !== 'allow') {
            return Response.json({
              success: false,
              error: subdomainPolicy.message,
              reason_codes: subdomainPolicy.reasonCodes,
              suggestions: subdomainPolicy.suggestions
            }, { status: 409 });
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

          const previousSubdomain = normalizeTenantSubdomain(existingCompany?.subdomain);
          if (requestedSubdomain) {
            await upsertSubdomainReservation(env, requestedSubdomain, companyId, 'reserved', 'active_company_slug', 'tenant-admin');
          }
          if (previousSubdomain && previousSubdomain !== requestedSubdomain) {
            await upsertSubdomainReservation(env, previousSubdomain, companyId, 'quarantine', 'previous_company_slug', 'tenant-admin');
          }
        }

        const normalizedOperationalSettings = { ...operationalSettings };
        if (callerIsAdmin) {
          const allowedMethods = getEnabledPlatformPaymentMethods(platformPricingSettings);
          if ('accepted_payment_methods_json' in normalizedOperationalSettings) {
            normalizedOperationalSettings.accepted_payment_methods_json = JSON.stringify(
              parseAcceptedPaymentMethods(normalizedOperationalSettings.accepted_payment_methods_json)
                .filter((method) => allowedMethods.includes(method))
            );
          }
          if ('demo_payment_method' in normalizedOperationalSettings) {
            normalizedOperationalSettings.demo_payment_method = normalizeDemoPaymentMethodForPlatform(
              normalizedOperationalSettings.demo_payment_method,
              platformPricingSettings,
              'bankcard'
            );
          }
        }

        for (const key of OPERATIONAL_SETTING_KEYS) {
          if (!(key in normalizedOperationalSettings)) continue;
          if (!callerIsAdmin && !MANAGER_EDITABLE_OPERATIONAL_SETTING_KEYS.has(key)) continue;

          await upsertSettingValue(
            env,
            companyId,
            key,
            String(normalizedOperationalSettings[key] ?? '').trim(),
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

    if (url.pathname === "/api/admin/website/publish" && request.method === "POST") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const body = await request.json().catch(() => ({}));
        const pin = String(body?.pin || '').trim();
        const reviewNote = String(body?.reviewNote || body?.note || '').trim();
        const auth = await authorizeAdminByPin(env, companyId, pin);

        if (!auth.ok) {
          return Response.json({ ok: false, error: auth.error }, { status: auth.status });
        }

        const [source, company, operationalSettings] = await Promise.all([
          buildPublicWebsitePayload(env, companyId, url),
          getCompanyProfile(env, companyId),
          getOperationalSettingsMap(env, companyId)
        ]);
        const slugDecision = await evaluateSubdomainPolicy(env, company?.subdomain || '', { companyId, allowEmpty: true });
        const contentDecision = reviewWebsitePayload(source);
        const combinedReasonCodes = Array.from(new Set([
          ...slugDecision.reasonCodes,
          ...contentDecision.reasonCodes
        ]));

        let decision = slugDecision.decision;
        if (contentDecision.decision === 'block') {
          decision = 'block';
        } else if (contentDecision.decision === 'review') {
          decision = pickStrongerDecision(decision, 'review');
        }

        const riskScore = Math.max(0, Number(company?.risk_score || 0)) + Number(contentDecision.riskScore || 0);
        const reviewId = crypto.randomUUID();
        const now = new Date().toISOString();
        const reviewStatus = decision === 'allow' ? 'approved' : 'pending';
        const websiteStatus = decision === 'allow' ? 'published' : decision === 'review' ? 'review' : 'draft';
        const previewUrl = `${url.origin}/website-master/index.html?company_id=${companyId}`;
        const publishedUrl = decision === 'allow' ? buildPublishedWebsiteUrlForCompany(company, operationalSettings) : '';
        const reviewLinks = buildPlatformReviewLinks(url.origin, reviewId, companyId);

        await env.DB.prepare(`
          INSERT INTO publish_reviews (
            id, company_id, website_version_id, host, subdomain, decision, review_status, risk_score,
            reason_codes_json, evidence_json, payload_snapshot_json, reviewer_type, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'system', ?, ?)
        `).bind(
          reviewId,
          companyId,
          null,
          company?.subdomain ? `${company.subdomain}.${PLATFORM_PUBLIC_DOMAIN}` : '',
          String(company?.subdomain || '').trim(),
          decision,
          reviewStatus,
          riskScore,
          JSON.stringify(combinedReasonCodes),
          JSON.stringify({
            slug_decision: slugDecision.decision,
            content_decision: contentDecision.decision,
            preview_url: previewUrl
          }),
          JSON.stringify(source),
          now,
          now
        ).run();

        await env.DB.prepare(`
          UPDATE companies
          SET website_status = ?, risk_score = ?, last_reviewed_at = ?, updated_at = ?
          WHERE id = ?
        `).bind(websiteStatus, riskScore, now, now, companyId).run();

        const releaseStatus = decision === 'allow' ? 'published' : decision === 'review' ? 'pending_review' : 'rejected';
        await createWebsiteRelease(env, {
          companyId,
          reviewId,
          releaseStatus,
          publishTarget: String(operationalSettings.custom_domain || '').trim() ? 'custom_domain' : 'managed_subdomain',
          previewUrl,
          publishedUrl,
          payloadSnapshotJson: JSON.stringify(source),
          reasonCodes: combinedReasonCodes,
          releaseNote: reviewNote || (decision === 'allow' ? 'Auto-approved publish' : 'Awaiting moderation review'),
          reviewerType: 'system',
          reviewerId: 'publish-gate',
          publishedAt: decision === 'allow' ? now : null
        });

        if (decision !== 'allow') {
          await sendTelegramReviewAlert(env, {
            eventType: 'website_publish_review',
            companyId,
            companyName: company?.name || '',
            host: company?.subdomain ? `${company.subdomain}.${PLATFORM_PUBLIC_DOMAIN}` : '',
            decision,
            riskScore,
            reasonCodes: combinedReasonCodes,
            previewUrl,
            reviewId,
            reviewUrl: reviewLinks.reviewUrl,
            tenantAdminUrl: reviewLinks.tenantAdminUrl
          }).catch((error) => {
            console.error('telegram_review_alert_failed', error);
          });
        }

        return Response.json({
          ok: true,
          review_id: reviewId,
          decision,
          website_status: websiteStatus,
          risk_score: riskScore,
          reason_codes: combinedReasonCodes,
          preview_url: previewUrl,
          published_url: publishedUrl,
          release_status: releaseStatus
        });
        } catch (e) {
          console.error('Admin website publish POST error:', e);
          return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
      });
    }

    if (url.pathname.match(/^\/api\/admin\/website\/releases\/([^/]+)\/rollback$/) && request.method === "POST") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const routeMatch = url.pathname.match(/^\/api\/admin\/website\/releases\/([^/]+)\/rollback$/);
        const releaseId = decodeURIComponent(String(routeMatch?.[1] || '')).trim();
        const body = await request.json().catch(() => ({}));
        const pin = String(body?.pin || '').trim();
        const rollbackNote = String(body?.rollbackNote || body?.note || '').trim();
        const auth = await authorizeAdminByPin(env, companyId, pin);

        if (!auth.ok) {
          return Response.json({ ok: false, error: auth.error }, { status: auth.status });
        }

        if (!releaseId) {
          return Response.json({ ok: false, error: 'Release id is required' }, { status: 400 });
        }

        const targetRelease = await env.DB.prepare(`
          SELECT id, company_id, review_id, release_status, publish_target, preview_url, published_url,
                 payload_snapshot_json, reason_codes_json, release_note, reviewer_type, reviewer_id,
                 published_at, suspended_at, created_at, updated_at
          FROM website_releases
          WHERE id = ? AND company_id = ?
          LIMIT 1
        `).bind(releaseId, companyId).first();

        if (!targetRelease) {
          return Response.json({ ok: false, error: 'Release not found' }, { status: 404 });
        }

        const snapshot = parseWebsiteReleaseSnapshot(targetRelease);
        if (!snapshot) {
          return Response.json({ ok: false, error: 'Release snapshot is missing' }, { status: 409 });
        }

        const now = new Date().toISOString();
        const rollbackRelease = await createWebsiteRelease(env, {
          companyId,
          reviewId: targetRelease.review_id || null,
          releaseStatus: 'published',
          publishTarget: String(targetRelease.publish_target || 'managed_subdomain').trim(),
          previewUrl: String(targetRelease.preview_url || '').trim(),
          publishedUrl: String(targetRelease.published_url || '').trim(),
          payloadSnapshotJson: JSON.stringify(snapshot),
          reasonCodes: ['rollback_restore'],
          releaseNote: rollbackNote || `Rollback restore from release ${targetRelease.id}`,
          reviewerType: 'tenant_admin',
          reviewerId: String(auth.staff.name || auth.staff.id || 'admin'),
          publishedAt: now
        });

        await updateCompanyWebsiteState(env, companyId, {
          websiteStatus: 'published',
          trustState: 'trusted',
          suspendedReason: null,
          suspendedAt: null,
          lastReviewedAt: now
        });

        return Response.json({
          ok: true,
          action: 'rollback',
          release_id: rollbackRelease?.id || '',
          restored_from_release_id: targetRelease.id,
          release_status: 'published'
        });
        } catch (e) {
          console.error('Admin website release rollback POST error:', e);
          return Response.json({ ok: false, error: e.message }, { status: 500 });
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
    if (url.pathname.match(/^\/api\/bookings\/([^/]+)\/stage$/) && request.method === "POST") {
      return runTenantRoute(async ({ companyId }) => {
        try {
        const bookingId = url.pathname.match(/^\/api\/bookings\/([^/]+)\/stage$/)[1];
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
          `SELECT stage FROM bookings WHERE id = ? AND company_id = ?`
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

          syncBookingStageToBoard(env, {
            bookingId, companyId, newStage: 'pending', changedAt: now
          }).catch(() => {});

          if (sseClients.has(companyId)) {
            const booking = {
              id: bookingId, contact_name: name, phone,
              email: email || null, guests_pax: pax, booking_date: date,
              booking_time: time, area, flag: flag || null, source: 'onsite',
              stage: 'pending'
            };
            for (const client of sseClients.get(companyId)) {
              try { client.send('booking', booking); } catch {
                sseClients.get(companyId).delete(client);
              }
            }
          }

          return Response.json({ ok: true, bookingId });
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
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(processManagedDomainRenewalReminders(env, {
      actorId: `cron:${String(controller?.cron || 'scheduled').trim() || 'scheduled'}`
    }));
  }
};
