-- Migration: Session Activity Logging
-- Adds session_log table for tracking login/logout/lockout/failed_attempt events
-- Required for account lockout mechanism (after >5 failed attempts in 15 minutes)
--
-- Run with: npx wrangler d1 execute user-auth-db --file ./migrations/0003-session-log.sql --remote

-- Session activity log table
-- Tracks: login, logout, lockout, failed_attempt events
-- email field is used for failed_attempt tracking (for account lockout)
CREATE TABLE IF NOT EXISTS session_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  action TEXT NOT NULL CHECK(action IN ('login', 'logout', 'lockout', 'failed_attempt')),
  email TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Index for querying by action and time (for lockout detection)
CREATE INDEX IF NOT EXISTS idx_session_log_action_time ON session_log(action, created_at DESC);

-- Index for email-based failed attempt lookup (account lockout)
CREATE INDEX IF NOT EXISTS idx_session_log_email ON session_log(email);

-- Cleanup old log entries (optional - for compliance)
-- Note: Consider archiving instead of deleting for audit purposes
