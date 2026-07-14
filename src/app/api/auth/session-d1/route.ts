import { NextRequest, NextResponse } from "next/server";
import { getUserBySession, deleteSession, type AuthDatabase } from "@/lib/auth-d1";

interface Env {
  AUTH_DB: AuthDatabase;
}

function getDb(request: NextRequest): AuthDatabase | null {
  const env = process.env as unknown as Env;
  if (!env.AUTH_DB) {
    return null;
  }
  return env.AUTH_DB;
}

export async function GET(req: NextRequest) {
  const db = getDb(req);
  if (!db) {
    return NextResponse.json({ user: null });
  }

  const sessionId = req.cookies.get("session_token")?.value;
  if (!sessionId) {
    return NextResponse.json({ user: null });
  }

  const user = await getUserBySession(db, sessionId);
  if (!user) {
    const response = NextResponse.json({ user: null });
    response.cookies.delete("session_token");
    return response;
  }

  // Check admin status
  const admin = await isAdmin(db, user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      company: user.company,
      phone: user.phone,
    },
    isAdmin: admin,
  });
}

export async function DELETE(req: NextRequest) {
  const db = getDb(req);
  if (!db) {
    return NextResponse.json({ ok: true });
  }

  const sessionId = req.cookies.get("session_token")?.value;
  if (sessionId) {
    await deleteSession(db, sessionId);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete("session_token");
  return response;
}

async function isAdmin(db: AuthDatabase, userId: string): Promise<boolean> {
  const role = await db
    .prepare("SELECT role FROM user_role WHERE user_id = ? AND role = 'admin'")
    .bind(userId)
    .first<{ role: string }>();

  return !!role;
}
