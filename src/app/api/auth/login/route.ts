import { NextRequest, NextResponse } from "next/server";
import {
  authenticateUser,
  getUserBySession,
  isAdmin,
  checkFailedAttempts,
  logSessionActivity,
  validateSessionSecret,
  getAuthDbFromEnv,
  type AuthDatabase,
} from "@/lib/auth-d1";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

function getDb(_request: NextRequest): AuthDatabase | null {
  return getAuthDbFromEnv();
}

export async function POST(req: NextRequest) {
  const db = getDb(req);
  if (!db) {
    // Cognito Hosted UI is entered via next-auth signIn("cognito") →
    // /api/auth/signin/cognito, not this D1 email/password endpoint.
    // A redirect to /api/auth/login/cognito is not a valid Auth.js action
    // and returns 400 (UnknownAction). Match /api/auth/register.
    return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
  }

  // Validate SESSION_SECRET
  const secretCheck = validateSessionSecret();
  if (!secretCheck.valid) {
    console.warn("[auth/login] SESSION_SECRET validation:", secretCheck.error);
  }

  const ipRl = rateLimit(`auth-login:ip:${getClientIp(req)}`, 10, 60_000);
  if (!ipRl.ok) return ipRl.response;

  let email: string | undefined;
  let password: string | undefined;
  let rememberMe = false;
  try {
    const body = (await req.json()) as { email?: string; password?: string; rememberMe?: boolean };
    email = typeof body.email === "string" ? body.email.toLowerCase().trim() : undefined;
    password = body.password;
    rememberMe = !!body.rememberMe;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  // Check for account lockout
  const lockoutCheck = await checkFailedAttempts(db, email);
  if (lockoutCheck.locked) {
    return NextResponse.json(
      {
        error:
          "Account temporarily locked due to too many failed attempts. Try again in 15 minutes.",
      },
      { status: 429 }
    );
  }

  const result = await authenticateUser(db, email, password, rememberMe);

  if (result.error) {
    // Log failed attempt for lockout tracking
    await logSessionActivity(
      db,
      "failed-attempt",
      "failed_attempt",
      email,
      getClientIp(req),
      req.headers.get("user-agent") || undefined
    ).catch(() => {});

    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  if (!result.session) {
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }

  // Log successful login
  await logSessionActivity(
    db,
    result.session.id,
    "login",
    result.user!.email,
    getClientIp(req),
    req.headers.get("user-agent") || undefined
  ).catch(() => {});

  // Check admin status
  const userIsAdmin = await isAdmin(db, result.user!.id);

  // Calculate cookie maxAge based on session expiry
  const cookieMaxAge = rememberMe
    ? 60 * 60 * 24 * 60 // 60 days
    : 60 * 60 * 24 * 30; // 30 days (default)

  // Set session cookie
  const response = NextResponse.json({
    ok: true,
    user: {
      id: result.user!.id,
      email: result.user!.email,
      name: result.user!.name,
      company: result.user!.company,
      phone: result.user!.phone,
    },
    isAdmin: userIsAdmin,
  });

  response.cookies.set("session_token", result.session!.id, {
    httpOnly: true,
    secure: process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://"),
    sameSite: "strict",
    path: "/",
    maxAge: cookieMaxAge,
  });

  return response;
}

// GET check endpoint for session validation
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

  const isAdminUser = await isAdmin(db, user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      company: user.company,
      phone: user.phone,
    },
    isAdmin: isAdminUser,
  });
}
