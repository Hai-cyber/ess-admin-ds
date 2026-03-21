-- ESSKULTUR D1 Schema
-- Complete database structure for restaurant booking system
-- Replaces Make.com datastores

-- =====================================================
-- 1. CUSTOMERS TABLE (Replaces ODOO Profiles Store)
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  
  -- Founder Program
  founder_status TEXT DEFAULT 'none', -- 'none', 'pending_verification', 'live', 'expired'
  founder_level TEXT DEFAULT 'trial', -- 'trial', 'silver', 'gold', etc.
  founder_terms_accepted BOOLEAN DEFAULT 0,
  kc_terms_accepted BOOLEAN DEFAULT 0,
  otp_verified BOOLEAN DEFAULT 0,
  
  -- Opt-in & Consent
  sms_opt_in BOOLEAN DEFAULT 1,
  opt_in_text TEXT,
  opt_in_timestamp TEXT, -- ISO datetime
  odoo_register_sync_state TEXT DEFAULT 'pending',
  odoo_register_sync_error TEXT,
  odoo_register_synced_at TEXT,
  odoo_register_sync_attempts INTEGER DEFAULT 0,
  
  -- Activity Tracking
  number_of_visits INTEGER DEFAULT 0,
  last_visit TEXT, -- ISO date
  last_reminder_date TEXT, -- ISO date
  total_spent REAL DEFAULT 0,
  
  -- Metadata
  created_at TEXT NOT NULL, -- ISO datetime
  updated_at TEXT NOT NULL, -- ISO datetime
  created_by TEXT DEFAULT 'system',
  updated_by TEXT DEFAULT 'system',
  notes TEXT
);

-- =====================================================
-- 2. BOOKINGS TABLE (Replaces Reservation Store)
-- =====================================================
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY, -- booking_id
  customer_id TEXT NOT NULL,
  
  -- Guest Info
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  guests_pax INTEGER NOT NULL,
  
  -- Booking Details
  booking_date TEXT NOT NULL, -- YYYY-MM-DD
  booking_time TEXT NOT NULL, -- HH:mm
  booking_datetime TEXT NOT NULL, -- YYYY-MM-DD HH:mm (Odoo x_studio_booking_datetime)
  duration_minutes INTEGER DEFAULT 120,
  area TEXT NOT NULL, -- 'indoor', 'outdoor', 'garden', 'bar'
  
  -- Status
  stage TEXT NOT NULL, -- 'pending', 'confirmed', 'arrived', 'done', 'cancelled', 'noshow'
  stage_id INTEGER, -- Odoo mapping: 1=pending, 2=confirmed, 3=arrived, 4=done, 5=cancelled, 6=noshow
  
  -- Flags & Special Notes
  flag TEXT, -- 'vip', 'founder', 'kc', or empty
  notes TEXT,
  
  -- Telegram Integration
  chat_id TEXT, -- -5101793550 (group ID)
  message_id TEXT, -- For editing messages
  
  -- Odoo Reference
  odoo_lead_id TEXT,
  
  -- Source & Tracking
  source TEXT, -- 'web', 'onsite', 'odoo_sync'
  submitted_at TEXT NOT NULL, -- ISO datetime
  updated_at TEXT NOT NULL, -- ISO datetime
  created_by TEXT DEFAULT 'system',
  updated_by TEXT DEFAULT 'system',
  
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- =====================================================
-- 3. BOOKING_ACTIONS TABLE (Audit Trail)
-- =====================================================
CREATE TABLE IF NOT EXISTS booking_actions (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  
  -- Action Details
  action_type TEXT NOT NULL, -- 'created', 'stage_changed', 'updated', 'deleted'
  old_stage TEXT,
  new_stage TEXT,
  
  -- Who & When
  changed_by TEXT NOT NULL,
  user_role TEXT, -- 'staff', 'admin', 'system'
  changed_at TEXT NOT NULL, -- ISO datetime
  
  -- Additional Info
  change_reason TEXT,
  metadata TEXT, -- JSON for extra data
  
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

-- =====================================================
-- 4. CONTACTS TABLE (Contact Form Submissions)
-- =====================================================
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  
  -- Form Data
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  
  -- Processing
  is_meaningful BOOLEAN DEFAULT 1, -- Supervisor marks as meaningful/spam
  summary TEXT, -- AI-generated summary
  
  -- Status
  status TEXT DEFAULT 'new', -- 'new', 'read', 'actioned', 'ignored'
  pushed_to_gmail BOOLEAN DEFAULT 0,
  
  -- Metadata
  submitted_at TEXT NOT NULL, -- ISO datetime
  processed_at TEXT,
  processed_by TEXT,
  notes TEXT
);

-- =====================================================
-- 5. STAFF TABLE (Staff Users & Authentication)
-- =====================================================
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin TEXT NOT NULL UNIQUE, -- 4-digit PIN
  role TEXT NOT NULL, -- 'hostess', 'manager', 'admin', 'supervisor'
  
  -- Access
  is_active BOOLEAN DEFAULT 1,
  last_login TEXT, -- ISO datetime
  
  -- Permissions (JSON or bitmask)
  permissions TEXT, -- JSON array of permissions
  
  -- Metadata
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);

-- =====================================================
-- 6. SETTINGS TABLE (Configuration)
-- =====================================================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT,
  updated_by TEXT
);

-- =====================================================
-- 7. OTP_CACHE TABLE (Temporary OTP Storage)
-- =====================================================
CREATE TABLE IF NOT EXISTS otp_cache (
  phone TEXT PRIMARY KEY,
  otp_code TEXT NOT NULL,
  expires_at TEXT NOT NULL, -- ISO datetime (10 min from creation)
  created_at TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_attempt TEXT,
  verified BOOLEAN DEFAULT 0
);

-- =====================================================
-- 8. TELEGRAM_MESSAGES TABLE (Message Tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS telegram_messages (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  
  -- Message State
  current_stage TEXT,
  last_updated TEXT,
  
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

-- =====================================================
-- INDEXES (Performance)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_stage ON bookings(stage);
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(phone);
CREATE INDEX IF NOT EXISTS idx_actions_booking ON booking_actions(booking_id);
CREATE INDEX IF NOT EXISTS idx_contacts_submitted ON contacts(submitted_at);
CREATE INDEX IF NOT EXISTS idx_staff_pin ON staff(pin);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
