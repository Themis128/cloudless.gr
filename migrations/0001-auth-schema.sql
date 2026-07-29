-- Migration: AWS Cognito + DynamoDB → Cloudflare D1
-- This schema replaces Cognito User Pool and SessionTokenStore

-- Users table (replaces Cognito User Pool)
-- Stores user profile data including preferences
CREATE TABLE IF NOT EXISTS user (
  id TEXT NOT NULL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  company TEXT,
  phone TEXT,
  password_hash TEXT NOT NULL,
  preferences_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- User roles (replaces Cognito groups)
-- Admin users get access to /admin routes
CREATE TABLE IF NOT EXISTS user_role (
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Sessions table (replaces SessionTokenStore + JWT cookie token offloading)
-- Stores session tokens to keep cookies under 4KB limit
CREATE TABLE IF NOT EXISTS session (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Stripe transactions (replaces StripeTransactions DynamoDB table)
CREATE TABLE IF NOT EXISTS stripe_transaction (
  event_id TEXT NOT NULL PRIMARY KEY,
  event_type TEXT NOT NULL,
  tag_category TEXT,
  tag_stage TEXT,
  stage_category TEXT,
  event_day TEXT,
  customer_id TEXT,
  processing_status TEXT,
  received_at INTEGER NOT NULL,
  processed_at INTEGER,
  processing_error TEXT,
  payload_json TEXT
);

-- Stripe transaction indexes for querying
CREATE INDEX IF NOT EXISTS idx_stripe_event_type ON stripe_transaction(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_received_at ON stripe_transaction(received_at);
CREATE INDEX IF NOT EXISTS idx_stripe_customer ON stripe_transaction(customer_id);

-- Admin notifications (replaces AdminNotifications DynamoDB table)
-- Events log for all client-facing interactions
-- Uses category column for filtering (DynamoDB GSI pattern replicated via column)
CREATE TABLE IF NOT EXISTS admin_notification (
  pk TEXT NOT NULL,
  sk TEXT NOT NULL,
  category TEXT NOT NULL,
  id TEXT,
  type TEXT,
  title TEXT,
  message TEXT,
  actor TEXT,
  route TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  cat_pk TEXT,
  cat_sk TEXT,
  payload_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_notif_sk ON admin_notification(sk);
CREATE INDEX IF NOT EXISTS idx_admin_notif_category ON admin_notification(category);
CREATE INDEX IF NOT EXISTS idx_admin_notif_id ON admin_notification(id);
CREATE INDEX IF NOT EXISTS idx_admin_notif_cat_pk ON admin_notification(cat_pk);


-- Analytics cache (replaces AnalyticsCache DynamoDB table)
-- Query result caching for GSC endpoints
CREATE TABLE IF NOT EXISTS analytics_cache (
  pk TEXT NOT NULL,
  sk TEXT NOT NULL,
  result_json TEXT,
  cached_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_analytics_expires ON analytics_cache(expires_at);

-- Create indexes for user lookups
CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);
CREATE INDEX IF NOT EXISTS idx_session_expires ON session(expires_at);

-- Trigger to update updated_at on user changes
CREATE TRIGGER IF NOT EXISTS update_user_timestamp
  AFTER UPDATE ON user
  FOR EACH ROW
  BEGIN
    UPDATE user SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
  END;