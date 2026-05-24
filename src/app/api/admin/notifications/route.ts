import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  read: boolean;
  createdAt: string;
}

// In-memory ring buffer — survives Lambda warm containers, resets on cold start.
// This is intentionally lightweight: persistent storage would require a DB.
const MAX_NOTIFICATIONS = 50;
const notificationStore: AdminNotification[] = [];

export function pushNotification(n: Omit<AdminNotification, "id" | "read" | "createdAt">): void {
  const entry: AdminNotification = {
    ...n,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    read: false,
    createdAt: new Date().toISOString(),
  };
  notificationStore.unshift(entry);
  if (notificationStore.length > MAX_NOTIFICATIONS) {
    notificationStore.length = MAX_NOTIFICATIONS;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({ notifications: notificationStore });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as { id?: string; markAllRead?: boolean };

  if (body.markAllRead) {
    for (const n of notificationStore) n.read = true;
    return NextResponse.json({ success: true });
  }

  if (body.id) {
    const notif = notificationStore.find((n) => n.id === body.id);
    if (notif) notif.read = true;
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Provide id or markAllRead" }, { status: 400 });
}
