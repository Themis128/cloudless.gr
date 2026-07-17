-- Migration: D1 Query Optimizations
-- Adds indexes and optimized queries for high-traffic scenarios
--
-- Run with: npx wrangler d1 execute user-auth-db --file ./migrations/0002-d1-optimizations.sql --remote

-- Additional indexes for query performance
-- These complement the existing indexes in 0001-auth-schema.sql

-- Composite index for session lookups (common query pattern)
CREATE INDEX IF NOT EXISTS idx_session_user_expires ON session(user_id, expires_at DESC);

-- Index for reset token lookups (JSON extraction is slow without index)
-- Note: SQLite does not support JSON indexes directly, but we can add computed columns
-- For now, these queries will use full table scans (acceptable for low user counts)

-- Optimize analytics_cache queries (used by admin analytics endpoints)
CREATE INDEX IF NOT EXISTS idx_analytics_cache_lookup ON analytics_cache(pk, sk);

-- Pre-computed columns for faster password reset token lookups
-- ALTER TABLE user ADD COLUMN reset_token_hash TEXT; -- Future optimization
-- CREATE INDEX IF NOT EXISTS idx_user_reset_token ON user(reset_token_hash); -- For token validation

-- Session expiration cleanup is already covered by idx_session_expires
-- Note: SQLite partial indexes cannot use non-deterministic functions (strftime)
-- Use idx_session_expires instead for active session queries
-- CREATE INDEX IF NOT EXISTS idx_session_active ON session(id) WHERE expires_at > strftime('%s', 'now');

-- User preferences JSON for faster lookups
-- Note: Lowercase index on expression - keep as regular index for compatibility
CREATE INDEX IF NOT EXISTS idx_user_email_lower ON user(LOWER(email));

-- Statistics table for fast aggregate queries
-- Used by admin dashboards to avoid COUNT(*) scans
CREATE TABLE IF NOT EXISTS user_stats (
  stat_name TEXT PRIMARY KEY,
  stat_value INTEGER NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Triggers to maintain stats
CREATE TRIGGER IF NOT EXISTS trig_update_user_stats_insert
  AFTER INSERT ON user
  FOR EACH ROW
  BEGIN
    INSERT OR REPLACE INTO user_stats (stat_name, stat_value, updated_at)
    VALUES ('total_users', (SELECT COUNT(*) FROM user), (strftime('%s', 'now')));
  END;

CREATE TRIGGER IF NOT EXISTS trig_update_user_stats_delete
  AFTER DELETE ON user
  FOR EACH ROW
  BEGIN
    INSERT OR REPLACE INTO user_stats (stat_name, stat_value, updated_at)
    VALUES ('total_users', (SELECT COUNT(*) FROM user), (strftime('%s', 'now')));
  END;

-- Session count trigger
CREATE TRIGGER IF NOT EXISTS trig_update_session_stats
  AFTER INSERT ON session
  FOR EACH ROW
  BEGIN
    INSERT OR REPLACE INTO user_stats (stat_name, stat_value, updated_at)
    VALUES ('active_sessions', (SELECT COUNT(*) FROM session WHERE expires_at > strftime('%s', 'now')), (strftime('%s', 'now')));
  END;