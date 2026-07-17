-- Migration: CSRF token table for auth form protection
-- Prevents cross-site request forgery attacks on login/register forms

CREATE TABLE IF NOT EXISTS csrf_token (
  id TEXT NOT NULL PRIMARY KEY,
  session_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (session_id) REFERENCES session(id) ON DELETE CASCADE
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_csrf_expires ON csrf_token(expires_at);

-- Index for session-based lookups
CREATE INDEX IF NOT EXISTS idx_csrf_session ON csrf_token(session_id);