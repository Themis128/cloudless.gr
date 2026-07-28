/**
 * Admin Audit Log utility for authentication compliance.
 *
 * Logs all authentication-related admin actions for:
 * - Security auditing
 * - Compliance requirements
 * - Incident investigation
 */

import { type AuthDatabase } from "./auth-d1";

// Action types for audit logging
export type AuditAction =
  | "promote_admin"
  | "demote_admin"
  | "password_reset"
  | "password_change"
  | "session_revoke"
  | "user_delete"
  | "login"
  | "logout"
  | "failed_login"
  | "lockout"
  | "csrf_failure"
  | "rate_limit_exceeded";

// Audit log entry type
export interface AuditLogEntry {
  adminUserId: string;
  action: AuditAction;
  targetUserId?: string;
  targetEmail?: string;
  ip?: string;
  userAgent?: string;
  requestPath?: string;
  requestMethod?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an admin action for compliance auditing.
 *
 * Usage:
 * ```
 * await logAuthAction(db, {
 *   adminUserId: user.id,
 *   action: "promote_admin",
 *   targetUserId: targetUserId,
 *   targetEmail: targetEmail,
 *   ip: request.ip,
 *   userAgent: request.headers.get("user-agent")
 * });
 * ```
 */
export async function logAuthAction(db: AuthDatabase, entry: AuditLogEntry): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO admin_audit_log (
        admin_user_id, action, target_user_id, target_email,
        ip, user_agent, request_path, request_method, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      entry.adminUserId,
      entry.action,
      entry.targetUserId || null,
      entry.targetEmail || null,
      entry.ip || null,
      entry.userAgent || null,
      entry.requestPath || null,
      entry.requestMethod || null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      now
    )
    .run();
}

/**
 * Query audit log entries with optional filters.
 *
 * Usage:
 * ```
 * const entries = await queryAuditLog(db, {
 *   action: "promote_admin",
 *   limit: 100,
 *   offset: 0
 * });
 * ```
 */
export async function queryAuditLog(
  db: AuthDatabase,
  options: {
    action?: AuditAction;
    adminUserId?: string;
    targetUserId?: string;
    startDate?: number;
    endDate?: number;
    limit?: number;
    offset?: number;
  } = {}
): Promise<
  {
    id: number;
    admin_user_id: string;
    action: string;
    target_user_id: string | null;
    target_email: string | null;
    ip: string | null;
    user_agent: string | null;
    request_path: string | null;
    request_method: string | null;
    metadata_json: string | null;
    created_at: number;
  }[]
> {
  const {
    action,
    adminUserId,
    targetUserId,
    startDate,
    endDate,
    limit = 100,
    offset = 0,
  } = options;

  let query = "SELECT * FROM admin_audit_log WHERE 1 = 1";
  const params: unknown[] = [];

  if (action) {
    query += " AND action = ?";
    params.push(action);
  }

  if (adminUserId) {
    query += " AND admin_user_id = ?";
    params.push(adminUserId);
  }

  if (targetUserId) {
    query += " AND target_user_id = ?";
    params.push(targetUserId);
  }

  if (startDate) {
    query += " AND created_at >= ?";
    params.push(startDate);
  }

  if (endDate) {
    query += " AND created_at <= ?";
    params.push(endDate);
  }

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const result = await db
    .prepare(query)
    .bind(...params)
    .all<{
      id: number;
      admin_user_id: string;
      action: string;
      target_user_id: string | null;
      target_email: string | null;
      ip: string | null;
      user_agent: string | null;
      request_path: string | null;
      request_method: string | null;
      metadata_json: string | null;
      created_at: number;
    }>();

  return result.results;
}

/**
 * Get audit log count for compliance reporting.
 */
export async function getAuditLogCount(
  db: AuthDatabase,
  options: {
    action?: AuditAction;
    adminUserId?: string;
    startDate?: number;
    endDate?: number;
  } = {}
): Promise<number> {
  const { action, adminUserId, startDate, endDate } = options;

  let query = "SELECT COUNT(*) as count FROM admin_audit_log WHERE 1 = 1";
  const params: unknown[] = [];

  if (action) {
    query += " AND action = ?";
    params.push(action);
  }

  if (adminUserId) {
    query += " AND admin_user_id = ?";
    params.push(adminUserId);
  }

  if (startDate) {
    query += " AND created_at >= ?";
    params.push(startDate);
  }

  if (endDate) {
    query += " AND created_at <= ?";
    params.push(endDate);
  }

  const result = await db
    .prepare(query)
    .bind(...params)
    .first<{ count: number }>();

  return result?.count ?? 0;
}

/**
 * Cleanup old audit log entries (for retention policy).
 * Default retention: 365 days
 */
export async function cleanupAuditLog(
  db: AuthDatabase,
  olderThanDays: number = 365
): Promise<number> {
  const cutoff = Math.floor(Date.now() / 1000) - olderThanDays * 24 * 60 * 60;
  const result = await db
    .prepare("DELETE FROM admin_audit_log WHERE created_at < ?")
    .bind(cutoff)
    .run();

  return result.meta?.changes ?? 0;
}
