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
    const response = NextResponse.json({ ok: true });
    response.cookies.delete("session_token");
    return response;
  }

  const sessionId = req.cookies.get("session_token")?.value;
  if (sessionId) {
    await deleteSession(db, sessionId);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete("session_token");
  return response;
}
