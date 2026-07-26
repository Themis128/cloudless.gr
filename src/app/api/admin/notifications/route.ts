import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  listNotifications,
  markNotificationsRead,
  type AdminNotification,
  type NotificationCategory,
} from "@/lib/admin-notifications";

export type { AdminNotification };

const KNOWN_CATEGORIES: ReadonlySet<NotificationCategory> = new Set<NotificationCategory>([
  "contact",
  "subscribe",
  "booking",
  "order",
  "error",
  "auth",
  "portal",
]);

function parseCategory(raw: string | null): NotificationCategory | undefined {
  if (!raw) return undefined;
  return KNOWN_CATEGORIES.has(raw as NotificationCategory)
    ? (raw as NotificationCategory)
    : undefined;
}

function parseIsoOrUndef(raw: string | null): string | undefined {
  if (!raw) return undefined;
  return Number.isFinite(Date.parse(raw)) ? raw : undefined;
}

function parseLimit(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(Math.max(n, 1), 200);
}

/**
 * GET /api/admin/notifications
 *   ?category=contact|subscribe|booking|order|error|auth|portal
 *   ?since=<ISO 8601>
 *   ?until=<ISO 8601>
 *   ?limit=<1..200, default 50>
 *   ?includeArchived=1
 *
 * Reads from the Dynamo audit log (see src/lib/admin-notifications.ts).
 * Returns 503 when the table is not configured (local dev, partial deploys).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!process.env.ADMIN_NOTIFICATIONS_TABLE) {
    return NextResponse.json({ error: "Notifications store not configured" }, { status: 404 });
  }

  const url = new URL(request.url);
  const params = url.searchParams;

  try {
    const notifications = await listNotifications({
      category: parseCategory(params.get("category")),
      since: parseIsoOrUndef(params.get("since")),
      until: parseIsoOrUndef(params.get("until")),
      limit: parseLimit(params.get("limit")),
      includeArchived: params.get("includeArchived") === "1",
    });
    return NextResponse.json({ notifications });
  } catch (err) {
    console.error("[admin-notifications] GET failed:", err);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/notifications
 *   body: { id?: string } | { ids?: string[] } | { markAllRead?: true }
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!process.env.ADMIN_NOTIFICATIONS_TABLE) {
    return NextResponse.json({ error: "Notifications store not configured" }, { status: 404 });
  }

  let body: { id?: string; ids?: string[]; markAllRead?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (body.markAllRead) {
      const recent = await listNotifications({ limit: 200 });
      const ids = recent.filter((n) => !n.read).map((n) => n.id);
      await markNotificationsRead(ids);
      return NextResponse.json({ success: true, updated: ids.length });
    }

    const ids: string[] = [];
    if (typeof body.id === "string" && body.id) ids.push(body.id);
    if (Array.isArray(body.ids)) {
      for (const id of body.ids) {
        if (typeof id === "string" && id) ids.push(id);
      }
    }

    if (!ids.length) {
      return NextResponse.json({ error: "Provide id, ids, or markAllRead" }, { status: 400 });
    }

    await markNotificationsRead(ids);
    return NextResponse.json({ success: true, updated: ids.length });
  } catch (err) {
    console.error("[admin-notifications] PATCH failed:", err);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
