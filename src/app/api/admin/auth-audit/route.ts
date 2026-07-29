/**
 * /api/admin/auth-audit — Query authentication audit log.
 *
 * GET: Query audit log entries with optional filters
 * - action: Filter by action type (login, logout, failed_login, promote_admin, etc.)
 * - adminUserId: Filter by admin user ID
 * - targetUserId: Filter by target user ID
 * - startDate: Filter by start timestamp (Unix epoch)
 * - endDate: Filter by end timestamp (Unix epoch)
 * - limit: Limit results (default 100, max 100)
 * - offset: Pagination offset (default 0)
 */

import { type NextRequest, NextResponse } from "next/server";
import { type AuthDatabase } from "@/lib/auth-d1";
import { requireAdmin } from "@/lib/api-auth";
import { queryAuditLog, getAuditLogCount, type AuditAction } from "@/lib/auth-audit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  // Get D1 binding
  const env = process.env as unknown as { AUTH_DB: AuthDatabase };
  if (!env.AUTH_DB) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 404 });
  }
  const db = env.AUTH_DB;

  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action") as AuditAction | undefined;
  const adminUserId = searchParams.get("adminUserId") ?? undefined;
  const targetUserId = searchParams.get("targetUserId") ?? undefined;
  const startDate = searchParams.get("startDate")
    ? Number(searchParams.get("startDate"))
    : undefined;
  const endDate = searchParams.get("endDate") ? Number(searchParams.get("endDate")) : undefined;
  const limit = Math.min(100, Number(searchParams.get("limit") ?? 100));
  const offset = Number(searchParams.get("offset") ?? 0);
  const adminEmail = auth.user.email ?? auth.user.sub;

  // If count=true, return total count for reporting
  if (searchParams.get("count") === "true") {
    const count = await getAuditLogCount(db, {
      action,
      adminUserId,
      startDate,
      endDate,
    });
    return NextResponse.json({ count, admin: adminEmail });
  }

  const entries = await queryAuditLog(db, {
    action,
    adminUserId,
    targetUserId,
    startDate,
    endDate,
    limit,
    offset,
  });

  return NextResponse.json({
    entries,
    total: entries.length,
    admin: adminEmail,
  });
}
