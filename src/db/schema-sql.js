// D1 Schema as SQL string (cleaned, no comments between statements)
export const sql = `
CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  billing_email TEXT,
  phone TEXT,
  odoo_url TEXT,
  odoo_db_name TEXT,
  is_active BOOLEAN DEFAULT 1,
  timezone TEXT DEFAULT 'UTC',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY,
  organization_id INTEGER,
  subdomain TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  odoo_company_id INTEGER,
  odoo_url TEXT,
  odoo_api_token TEXT,
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  twilio_phone TEXT,
  is_active BOOLEAN DEFAULT 1,
  timezone TEXT DEFAULT 'UTC',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS organization_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT,
  updated_by TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  UNIQUE(organization_id, key)
);

CREATE TABLE IF NOT EXISTS organization_secrets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  iv TEXT NOT NULL,
  algorithm TEXT DEFAULT 'AES-GCM',
  updated_at TEXT,
  updated_by TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  UNIQUE(organization_id, key)
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  founder_status TEXT DEFAULT 'none',
  founder_level TEXT DEFAULT 'trial',
  founder_terms_accepted BOOLEAN DEFAULT 0,
  kc_terms_accepted BOOLEAN DEFAULT 0,
  otp_verified BOOLEAN DEFAULT 0,
  sms_opt_in BOOLEAN DEFAULT 1,
  opt_in_text TEXT,
  opt_in_timestamp TEXT,
  odoo_register_sync_state TEXT DEFAULT 'pending',
  odoo_register_sync_error TEXT,
  odoo_register_synced_at TEXT,
  odoo_register_sync_attempts INTEGER DEFAULT 0,
  number_of_visits INTEGER DEFAULT 0,
  last_visit TEXT,
  last_reminder_date TEXT,
  total_spent REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT DEFAULT 'system',
  updated_by TEXT DEFAULT 'system',
  notes TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  UNIQUE(company_id, phone)
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  customer_id TEXT,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  guests_pax INTEGER NOT NULL,
  booking_date TEXT NOT NULL,
  booking_time TEXT NOT NULL,
  booking_datetime TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 120,
  area TEXT NOT NULL,
  stage TEXT NOT NULL,
  stage_id INTEGER,
  flag TEXT,
  notes TEXT,
  chat_id TEXT,
  message_id TEXT,
  odoo_lead_id TEXT,
  source TEXT,
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT DEFAULT 'system',
  updated_by TEXT DEFAULT 'system',
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS booking_actions (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  booking_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  old_stage TEXT,
  new_stage TEXT,
  changed_by TEXT NOT NULL,
  user_role TEXT,
  changed_at TEXT NOT NULL,
  change_reason TEXT,
  metadata TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  is_meaningful BOOLEAN DEFAULT 1,
  summary TEXT,
  status TEXT DEFAULT 'new',
  pushed_to_gmail BOOLEAN DEFAULT 0,
  submitted_at TEXT NOT NULL,
  processed_at TEXT,
  processed_by TEXT,
  notes TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  pin TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  last_login TEXT,
  permissions TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  UNIQUE(company_id, pin)
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT,
  updated_by TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  UNIQUE(company_id, key)
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  alt_text TEXT,
  media_type TEXT NOT NULL DEFAULT 'image',
  mime_type TEXT NOT NULL,
  data_url TEXT NOT NULL,
  tags TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS otp_cache (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_attempt TEXT,
  verified BOOLEAN DEFAULT 0,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  UNIQUE(company_id, phone)
);

CREATE TABLE IF NOT EXISTS telegram_messages (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  booking_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  current_stage TEXT,
  last_updated TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_org ON companies(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_settings_org ON organization_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_secrets_org ON organization_secrets(organization_id);
CREATE INDEX IF NOT EXISTS idx_bookings_company ON bookings(company_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(company_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_stage ON bookings(company_id, stage);
CREATE INDEX IF NOT EXISTS idx_booking_actions_company ON booking_actions(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_staff_company ON staff(company_id);
CREATE INDEX IF NOT EXISTS idx_settings_company ON settings(company_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_company ON media_assets(company_id);
CREATE INDEX IF NOT EXISTS idx_otp_company ON otp_cache(company_id);
CREATE INDEX IF NOT EXISTS idx_telegram_company ON telegram_messages(company_id);
`;
