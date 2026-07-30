/**
 * POST /api/user/delete
 * GDPR Art.17 — Right to Erasure ("right to be forgotten").
 * Deletes the authenticated user from D1 (sessions, roles, user row).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getAuthDbFromEnv, deleteUserAccount } from "@/lib/auth-d1";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const { sub: userId } = auth.user;
  if (!userId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  const db = getAuthDbFromEnv();
  if (!db) {
    return NextResponse.json({ error: "Auth database not configured" }, { status: 503 });
  }

  try {
    const ok = await deleteUserAccount(db, userId);
    if (!ok) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, provider: "d1" });
  } catch (e) {
    console.error("[user/delete] D1 delete failed:", e);
    return NextResponse.json({ error: "Deletion failed" }, { status: 500 });
  }
}
