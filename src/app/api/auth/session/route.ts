import { NextRequest, NextResponse } from "next/server";
import {
  getUserBySession,
  deleteSession,
  isAdmin,
  getAuthDbFromEnv,
  type AuthDatabase,
} from "@/lib/auth-d1";

function getDb(_request: NextRequest): AuthDatabase | null {
  return getAuthDbFromEnv();
}

export async function GET(req: NextRequest) {
  const db = getDb(req);
  if (!db) {
    // Fallback to next-auth when D1 is not configured (local Next.js).
    // Auth.js SessionProvider expects JSON `null` (not an HTML 404 page).
    try {
      const { handlers } = await import("@/lib/auth");
      return handlers.GET(req);
    } catch {
      return NextResponse.json(null);
    }
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
    try {
      const { handlers } = await import("@/lib/auth");
      const signOut = (
        handlers as unknown as { signOut?: (...args: unknown[]) => Promise<unknown> }
      ).signOut;
      if (signOut) return signOut(req) as Promise<Response>;
    } catch {
      // fall through to response
    }
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
