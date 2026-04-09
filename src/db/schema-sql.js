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
  subdomain_status TEXT DEFAULT 'active',
  website_status TEXT DEFAULT 'draft',
  trust_state TEXT DEFAULT 'pending_verification',
  risk_score INTEGER DEFAULT 0,
  suspended_reason TEXT,
  suspended_at TEXT,
  last_reviewed_at TEXT,
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

CREATE TABLE IF NOT EXISTS platform_contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  status TEXT DEFAULT 'new'
);

CREATE TABLE IF NOT EXISTS platform_signups (
  id TEXT PRIMARY KEY,
  company_id INTEGER,
  organization_id INTEGER,
  restaurant_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  owner_phone TEXT,
  subdomain TEXT NOT NULL,
  plan TEXT NOT NULL,
  website_template TEXT,
  staff_users INTEGER DEFAULT 1,
  country TEXT,
  payment_status TEXT DEFAULT 'demo_paid',
  payment_method TEXT,
  payment_reference TEXT,
  payment_confirmed_at TEXT,
  due_today_eur REAL DEFAULT 0,
  recurring_monthly_eur REAL DEFAULT 0,
  follow_up_status TEXT DEFAULT 'new',
  follow_up_note TEXT,
  followed_up_at TEXT,
  raw_payload_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

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
);

CREATE TABLE IF NOT EXISTS custom_domain_requests (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  organization_id INTEGER,
  requested_domain TEXT NOT NULL,
  registration_mode TEXT DEFAULT 'byod',
  request_status TEXT DEFAULT 'requested',
  dns_record_type TEXT DEFAULT 'CNAME',
  dns_name TEXT,
  dns_value TEXT,
  request_note TEXT,
  operator_note TEXT,
  renewal_mode TEXT DEFAULT 'external',
  approved_at TEXT,
  approved_by TEXT,
  dns_ready_at TEXT,
  verified_at TEXT,
  activated_at TEXT,
  activated_by TEXT,
  rejected_at TEXT,
  rejected_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS custom_domain_request_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  company_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  request_status TEXT,
  actor_type TEXT,
  actor_id TEXT,
  note TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (request_id) REFERENCES custom_domain_requests(id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
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

CREATE TABLE IF NOT EXISTS reserved_terms (
  id TEXT PRIMARY KEY,
  term TEXT NOT NULL,
  normalized_term TEXT NOT NULL,
  match_type TEXT NOT NULL,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subdomain_reservations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  normalized_slug TEXT NOT NULL,
  company_id INTEGER,
  status TEXT NOT NULL,
  reason_code TEXT,
  decision_source TEXT DEFAULT 'system',
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS publish_reviews (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  website_version_id TEXT,
  host TEXT,
  subdomain TEXT,
  decision TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending',
  risk_score INTEGER DEFAULT 0,
  reason_codes_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  payload_snapshot_json TEXT,
  reviewer_type TEXT NOT NULL DEFAULT 'system',
  reviewer_id TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS website_releases (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL,
  review_id TEXT,
  release_status TEXT NOT NULL DEFAULT 'draft',
  publish_target TEXT NOT NULL DEFAULT 'managed_subdomain',
  preview_url TEXT,
  published_url TEXT,
  payload_snapshot_json TEXT,
  reason_codes_json TEXT NOT NULL DEFAULT '[]',
  release_note TEXT,
  reviewer_type TEXT,
  reviewer_id TEXT,
  published_at TEXT,
  suspended_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (review_id) REFERENCES publish_reviews(id)
);

CREATE TABLE IF NOT EXISTS abuse_reports (
  id TEXT PRIMARY KEY,
  company_id INTEGER,
  host TEXT NOT NULL,
  report_type TEXT NOT NULL,
  report_payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_org ON companies(organization_id);
CREATE INDEX IF NOT EXISTS idx_companies_subdomain_status ON companies(subdomain_status, website_status, trust_state);
CREATE INDEX IF NOT EXISTS idx_org_settings_org ON organization_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_secrets_org ON organization_secrets(organization_id);
CREATE INDEX IF NOT EXISTS idx_bookings_company ON bookings(company_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(company_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_stage ON bookings(company_id, stage);
CREATE INDEX IF NOT EXISTS idx_booking_actions_company ON booking_actions(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_staff_company ON staff(company_id);
CREATE INDEX IF NOT EXISTS idx_settings_company ON settings(company_id);
CREATE INDEX IF NOT EXISTS idx_platform_contacts_status ON platform_contacts(status);
CREATE INDEX IF NOT EXISTS idx_platform_signups_company ON platform_signups(company_id);
CREATE INDEX IF NOT EXISTS idx_platform_signups_email ON platform_signups(owner_email);
CREATE INDEX IF NOT EXISTS idx_payment_events_signup ON payment_events(signup_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_events_company ON payment_events(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_custom_domain_requests_company ON custom_domain_requests(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_custom_domain_requests_status ON custom_domain_requests(request_status, created_at);
CREATE INDEX IF NOT EXISTS idx_custom_domain_request_events_request ON custom_domain_request_events(request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_custom_domain_request_events_company ON custom_domain_request_events(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_media_assets_company ON media_assets(company_id);
CREATE INDEX IF NOT EXISTS idx_otp_company ON otp_cache(company_id);
CREATE INDEX IF NOT EXISTS idx_telegram_company ON telegram_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_reserved_terms_normalized ON reserved_terms(normalized_term, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subdomain_reservation_slug_status ON subdomain_reservations(normalized_slug, status);
CREATE INDEX IF NOT EXISTS idx_subdomain_reservation_company ON subdomain_reservations(company_id);
CREATE INDEX IF NOT EXISTS idx_publish_reviews_company ON publish_reviews(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_publish_reviews_status ON publish_reviews(review_status, decision, created_at);
CREATE INDEX IF NOT EXISTS idx_website_releases_company ON website_releases(company_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_website_releases_review ON website_releases(review_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_abuse_reports_host ON abuse_reports(host, created_at);
CREATE INDEX IF NOT EXISTS idx_abuse_reports_status ON abuse_reports(status, created_at);
`;
