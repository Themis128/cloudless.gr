/**
 * /api/admin/users/[id] — Individual user management (D1).
 *
 * GET: Get user details
 * PUT: Update user details
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  getAuthDbFromEnv,
  getUserById,
  isAdmin,
  patchUserProfile,
} from "@/lib/auth-d1";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const db = getAuthDbFromEnv();
  if (!db) {
    return NextResponse.json({ error: "Auth database not configured" }, { status: 503 });
  }

  const { id: username } = await params;

  try {
    const row = await getUserById(db, username);
    if (!row) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let prefs: { disabled?: boolean | string; email_verified?: boolean | string } = {};
    try {
      prefs = row.preferences_json ? JSON.parse(row.preferences_json) : {};
    } catch {
      prefs = {};
    }
    const disabled = prefs.disabled === true || prefs.disabled === "true";
    const emailVerified =
      prefs.email_verified === undefined
        ? true
        : prefs.email_verified === true || prefs.email_verified === "true";
    const admin = await isAdmin(db, username);

    return NextResponse.json({
      user: {
        username,
        email: row.email,
        name: row.name ?? "",
        company: row.company ?? "",
        phone: row.phone ?? "",
        emailVerified,
        status: disabled ? "disabled" : "active",
        userStatus: disabled ? "DISABLED" : "CONFIRMED",
        role: admin ? "admin" : "user",
        created: row.created_at ? new Date(row.created_at * 1000).toISOString() : undefined,
      },
      provider: "d1",
    });
  } catch (err) {
    console.error("Failed to get user:", err);
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const db = getAuthDbFromEnv();
  if (!db) {
    return NextResponse.json({ error: "Auth database not configured" }, { status: 503 });
  }

  const { id: username } = await params;
  const body = (await request.json()) as {
    name?: string;
    company?: string;
    phone?: string;
  };

  if (body.name === undefined && body.company === undefined && body.phone === undefined) {
    return NextResponse.json({ error: "No attributes to update" }, { status: 400 });
  }

  try {
    const ok = await patchUserProfile(db, username, {
      name: body.name,
      company: body.company,
      phone: body.phone,
    });
    if (!ok) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, provider: "d1" });
  } catch (err) {
    console.error("Failed to update user:", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
