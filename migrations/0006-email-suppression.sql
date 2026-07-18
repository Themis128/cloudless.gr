-- Migration: Email Suppression List (D1)
-- Replaces AWS SESv2 account-level suppression list for Workers environment
-- Cloudflare Email Service doesn't have a native suppression API,
-- so we manage suppression at the application layer.
--
-- Run with: npx wrangler d1 execute user-auth-db --file ./migrations/0006-email-suppression.sql --remote

-- Email suppression list table
-- Stores emails that should not receive newsletters or other emails
CREATE TABLE IF NOT EXISTS email_suppression (
  email TEXT NOT NULL PRIMARY KEY,
  reason TEXT NOT NULL,
  suppressed_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Index for cleanup queries (find expired suppressions)
CREATE INDEX IF NOT EXISTS idx_email_suppression_expires ON email_suppression(expires_at);

-- Index for reason-based queries (if needed for compliance reports)
CREATE INDEX IF NOT EXISTS idx_email_suppression_reason ON email_suppression(reason);