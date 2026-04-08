// D1 Database initialization & setup (Multi-Tenant)
import { sql } from './schema-sql';

async function ensureColumn(db, tableName, columnName, columnDefinition) {
  try {
    const info = await db.prepare(`PRAGMA table_info(${tableName})`).all();
    const rows = info?.results || [];
    const exists = rows.some(row => String(row.name || '').toLowerCase() === String(columnName).toLowerCase());

    if (!exists) {
      await db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`).run();
    }
  } catch (error) {
    console.warn(`Schema evolution skipped for ${tableName}.${columnName}:`, error.message);
  }
}

async function ensureSchemaEvolution(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS payment_events (
      id TEXT PRIMARY KEY,
      signup_id TEXT,
      company_id INTEGER,
      payment_reference TEXT,
      payment_method TEXT,
      payment_status TEXT,
      event_type TEXT NOT NULL,
      event_source TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (signup_id) REFERENCES platform_signups(id),
      FOREIGN KEY (company_id) REFERENCES companies(id)
    )
  `).run();
  await ensureColumn(db, 'companies', 'organization_id', 'INTEGER');
  await ensureColumn(db, 'companies', 'subdomain_status', "TEXT DEFAULT 'active'");
  await ensureColumn(db, 'companies', 'website_status', "TEXT DEFAULT 'draft'");
  await ensureColumn(db, 'companies', 'trust_state', "TEXT DEFAULT 'pending_verification'");
  await ensureColumn(db, 'companies', 'risk_score', 'INTEGER DEFAULT 0');
  await ensureColumn(db, 'companies', 'suspended_reason', 'TEXT');
  await ensureColumn(db, 'companies', 'suspended_at', 'TEXT');
  await ensureColumn(db, 'companies', 'last_reviewed_at', 'TEXT');
  await ensureColumn(db, 'customers', 'odoo_register_sync_state', "TEXT DEFAULT 'pending'");
  await ensureColumn(db, 'customers', 'odoo_register_sync_error', 'TEXT');
  await ensureColumn(db, 'customers', 'odoo_register_synced_at', 'TEXT');
  await ensureColumn(db, 'customers', 'odoo_register_sync_attempts', 'INTEGER DEFAULT 0');
  await ensureColumn(db, 'platform_signups', 'payment_method', 'TEXT');
  await ensureColumn(db, 'platform_signups', 'payment_reference', 'TEXT');
  await ensureColumn(db, 'platform_signups', 'payment_confirmed_at', 'TEXT');
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_payment_events_signup ON payment_events(signup_id, created_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_payment_events_company ON payment_events(company_id, created_at)`).run();
}

/**
 * Initialize D1 database with schema and seed data
 * Run once on first deployment, then idempotent
 */
export async function initializeDatabase(db) {
  try {
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    const setupStatements = statements.filter(stmt => /^(CREATE TABLE|INSERT)/i.test(stmt));
    const indexStatements = statements.filter(stmt => /^CREATE INDEX/i.test(stmt));

    for (const statement of setupStatements) {
      try {
        await db.prepare(statement + ';').run();
      } catch (e) {
        if (!e.message?.toLowerCase().includes('already exists')) {
          console.warn('Statement error (non-fatal):', statement.substring(0, 40), e.message);
        }
      }
    }

    await ensureSchemaEvolution(db);

    for (const statement of indexStatements) {
      try {
        await db.prepare(statement + ';').run();
      } catch (e) {
        if (!e.message?.toLowerCase().includes('already exists')) {
          console.warn('Index creation error (non-fatal):', statement.substring(0, 40), e.message);
        }
      }
    }

    const nowIso = new Date().toISOString();

    const organizationsCount = await db
      .prepare('SELECT COUNT(*) as count FROM organizations')
      .first();

    if (organizationsCount.count === 0) {
      const defaultOrganizations = [
        {
          id: 1,
          slug: 'esskultur-group-1',
          name: 'ESSKULTUR Group 1',
          billing_email: 'billing@restaurant1.quan-esskultur.de',
          phone: '+49301234567',
          odoo_url: 'https://hais-lab.odoo.com',
          odoo_db_name: 'esskultur_group_1',
          timezone: 'Europe/Berlin'
        },
        {
          id: 2,
          slug: 'esskultur-group-2',
          name: 'ESSKULTUR Group 2',
          billing_email: 'billing@restaurant2.quan-esskultur.de',
          phone: '+49307654321',
          odoo_url: 'https://hais-lab.odoo.com',
          odoo_db_name: 'esskultur_group_2',
          timezone: 'Europe/Berlin'
        }
      ];

      for (const org of defaultOrganizations) {
        await db.prepare(`
          INSERT INTO organizations
          (id, slug, name, billing_email, phone, odoo_url, odoo_db_name, timezone, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          org.id,
          org.slug,
          org.name,
          org.billing_email,
          org.phone,
          org.odoo_url,
          org.odoo_db_name,
          org.timezone,
          nowIso,
          nowIso
        ).run();
      }
    }
    
    // Add default companies if not exist
    const companiesCount = await db
      .prepare('SELECT COUNT(*) as count FROM companies')
      .first();
    
    if (companiesCount.count === 0) {
      const defaultCompanies = [
        {
          id: 1,
          organization_id: 1,
          subdomain: 'restaurant1',
          name: 'ESSKULTUR Restaurant 1',
          email: 'info@restaurant1.quan-esskultur.de',
          phone: '+49301234567',
          odoo_company_id: 1,
          odoo_url: 'https://hais-lab.odoo.com',
          timezone: 'Europe/Berlin'
        },
        {
          id: 2,
          organization_id: 2,
          subdomain: 'restaurant2',
          name: 'ESSKULTUR Restaurant 2',
          email: 'info@restaurant2.quan-esskultur.de',
          phone: '+49307654321',
          odoo_company_id: 2,
          odoo_url: 'https://hais-lab.odoo.com',
          timezone: 'Europe/Berlin'
        }
      ];
      
      for (const company of defaultCompanies) {
        await db
          .prepare(`
            INSERT INTO companies 
            (id, organization_id, subdomain, subdomain_status, website_status, trust_state, risk_score, name, email, phone, odoo_company_id, odoo_url, timezone, created_at, updated_at)
            VALUES (?, ?, ?, 'active', 'published', 'trusted', 0, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            company.id, company.organization_id, company.subdomain, company.name, company.email, company.phone,
            company.odoo_company_id, company.odoo_url, company.timezone,
            new Date().toISOString(), new Date().toISOString()
          )
          .run();

        await db.prepare(`
          INSERT OR IGNORE INTO subdomain_reservations
          (id, slug, normalized_slug, company_id, status, reason_code, decision_source, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'reserved', 'active_company_slug', 'seed', ?, ?)
        `).bind(
          `reservation_${company.subdomain}`,
          company.subdomain,
          String(company.subdomain || '').trim().toLowerCase(),
          company.id,
          nowIso,
          nowIso
        ).run();

        await db.prepare(`
          UPDATE subdomain_reservations
          SET company_id = ?,
              reason_code = 'active_company_slug',
              decision_source = 'seed',
              updated_at = ?
          WHERE normalized_slug = ? AND status = 'reserved'
        `).bind(
          company.id,
          nowIso,
          String(company.subdomain || '').trim().toLowerCase()
        ).run();
      }
    }

    await db.prepare(`
      UPDATE companies
      SET organization_id = id
      WHERE organization_id IS NULL
    `).run();

    const defaultOrganizationSettings = [
      { organization_id: 1, key: 'default_business_hours_open', value: '10:00', description: 'Organization default opening hour' },
      { organization_id: 1, key: 'default_business_hours_close', value: '22:00', description: 'Organization default closing hour' },
      { organization_id: 1, key: 'default_closed_weekday', value: '1', description: 'Organization default closed weekday' },
      { organization_id: 1, key: 'default_min_booking_advance_min', value: '15', description: 'Organization default minimum advance booking time' },
      { organization_id: 1, key: 'default_booking_duration', value: '120', description: 'Organization default booking duration' },
      { organization_id: 1, key: 'default_standard_contact_link', value: '/contact', description: 'Organization default contact fallback link' },
      { organization_id: 1, key: 'default_area_capacity_indoor', value: '12', description: 'Organization default indoor capacity' },
      { organization_id: 1, key: 'default_area_capacity_outdoor', value: '10', description: 'Organization default outdoor capacity' },
      { organization_id: 1, key: 'default_area_capacity_garden', value: '8', description: 'Organization default garden capacity' },
      { organization_id: 1, key: 'default_area_capacity_bar', value: '6', description: 'Organization default bar capacity' },
      { organization_id: 1, key: 'module_membership_management', value: 'enabled', description: 'Organization default: membership management' },
      { organization_id: 1, key: 'module_marketing_management', value: 'disabled', description: 'Organization default: marketing management' },
      { organization_id: 1, key: 'module_booking_management', value: 'enabled', description: 'Organization default: booking management' },
      { organization_id: 1, key: 'module_digital_management', value: 'disabled', description: 'Organization default: SEO/hosting/domain management' },
      { organization_id: 1, key: 'module_founder_program', value: 'enabled', description: 'Organization default: founder / club onboarding' },
      { organization_id: 1, key: 'module_loyalty_rewards', value: 'disabled', description: 'Organization default: loyalty and rewards' },
      { organization_id: 1, key: 'module_contact_crm', value: 'enabled', description: 'Organization default: contact CRM workflows' },
      { organization_id: 1, key: 'module_telegram_notifications', value: 'disabled', description: 'Organization default: Telegram notifications' },
      { organization_id: 2, key: 'default_business_hours_open', value: '10:00', description: 'Organization default opening hour' },
      { organization_id: 2, key: 'default_business_hours_close', value: '22:00', description: 'Organization default closing hour' },
      { organization_id: 2, key: 'default_closed_weekday', value: '1', description: 'Organization default closed weekday' },
      { organization_id: 2, key: 'default_min_booking_advance_min', value: '15', description: 'Organization default minimum advance booking time' },
      { organization_id: 2, key: 'default_booking_duration', value: '120', description: 'Organization default booking duration' },
      { organization_id: 2, key: 'default_standard_contact_link', value: '/contact', description: 'Organization default contact fallback link' },
      { organization_id: 2, key: 'default_area_capacity_indoor', value: '12', description: 'Organization default indoor capacity' },
      { organization_id: 2, key: 'default_area_capacity_outdoor', value: '10', description: 'Organization default outdoor capacity' },
      { organization_id: 2, key: 'default_area_capacity_garden', value: '8', description: 'Organization default garden capacity' },
      { organization_id: 2, key: 'default_area_capacity_bar', value: '6', description: 'Organization default bar capacity' },
      { organization_id: 2, key: 'module_membership_management', value: 'enabled', description: 'Organization default: membership management' },
      { organization_id: 2, key: 'module_marketing_management', value: 'disabled', description: 'Organization default: marketing management' },
      { organization_id: 2, key: 'module_booking_management', value: 'enabled', description: 'Organization default: booking management' },
      { organization_id: 2, key: 'module_digital_management', value: 'disabled', description: 'Organization default: SEO/hosting/domain management' },
      { organization_id: 2, key: 'module_founder_program', value: 'enabled', description: 'Organization default: founder / club onboarding' },
      { organization_id: 2, key: 'module_loyalty_rewards', value: 'disabled', description: 'Organization default: loyalty and rewards' },
      { organization_id: 2, key: 'module_contact_crm', value: 'enabled', description: 'Organization default: contact CRM workflows' },
      { organization_id: 2, key: 'module_telegram_notifications', value: 'disabled', description: 'Organization default: Telegram notifications' }
    ];

    for (const setting of defaultOrganizationSettings) {
      await db
        .prepare(`INSERT OR IGNORE INTO organization_settings (organization_id, key, value, description, updated_at) VALUES (?, ?, ?, ?, ?)`)
        .bind(setting.organization_id, setting.key, setting.value, setting.description, nowIso)
        .run();
    }
    
    const defaultSettings = [
      { company_id: 1, key: 'website_url', value: 'https://restaurant1.quan-esskultur.de', description: 'Public website URL' },
      { company_id: 1, key: 'standard_contact_link', value: '/contact', description: 'Fallback contact link when membership module is disabled' },
      { company_id: 1, key: 'booking_email', value: 'booking@restaurant1.quan-esskultur.de', description: 'Booking operations email' },
      { company_id: 1, key: 'founder_program_label', value: 'Founder', description: 'Display name for founder program' },
      { company_id: 1, key: 'kc_program_label', value: 'Kollegensclub', description: 'Display name for KC / colleague club program' },
      { company_id: 1, key: 'founder_membership_type', value: 'Founder', description: 'Membership type for founder flow' },
      { company_id: 1, key: 'kc_membership_type', value: 'KC', description: 'Membership type for KC flow' },
      { company_id: 1, key: 'founder_redirect_link', value: '/welcome-founder', description: 'Post-verification founder redirect path or URL' },
      { company_id: 1, key: 'kc_redirect_link', value: '/colleague-club', description: 'Post-verification KC redirect path or URL' },
      { company_id: 1, key: 'founder_terms_link', value: '/founderpass-terms-conditions', description: 'Founder terms path or URL' },
      { company_id: 1, key: 'kc_terms_link', value: '/founderpass-terms-conditions', description: 'KC terms path or URL' },
      { company_id: 1, key: 'privacy_link', value: '/privacy', description: 'Privacy policy path or URL' },
      { company_id: 1, key: 'area_capacity_indoor', value: '12', description: 'Indoor seating blocks' },
      { company_id: 1, key: 'area_capacity_outdoor', value: '10', description: 'Outdoor seating blocks' },
      { company_id: 1, key: 'area_capacity_garden', value: '8', description: 'Garden seating blocks' },
      { company_id: 1, key: 'area_capacity_bar', value: '6', description: 'Bar seating blocks' },
      { company_id: 1, key: 'business_hours_open', value: '10:00', description: 'Opening hour' },
      { company_id: 1, key: 'business_hours_close', value: '22:00', description: 'Closing hour' },
      { company_id: 1, key: 'closed_weekday', value: '1', description: 'Closed day (0=Sun, 1=Mon)' },
      { company_id: 1, key: 'min_booking_advance_min', value: '15', description: 'Minimum minutes advance for booking' },
      { company_id: 1, key: 'default_booking_duration', value: '120', description: 'Default duration in minutes' },
      { company_id: 1, key: 'odoo_api_token', value: 'YOUR_ODOO_TOKEN_HERE', description: 'Odoo API token' },
      { company_id: 1, key: 'ODOO_BASE_URL', value: 'https://hais-lab.odoo.com', description: 'Odoo base URL (tenant override)' },
      { company_id: 1, key: 'ODOO_DB_NAME', value: '', description: 'Odoo database name for this tenant' },
      { company_id: 1, key: 'ODOO_LOGIN', value: '', description: 'Odoo login/user for this tenant' },
      { company_id: 1, key: 'ODOO_API_TOKEN', value: '', description: 'Odoo API token for this tenant' },
      { company_id: 1, key: 'ODOO_PASSWORD', value: '', description: 'Optional Odoo password for this tenant (prefer API token)' },
      { company_id: 1, key: 'ODOO_TAG_FOUNDER', value: 'Founder', description: 'Tag label for Founder members' },
      { company_id: 1, key: 'ODOO_TAG_FOUNDER_TRIAL', value: 'Founder Trial', description: 'Tag label for Founder Trial members' },
      { company_id: 1, key: 'ODOO_TAG_KC_CLUB', value: 'KC Club', description: 'Tag label for KC Club members' },
      { company_id: 1, key: 'ODOO_TAG_KOLLEGENSCLUB', value: 'Kollegensclub', description: 'Tag label for Kollegensclub members' },
      { company_id: 1, key: 'telegram_chat_id', value: '-5101793550', description: 'Telegram booking board group' },
      { company_id: 1, key: 'FOUNDER_TEST_EXCEPTION_PHONES', value: '+491723855711', description: 'Founder OTP test exception phones' },
      { company_id: 1, key: 'twilio_phone', value: '+49123456789', description: 'Twilio phone for SMS/WhatsApp' },
      { company_id: 1, key: 'module_membership_management', value: 'enabled', description: 'Paid module: membership management' },
      { company_id: 1, key: 'module_marketing_management', value: 'disabled', description: 'Paid module: marketing management' },
      { company_id: 1, key: 'module_booking_management', value: 'enabled', description: 'Product line: booking management' },
      { company_id: 1, key: 'module_digital_management', value: 'disabled', description: 'Product line: SEO/hosting/domain management' },
      { company_id: 1, key: 'module_founder_program', value: 'enabled', description: 'Paid module: founder / club onboarding' },
      { company_id: 1, key: 'module_loyalty_rewards', value: 'disabled', description: 'Paid module: loyalty and rewards' },
      { company_id: 1, key: 'module_contact_crm', value: 'enabled', description: 'Paid module: contact CRM workflows' },
      { company_id: 1, key: 'module_telegram_notifications', value: 'disabled', description: 'Paid module: Telegram notifications' },
      { company_id: 2, key: 'website_url', value: 'https://restaurant2.quan-esskultur.de', description: 'Public website URL' },
      { company_id: 2, key: 'standard_contact_link', value: '/contact', description: 'Fallback contact link when membership module is disabled' },
      { company_id: 2, key: 'booking_email', value: 'booking@restaurant2.quan-esskultur.de', description: 'Booking operations email' },
      { company_id: 2, key: 'founder_program_label', value: 'Founder', description: 'Display name for founder program' },
      { company_id: 2, key: 'kc_program_label', value: 'Kollegensclub', description: 'Display name for KC / colleague club program' },
      { company_id: 2, key: 'founder_membership_type', value: 'Founder', description: 'Membership type for founder flow' },
      { company_id: 2, key: 'kc_membership_type', value: 'KC', description: 'Membership type for KC flow' },
      { company_id: 2, key: 'founder_redirect_link', value: '/welcome-founder', description: 'Post-verification founder redirect path or URL' },
      { company_id: 2, key: 'kc_redirect_link', value: '/colleague-club', description: 'Post-verification KC redirect path or URL' },
      { company_id: 2, key: 'founder_terms_link', value: '/founderpass-terms-conditions', description: 'Founder terms path or URL' },
      { company_id: 2, key: 'kc_terms_link', value: '/founderpass-terms-conditions', description: 'KC terms path or URL' },
      { company_id: 2, key: 'privacy_link', value: '/privacy', description: 'Privacy policy path or URL' },
      { company_id: 2, key: 'area_capacity_indoor', value: '12', description: 'Indoor seating blocks' },
      { company_id: 2, key: 'area_capacity_outdoor', value: '10', description: 'Outdoor seating blocks' },
      { company_id: 2, key: 'area_capacity_garden', value: '8', description: 'Garden seating blocks' },
      { company_id: 2, key: 'area_capacity_bar', value: '6', description: 'Bar seating blocks' },
      { company_id: 2, key: 'business_hours_open', value: '10:00', description: 'Opening hour' },
      { company_id: 2, key: 'business_hours_close', value: '22:00', description: 'Closing hour' },
      { company_id: 2, key: 'closed_weekday', value: '1', description: 'Closed day (0=Sun, 1=Mon)' },
      { company_id: 2, key: 'min_booking_advance_min', value: '15', description: 'Minimum minutes advance for booking' },
      { company_id: 2, key: 'default_booking_duration', value: '120', description: 'Default duration in minutes' },
      { company_id: 2, key: 'ODOO_BASE_URL', value: 'https://hais-lab.odoo.com', description: 'Odoo base URL (tenant override)' },
      { company_id: 2, key: 'ODOO_DB_NAME', value: '', description: 'Odoo database name for this tenant' },
      { company_id: 2, key: 'ODOO_LOGIN', value: '', description: 'Odoo login/user for this tenant' },
      { company_id: 2, key: 'ODOO_API_TOKEN', value: '', description: 'Odoo API token for this tenant' },
      { company_id: 2, key: 'ODOO_PASSWORD', value: '', description: 'Optional Odoo password for this tenant (prefer API token)' },
      { company_id: 2, key: 'ODOO_TAG_FOUNDER', value: 'Founder', description: 'Tag label for Founder members' },
      { company_id: 2, key: 'ODOO_TAG_FOUNDER_TRIAL', value: 'Founder Trial', description: 'Tag label for Founder Trial members' },
      { company_id: 2, key: 'ODOO_TAG_KC_CLUB', value: 'KC Club', description: 'Tag label for KC Club members' },
      { company_id: 2, key: 'ODOO_TAG_KOLLEGENSCLUB', value: 'Kollegensclub', description: 'Tag label for Kollegensclub members' },
      { company_id: 2, key: 'FOUNDER_TEST_EXCEPTION_PHONES', value: '+491723855711', description: 'Founder OTP test exception phones' },
      { company_id: 2, key: 'module_membership_management', value: 'enabled', description: 'Paid module: membership management' },
      { company_id: 2, key: 'module_marketing_management', value: 'disabled', description: 'Paid module: marketing management' },
      { company_id: 2, key: 'module_booking_management', value: 'enabled', description: 'Product line: booking management' },
      { company_id: 2, key: 'module_digital_management', value: 'disabled', description: 'Product line: SEO/hosting/domain management' },
      { company_id: 2, key: 'module_founder_program', value: 'enabled', description: 'Paid module: founder / club onboarding' },
      { company_id: 2, key: 'module_loyalty_rewards', value: 'disabled', description: 'Paid module: loyalty and rewards' },
      { company_id: 2, key: 'module_contact_crm', value: 'enabled', description: 'Paid module: contact CRM workflows' },
      { company_id: 2, key: 'module_telegram_notifications', value: 'disabled', description: 'Paid module: Telegram notifications' }
    ];

    for (const setting of defaultSettings) {
      await db
        .prepare(`INSERT OR IGNORE INTO settings (company_id, key, value, description, updated_at) VALUES (?, ?, ?, ?, ?)`)
        .bind(setting.company_id, setting.key, setting.value, setting.description, new Date().toISOString())
        .run();
    }

    const defaultReservedTerms = [
      { term: 'www', match_type: 'exact', category: 'internal_system', action: 'reserve', notes: 'Root web alias' },
      { term: 'admin', match_type: 'exact', category: 'internal_system', action: 'block', notes: 'Admin host naming' },
      { term: 'api', match_type: 'exact', category: 'internal_system', action: 'block', notes: 'API host naming' },
      { term: 'support', match_type: 'exact', category: 'internal_system', action: 'block', notes: 'Support impersonation risk' },
      { term: 'billing', match_type: 'exact', category: 'internal_system', action: 'block', notes: 'Billing impersonation risk' },
      { term: 'login', match_type: 'exact', category: 'internal_system', action: 'block', notes: 'Login impersonation risk' },
      { term: 'verify', match_type: 'exact', category: 'internal_system', action: 'block', notes: 'Verification impersonation risk' },
      { term: 'secure', match_type: 'exact', category: 'internal_system', action: 'block', notes: 'Security impersonation risk' },
      { term: 'telegram', match_type: 'contains', category: 'scam', action: 'review', notes: 'High-risk outbound channel naming' },
      { term: 'crypto', match_type: 'contains', category: 'scam', action: 'review', notes: 'Crypto scam risk' },
      { term: 'onlyfans', match_type: 'contains', category: 'sexual_explicit', action: 'block', notes: 'Explicit sexual content signal' },
      { term: 'porn', match_type: 'contains', category: 'sexual_explicit', action: 'block', notes: 'Explicit sexual content signal' },
      { term: 'xxx', match_type: 'contains', category: 'sexual_explicit', action: 'block', notes: 'Explicit sexual content signal' },
      { term: 'election', match_type: 'contains', category: 'political_sensitive', action: 'review', notes: 'Political sensitivity review' },
      { term: 'church', match_type: 'contains', category: 'religious_sensitive', action: 'review', notes: 'Religious sensitivity review' }
    ];

    for (const rule of defaultReservedTerms) {
      const normalizedTerm = String(rule.term || '').trim().toLowerCase();
      await db.prepare(`
        INSERT OR IGNORE INTO reserved_terms
        (id, term, normalized_term, match_type, category, action, notes, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).bind(
        `reserved_${normalizedTerm}_${rule.match_type}`,
        rule.term,
        normalizedTerm,
        rule.match_type,
        rule.category,
        rule.action,
        rule.notes,
        nowIso,
        nowIso
      ).run();
    }
    
    // Add default staff if not exist
    const staffCount = await db
      .prepare('SELECT COUNT(*) as count FROM staff')
      .first();
    
    if (staffCount.count === 0) {
      const defaultStaff = [
        // Restaurant 1 staff
        { id: 'staff_1', company_id: 1, name: 'Hostess', pin: '1111', role: 'hostess', permissions: '["view_bookings", "update_stage"]' },
        { id: 'staff_2', company_id: 1, name: 'Manager', pin: '8888', role: 'manager', permissions: '["view_bookings", "update_stage", "view_customers", "manage_staff"]' },
        { id: 'staff_3', company_id: 1, name: 'Admin', pin: '1234', role: 'admin', permissions: '["*"]' },
        // Restaurant 2 staff
        { id: 'staff_4', company_id: 2, name: 'Hostess', pin: '1111', role: 'hostess', permissions: '["view_bookings", "update_stage"]' },
        { id: 'staff_5', company_id: 2, name: 'Manager', pin: '8888', role: 'manager', permissions: '["view_bookings", "update_stage"]' },
        { id: 'staff_6', company_id: 2, name: 'Admin', pin: '1234', role: 'admin', permissions: '["*"]' }
      ];
      
      for (const staff of defaultStaff) {
        await db
          .prepare(`INSERT OR IGNORE INTO staff (id, company_id, name, pin, role, is_active, permissions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`)
          .bind(staff.id, staff.company_id, staff.name, staff.pin, staff.role, staff.permissions, new Date().toISOString(), new Date().toISOString())
          .run();
      }
    }
    
    console.log('✅ D1 database initialized successfully');
    return { success: true, message: 'Database initialized' };
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Seed demo data for testing/demo purposes
 */
export async function seedDemoData(db, companyId = 1) {
  try {
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];
    
    // Demo customer
    await db
      .prepare(`
        INSERT OR IGNORE INTO customers 
        (id, company_id, phone, name, email, founder_status, sms_opt_in, number_of_visits, last_visit, total_spent, created_at, updated_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(`cust_${companyId}_1`, companyId, '+4917123456789', 'Max Müller', 'max@example.com', 'live', 1, 3, today, 250.50, now, now, 'demo')
      .run();
    
    // Demo bookings
    const demoBookings = [
      {
        id: `book_${companyId}_1`,
        company_id: companyId,
        customer_id: `cust_${companyId}_1`,
        contact_name: 'Max Müller',
        phone: '+4917123456789',
        guests_pax: 4,
        booking_date: today,
        booking_time: '19:00',
        booking_datetime: `${today} 19:00`,
        duration_minutes: 120,
        area: 'indoor',
        stage: 'confirmed',
        stage_id: 2,
        flag: 'vip',
        source: 'web',
        submitted_at: now,
        updated_at: now
      },
      {
        id: `book_${companyId}_2`,
        company_id: companyId,
        customer_id: `cust_${companyId}_1`,
        contact_name: 'Anna Schmidt',
        phone: '+4917198765432',
        guests_pax: 2,
        booking_date: today,
        booking_time: '20:30',
        booking_datetime: `${today} 20:30`,
        duration_minutes: 120,
        area: 'outdoor',
        stage: 'pending',
        stage_id: 1,
        flag: '',
        source: 'web',
        submitted_at: now,
        updated_at: now
      }
    ];
    
    for (const booking of demoBookings) {
      await db
        .prepare(`
          INSERT OR IGNORE INTO bookings 
          (id, company_id, customer_id, contact_name, phone, guests_pax, booking_date, booking_time, booking_datetime, duration_minutes, area, stage, stage_id, flag, source, submitted_at, updated_at, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          booking.id, booking.company_id, booking.customer_id, booking.contact_name, booking.phone, booking.guests_pax,
          booking.booking_date, booking.booking_time, booking.booking_datetime, booking.duration_minutes,
          booking.area, booking.stage, booking.stage_id, booking.flag, booking.source,
          booking.submitted_at, booking.updated_at, 'demo'
        )
        .run();
    }
    
    // Demo contact
    await db
      .prepare(`
        INSERT OR IGNORE INTO contacts 
        (id, company_id, name, email, phone, subject, message, is_meaningful, summary, status, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(`cont_${companyId}_1`, companyId, 'Lisa Weber', 'lisa@example.com', '+4917144332211', 'Anfrage zur Gruppen-Reservierung', 'Wir möchten einen Tisch für 12 Personen am Samstag reservieren. Haben Sie Platz?', 1, 'Gruppenreservierung anfrage für 12 Personen', 'new', now)
      .run();
    
    console.log(`✅ Demo data seeded for company ${companyId}`);
    return { success: true, message: 'Demo data seeded' };
  } catch (error) {
    console.error('❌ Demo data seeding failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get system statistics (optionally filtered by company)
 */
export async function getSystemStats(db, companyId = null) {
  try {
    const filter = companyId ? `WHERE company_id = ${companyId}` : '';
    
    const stats = {
      bookings_total: await db.prepare(`SELECT COUNT(*) as count FROM bookings ${filter}`).first(),
      bookings_pending: await db.prepare(`SELECT COUNT(*) as count FROM bookings ${filter} AND stage = "pending"`).first(),
      bookings_confirmed: await db.prepare(`SELECT COUNT(*) as count FROM bookings ${filter} AND stage = "confirmed"`).first(),
      customers_total: await db.prepare(`SELECT COUNT(*) as count FROM customers ${filter}`).first(),
      customers_founder: await db.prepare(`SELECT COUNT(*) as count FROM customers ${filter} AND founder_status = "live"`).first(),
      contacts_new: await db.prepare(`SELECT COUNT(*) as count FROM contacts ${filter} AND status = "new"`).first(),
      staff_total: await db.prepare(`SELECT COUNT(*) as count FROM staff ${filter} AND is_active = 1`).first()
    };
    return stats;
  } catch (error) {
    console.error('Error fetching stats:', error);
    return null;
  }
}
