-- Migration: Search / recommendation funnel events (Cloudflare D1)
-- Replaces Athena/S3 funnel analytics for store search + rec A/B.
--
-- Run with:
--   npx wrangler d1 execute user-auth-db --file ./migrations/0008-search-funnel-events.sql --remote
--   npx wrangler d1 execute auth-db-preview --file ./migrations/0008-search-funnel-events.sql --local

CREATE TABLE IF NOT EXISTS search_funnel_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  query TEXT,
  result_ids_json TEXT,
  product_id TEXT,
  source TEXT,
  result_count INTEGER,
  ab_variant TEXT,
  user_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_funnel_session
  ON search_funnel_events(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_funnel_type_time
  ON search_funnel_events(event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_funnel_query
  ON search_funnel_events(query);

CREATE INDEX IF NOT EXISTS idx_funnel_ab
  ON search_funnel_events(ab_variant, event_type, created_at);
