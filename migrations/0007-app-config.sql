-- Migration: Application Configuration Table
-- Replaces AWS SSM Parameter Store for Workers environment
-- Allows runtime configuration without external SSM dependency
--
-- Run with: npx wrangler d1 execute user-auth-db --file ./migrations/0007-app-config.sql --remote

-- Application configuration key-value store
-- Stores all config values migrated from SSM parameters
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT NOT NULL PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Index for lookup performance (key is already PRIMARY KEY)
-- No additional indexes needed for simple key-value store

-- Seed common configuration keys (will be populated via migration script or admin UI)
-- Initial values match SSM defaults from ssm-config.ts
INSERT OR IGNORE INTO app_config (key, value, description) VALUES
  ('SES_FROM_EMAIL', 'noreply@cloudless.gr', 'Default sender email address'),
  ('SES_TO_EMAIL', 'tbaltzakis@cloudless.gr', 'Default recipient email address'),
  ('GSC_SITE_URL', 'sc-domain:cloudless.gr', 'Google Search Console site URL'),
  ('GOOGLE_CLIENT_EMAIL', '', 'Google Calendar service account email'),
  ('GOOGLE_CALENDAR_ID', 'primary', 'Google Calendar ID for booking'),
  ('GOOGLE_PRIVATE_KEY', '', 'Google Calendar service account private key (store in Wrangler secrets)');

-- Note: Sensitive secrets (STRIPE_SECRET_KEY, etc.) should still be set via Wrangler secrets
-- This table is for non-secret configuration that needs runtime updates