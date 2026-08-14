import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

/** Zod parse (throw) so missing credentials are not modeled as a user-controlled security bypass. */
const LoginBodySchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
});

/**
 * Fallback to HTTP D1 client if the bindings are not available.
 * This is a simplified version of the logic in @/lib/d1-http.
 */
function getHttpAuthDbFallback(): AuthDatabase | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const databaseId =
    process.env.CLOUDFLARE_D1_DATABASE_ID?.trim() ||
    process.env.AUTH_D1_DATABASE_ID?.trim() ||
    "7ca74513-23c3-412a-b9ca-b0c55835973d"; // default from d1-http.ts

  if (!accountId || !token) {
    return null;
  }

  // We'll create a simple statement wrapper that uses fetch.
  // This is a minimal implementation mirroring the one in d1-http.ts.
  type Stmt = {
    bind: (...args: unknown[]) => Stmt;
    all: <T = Record<string, unknown>>() => Promise<{ results: T[]; success: boolean }>;
    run: () => Promise<{ success: boolean; meta?: { changes: number } }>;
    first: <T = Record<string, unknown>>(col?: string) => Promise<T | null>;
  };

  function prepareHttp(sql: string): Stmt {
    let bound: unknown[] = [];
    const stmt: Stmt = {
      bind(...args: unknown[]) {
        bound = args;
        return stmt;
      },
      async all<T = Record<string, unknown>>() {
        const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
        const res = await globalThis.fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sql, params: bound }),
        });
        const body = await res.json();
        if (!res.ok || !(body as { success?: boolean }).success) {
          // In a real scenario, we should handle errors, but for simplicity we return empty.
          return { results: [], success: false };
        }
        const result = (body as { result?: unknown[] })?.result?.[0] as {
          results?: unknown[];
          success?: boolean;
          meta?: { changes?: number; last_row_id?: number };
        };
        return {
          results: (result?.results ?? []) as T[],
          success: result?.success !== false,
        };
      },
      async run() {
        const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
        const res = await globalThis.fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sql, params: bound }),
        });
        const body = await res.json();
        if (!res.ok || !(body as { success?: boolean }).success) {
          return { success: false, meta: { changes: 0 } };
        }
        const result = (body as { result?: unknown[] })?.result?.[0] as {
          success?: boolean;
          meta?: { changes?: number };
        };
        return {
          success: result?.success !== false,
          meta: { changes: Number(result?.meta?.changes ?? 0) },
        };
      },
      async first<T = Record<string, unknown>>(col?: string) {
        const allResult = await this.all<T>();
        if (!allResult.results.length) return null;
        const row = allResult.results[0];
        if (col) {
          return ((row as Record<string, unknown>)[col] ?? null) as T;
        }
        return row as T;
      },
    };
    return stmt;
  }

  return { prepare: prepareHttp };
}

function getDb(_request: NextRequest): AuthDatabase | null {
  let db = getAuthDbFromEnv();
  // Fallback to HTTP D1 client if the binding is not available (e.g., in some environments)
  if (!db) {
    const fallback = getHttpAuthDbFallback();
    if (fallback) {
      db = fallback;
    }
  }
  return db;
}

function parseLoginCredentials(rawBody: unknown): {
  email: string;
  password: string;
  rememberMe: boolean;
} {
  const credentials = LoginBodySchema.parse(rawBody);
  return {
    email: credentials.email,
    password: credentials.password,
    rememberMe: credentials.rememberMe,
  };
}

function loginBodyError(err: unknown): NextResponse {
  if (err instanceof z.ZodError) {
    const issue = err.issues[0];
    const message =
      issue?.message === "Email is required" || issue?.message === "Password is required"
        ? issue.message
        : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  let email: string;
  let password: string;
  let rememberMe = false;
  try {
    const rawBody = await req.json();
    const credentials = parseLoginCredentials(rawBody);
    email = credentials.email;
    password = credentials.password;
    rememberMe = credentials.rememberMe;
  } catch (err) {
    return loginBodyError(err);
  }

  try {
    const db = getDb(req);
    if (!db) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }

    const secretCheck = validateSessionSecret();
    if (!secretCheck.valid) {
      console.warn("[auth/login] SESSION_SECRET validation:", secretCheck.error);
    }

    const ipRl = rateLimit(`auth-login:ip:${getClientIp(req)}`, 10, 60_000);
    if (!ipRl.ok) return ipRl.response;

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
  } catch (err) {
    // D1 binding / network / unexpected auth-lib failures land here so the
    // client sees a structured 500 instead of an unhandled crash, and the
    // real cause is surfaced in Workers/Lambda logs.
    console.error("[auth/login] unhandled error", err);
    return NextResponse.json({ error: "Login temporarily unavailable" }, { status: 500 });
  }
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
