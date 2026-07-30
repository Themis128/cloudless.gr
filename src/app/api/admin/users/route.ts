import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getAuthDbFromEnv, listUsers, setUserAdminRole, setUserDisabled } from "@/lib/auth-d1";

interface AdminUser {
  username: string;
  email: string;
  name: string;
  company: string;
  phone: string;
  status: "active" | "disabled";
  emailVerified: boolean;
  userStatus: string;
  role: "admin" | "user";
  created?: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 60);
  const filter = (searchParams.get("filter") ?? "").replace(/[^\w.@+-]/g, "").slice(0, 128);

  const db = getAuthDbFromEnv();
  if (!db) {
    return NextResponse.json({ error: "Auth database not configured" }, { status: 503 });
  }

  try {
    const rows = await listUsers(db, { limit, emailPrefix: filter || undefined });
    const users: AdminUser[] = rows.map((u) => ({
      username: u.id,
      email: u.email,
      name: u.name ?? "",
      company: u.company ?? "",
      phone: u.phone ?? "",
      status: u.disabled ? "disabled" : "active",
      emailVerified: u.emailVerified,
      userStatus: u.disabled ? "DISABLED" : "CONFIRMED",
      role: u.role,
      created: u.created_at ? new Date(u.created_at * 1000).toISOString() : undefined,
    }));
    return NextResponse.json({ users, count: users.length, provider: "d1" });
  } catch (err) {
    console.error("Failed to list users:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { action, username } = (await request.json()) as { action: string; username: string };
  if (!action || !username) {
    return NextResponse.json({ error: "action and username required" }, { status: 400 });
  }

  const ALLOWED_ACTIONS = new Set(["enable", "disable", "promote", "demote"]);
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  if (!/^[\w.@+\-]{1,128}$/.test(username)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  const db = getAuthDbFromEnv();
  if (!db) {
    return NextResponse.json({ error: "Auth database not configured" }, { status: 503 });
  }

  try {
    if (action === "enable" || action === "disable") {
      const ok = await setUserDisabled(db, username, action === "disable");
      if (!ok) return NextResponse.json({ error: "User not found" }, { status: 404 });
      return NextResponse.json({
        success: true,
        message: action === "disable" ? "User disabled" : "User enabled",
        provider: "d1",
      });
    }

    const ok = await setUserAdminRole(db, username, action === "promote");
    if (!ok) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      message: action === "promote" ? "User promoted to admin" : "User removed from admin group",
      provider: "d1",
    });
  } catch (err) {
    console.error("Failed to modify user:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to modify user" }, { status: 500 });
  }
}
