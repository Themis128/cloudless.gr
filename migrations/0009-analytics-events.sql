-- Migration: Generic analytics events on Cloudflare D1
-- Replaces S3 NDJSON sink (src/lib/analytics.ts trackS3Event).
-- Funnel-specific events remain in search_funnel_events (0008).
--
-- Run with:
--   npx wrangler d1 execute user-auth-db --file ./migrations/0009-analytics-events.sql --remote
--   npx wrangler d1 execute user-auth-db --file ./migrations/0009-analytics-events.sql --local

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  session_id TEXT,
  user_id TEXT,
  page TEXT,
  referrer TEXT,
  source TEXT,
  campaign TEXT,
  medium TEXT,
  product_id TEXT,
  properties_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_time
  ON analytics_events(event, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_session
  ON analytics_events(session_id, created_at);
