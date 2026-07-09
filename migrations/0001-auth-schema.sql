-- Migration: AWS Cognito + DynamoDB → Cloudflare D1
-- This schema replaces Cognito User Pool and SessionTokenStore

-- Users table (replaces Cognito User Pool)
-- Stores user profile data including preferences
CREATE TABLE user (
  id TEXT NOT NULL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  company TEXT,
  phone TEXT,
  password_hash TEXT NOT NULL,
  preferences_json TEXT,  -- JSON string for theme, language, notifications
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- User roles (replaces Cognito groups)
-- Admin users get access to /admin routes
CREATE TABLE user_role (
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Sessions table (replaces SessionTokenStore + JWT cookie token offloading)
-- Stores session tokens to keep cookies under 4KB limit
CREATE TABLE session (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Stripe transactions (replaces StripeTransactions DynamoDB table)
CREATE TABLE stripe_transaction (
  event_id TEXT NOT NULL PRIMARY KEY,
  event_type TEXT NOT NULL,
  tag_category TEXT,
  tag_stage TEXT,
  stage_category TEXT,
  event_day TEXT,
  customer_id TEXT,
  processing_status TEXT,
  received_at INTEGER NOT NULL,
  payload_json TEXT  -- Full Stripe event payload
);

-- Stripe transaction indexes for querying
CREATE INDEX idx_stripe_event_type ON stripe_transaction(event_type);
CREATE INDEX idx_stripe_received_at ON stripe_transaction(received_at);
CREATE stripe_customer_idx ON stripe_transaction(customer_id);

-- Admin notifications (replaces AdminNotifications DynamoDB table)
-- Events log for all client-facing interactions
CREATE TABLE admin_notification (
  pk TEXT NOT NULL,  -- "NOTIF" constant
  sk TEXT NOT NULL,  -- "<createdAt-ISO8601>#<id>"
  cat_pk TEXT NOT NULL,  -- "CAT#<category>"
  cat_sk TEXT NOT NULL,  -- "<createdAt-ISO8601>#<id>"
  category TEXT NOT NULL,
  payload_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_notification_cat_pk ON admin_notification(cat_pk);
CREATE INDEX idx_notification_cat_sk ON admin_notification(cat_sk);

-- Analytics cache (replaces AnalyticsCache DynamoDB table)
-- Query result caching for GSC endpoints
CREATE TABLE analytics_cache (
  pk TEXT NOT NULL,  -- route name
  sk TEXT NOT NULL,  -- params hash
  result_json TEXT,
  cached_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  expires_at INTEGER
);

CREATE INDEX idx_analytics_expires ON analytics_cache(expires_at);

-- Create indexes for user lookups
CREATE INDEX idx_user_email ON user(email);
CREATE INDEX idx_session_expires ON session(expires_at);

-- Trigger to update updated_at on user changes
CREATE TRIGGER update_user_timestamp 
  AFTER UPDATE ON user 
  FOR EACH ROW 
  BEGIN 
    UPDATE user SET updated_at = strftime('%s', 'now') WHERE id = NEW.id; 
  END;