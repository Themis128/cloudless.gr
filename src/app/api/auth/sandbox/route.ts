/**
 * Auth testing sandbox endpoint.
 *
 * Playground endpoint for testing authentication flow without UI dependencies.
 * Useful for debugging and API testing during development.
 *
 * SECURITY: This endpoint should be disabled in production or protected by admin auth.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  authenticateUser,
  createUser,
  getAuthDbFromEnv,
  getUserBySession,
  isAdmin,
  validatePasswordStrength,
  validateSessionSecret,
  type AuthDatabase,
} from "@/lib/auth-d1";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const AUTH_NOT_CONFIGURED = { error: "Auth not configured" } as const;
const EMAIL_PASSWORD_REQUIRED = { error: "email and password required" } as const;

function isSandboxEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

function sandboxDisabledResponse(): NextResponse {
  return NextResponse.json({ error: "Auth sandbox is disabled in production" }, { status: 403 });
}

function requireSandboxDb(): AuthDatabase | NextResponse {
  const db = getAuthDbFromEnv();
  if (!db) {
    return NextResponse.json(AUTH_NOT_CONFIGURED, { status: 503 });
  }
  return db;
}

function strField(payload: Record<string, unknown> | undefined, key: string): string {
  const value = payload?.[key];
  return typeof value === "string" ? value : "";
}

async function handleTestPassword(
  action: string,
  payload: Record<string, unknown> | undefined
): Promise<NextResponse> {
  const password = strField(payload, "password");
  const result = validatePasswordStrength(password);
  return NextResponse.json({ action, password: "***", ...result });
}

async function handleTestLogin(
  action: string,
  db: AuthDatabase,
  payload: Record<string, unknown> | undefined
): Promise<NextResponse> {
  const email = strField(payload, "email").toLowerCase().trim();
  const password = strField(payload, "password");
  if (!email || !password) {
    return NextResponse.json(EMAIL_PASSWORD_REQUIRED, { status: 400 });
  }

  const result = await authenticateUser(db, email, password);
  if (result.error) {
    return NextResponse.json({ action, error: result.error }, { status: 401 });
  }
  return NextResponse.json({
    action,
    user: { email: result.user?.email },
    session: { expiresAt: result.session?.expires_at },
  });
}

async function handleTestRegister(
  action: string,
  db: AuthDatabase,
  payload: Record<string, unknown> | undefined
): Promise<NextResponse> {
  const email = strField(payload, "email").toLowerCase().trim();
  const password = strField(payload, "password");
  const fullName = strField(payload, "fullName") || undefined;
  if (!email || !password) {
    return NextResponse.json(EMAIL_PASSWORD_REQUIRED, { status: 400 });
  }

  const strengthCheck = validatePasswordStrength(password);
  if (!strengthCheck.valid) {
    return NextResponse.json({ action, error: strengthCheck.error }, { status: 400 });
  }

  const result = await createUser(db, email, password, fullName);
  if (result.error === "User already exists") {
    return NextResponse.json({ action, message: "User already exists" });
  }
  if (result.error) {
    return NextResponse.json({ action, error: result.error }, { status: 500 });
  }
  return NextResponse.json({
    action,
    user: { id: result.user?.id, email: result.user?.email },
  });
}

async function handleCheckSession(
  action: string,
  db: AuthDatabase,
  req: NextRequest
): Promise<NextResponse> {
  const sessionId = req.cookies.get("session_token")?.value;
  if (!sessionId) {
    return NextResponse.json({ action, user: null, message: "No session cookie" });
  }

  const user = await getUserBySession(db, sessionId);
  if (!user) {
    const response = NextResponse.json({ action, user: null, message: "Session expired" });
    response.cookies.delete("session_token");
    return response;
  }

  const admin = await isAdmin(db, user.id);
  return NextResponse.json({
    action,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: admin,
    },
  });
}

export async function GET(_req: NextRequest) {
  if (!isSandboxEnabled()) return sandboxDisabledResponse();

  const dbOrErr = requireSandboxDb();
  if (dbOrErr instanceof NextResponse) {
    // Playwright accepts 503 when AUTH_DB isn't configured.
    return dbOrErr;
  }

  return NextResponse.json({
    enabled: true,
    sessionSecret: validateSessionSecret(),
    actions: [
      {
        method: "POST",
        path: "/api/auth/sandbox",
        body: { action: "test-password", password: "string" },
        description: "Test password strength validation",
      },
      {
        method: "POST",
        path: "/api/auth/sandbox",
        body: { action: "test-login", email: "string", password: "string" },
        description: "Test login credentials",
      },
      {
        method: "POST",
        path: "/api/auth/sandbox",
        body: {
          action: "test-register",
          email: "string",
          password: "string",
          fullName: "string?",
        },
        description: "Register test user",
      },
      {
        method: "POST",
        path: "/api/auth/sandbox",
        body: { action: "check-session" },
        description: "Check current session cookie",
      },
    ],
  });
}

export async function POST(req: NextRequest) {
  if (!isSandboxEnabled()) return sandboxDisabledResponse();

  const ipRl = rateLimit(`auth-sandbox:ip:${getClientIp(req)}`, 5, 60_000);
  if (!ipRl.ok) return ipRl.response;

  const dbOrErr = requireSandboxDb();
  if (dbOrErr instanceof NextResponse) return dbOrErr;
  const db = dbOrErr;

  let action: string | undefined;
  let payload: Record<string, unknown> | undefined;
  try {
    const body = (await req.json()) as { action?: string; payload?: Record<string, unknown> };
    action = body.action;
    payload = body.payload;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!action) {
    return NextResponse.json({ error: "action required" }, { status: 400 });
  }

  switch (action) {
    case "test-password":
      return handleTestPassword(action, payload);
    case "test-login":
      return handleTestLogin(action, db, payload);
    case "test-register":
      return handleTestRegister(action, db, payload);
    case "check-session":
      return handleCheckSession(action, db, req);
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
