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
} from "@/lib/auth-d1";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

function getDb(_request: NextRequest) {
  return getAuthDbFromEnv();
}

// Check if sandbox is enabled (only in development)
function isSandboxEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export async function GET(req: NextRequest) {
  // Only allow in development mode
  if (!isSandboxEnabled()) {
    return NextResponse.json({ error: "Auth sandbox is disabled in production" }, { status: 403 });
  }

  const db = getDb(req);
  if (!db) {
    // In test/dev we treat missing D1 bindings as "service unavailable"
    // rather than a missing route/contract (the Playwright tests accept
    // 503 when AUTH_DB isn't configured).
    return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
  }

  // Check SESSION_SECRET
  const secretCheck = validateSessionSecret();

  // Return sandbox status and available actions
  return NextResponse.json({
    enabled: true,
    sessionSecret: secretCheck,
    actions: [
      {
        method: "POST",
        path: "/api/auth/sandbox",
        body: {
          action: "test-password",
          password: "string",
        },
        description: "Test password strength validation",
      },
      {
        method: "POST",
        path: "/api/auth/sandbox",
        body: {
          action: "test-login",
          email: "string",
          password: "string",
        },
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
        body: {
          action: "check-session",
        },
        description: "Check current session cookie",
      },
    ],
  });
}

export async function POST(req: NextRequest) {
  // Only allow in development mode
  if (!isSandboxEnabled()) {
    return NextResponse.json({ error: "Auth sandbox is disabled in production" }, { status: 403 });
  }

  const ipRl = rateLimit(`auth-sandbox:ip:${getClientIp(req)}`, 5, 60_000);
  if (!ipRl.ok) return ipRl.response;

  const db = getDb(req);
  if (!db) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
  }

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
    case "test-password": {
      const password = typeof payload?.password === "string" ? payload.password : "";
      const result = validatePasswordStrength(password);
      return NextResponse.json({
        action,
        password: "***",
        ...result,
      });
    }

    case "test-login": {
      const email = typeof payload?.email === "string" ? payload.email.toLowerCase().trim() : "";
      const password = typeof payload?.password === "string" ? payload.password : "";

      if (!email || !password) {
        return NextResponse.json({ error: "email and password required" }, { status: 400 });
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

    case "test-register": {
      const email = typeof payload?.email === "string" ? payload.email.toLowerCase().trim() : "";
      const password = typeof payload?.password === "string" ? payload.password : "";
      const fullName = typeof payload?.fullName === "string" ? payload.fullName : undefined;

      if (!email || !password) {
        return NextResponse.json({ error: "email and password required" }, { status: 400 });
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

    case "check-session": {
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

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
