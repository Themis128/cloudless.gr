-- Migration: Admin Audit Log for Authentication Compliance
-- Logs all authentication-related admin actions for compliance and security auditing
--
-- Run with: npx wrangler d1 execute user-auth-db --file ./migrations/0005-admin-audit-log.sql --remote

-- Admin audit log table for tracking authentication events
-- Used for compliance, security auditing, and incident investigation
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('promote_admin', 'demote_admin', 'password_reset', 'password_change', 'session_revoke', 'user_delete', 'login', 'logout', 'failed_login', 'lockout', 'csrf_failure', 'rate_limit_exceeded')),
  target_user_id TEXT,
  target_email TEXT,
  ip TEXT,
  user_agent TEXT,
  request_path TEXT,
  request_method TEXT,
  metadata_json TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Index for querying by admin user
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_user ON admin_audit_log(admin_user_id);

-- Index for querying by action type (for compliance reports)
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action);

-- Index for time-based queries (for audit trails)
CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON admin_audit_log(created_at DESC);

-- Index for target user lookups
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_log(target_user_id);