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
    // Fallback to next-auth when D1 is not configured (Pi / Cognito path).
    // Auth.js SessionProvider expects JSON `null` with HTTP 200 — never HTML
    // and never a 4xx that triggers ClientFetchError in the browser poller.
    try {
      const { handlers } = await import("@/lib/auth");
      const res = await handlers.GET(req);
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        return NextResponse.json(null);
      }
      const text = await res.text();
      if (!text || text === "null") {
        return NextResponse.json(null);
      }
      try {
        return NextResponse.json(JSON.parse(text) as unknown);
      } catch {
        return NextResponse.json(null);
      }
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

/** HEAD probes (curl -I, health checks) must not fall through to Auth.js 400. */
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: { "content-type": "application/json" },
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
