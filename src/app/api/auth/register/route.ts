import { NextRequest, NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";
import {
  createUser,
  getAuthDbFromEnv,
  validatePasswordStrength,
  validateSessionSecret,
  AuthDatabase,
} from "@/lib/auth-d1";
import { recordNotification } from "@/lib/admin-notifications";
import { sendActivationEmail, notifyTeam } from "@/lib/email";
import { slackRegistrationNotify } from "@/lib/slack-notify";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

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
    bind: (..._args: unknown[]) => Stmt;
    all: <T = Record<string, unknown>>() => Promise<{ results: T[]; success: boolean }>;
    run: () => Promise<{ success: boolean; meta?: { changes: number } }>;
    first: <T = Record<string, unknown>>(_col?: string) => Promise<T | null>;
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

export async function POST(req: NextRequest) {
  let db = getAuthDbFromEnv();
  // Fallback to HTTP D1 client if the binding is not available (e.g., in some environments)
  if (!db) {
    const fallback = getHttpAuthDbFallback();
    if (fallback) {
      db = fallback;
    }
  }

  if (!db) {
    // Cognito Hosted UI is entered via next-auth signIn("cognito") →
    // /api/auth/signin/cognito, not this D1 email/password endpoint.
    // A redirect to /api/auth/login/cognito is not a valid Auth.js action
    // and returns 400 (UnknownAction). Match /api/auth/register.
    return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
  }

  const secretCheck = validateSessionSecret();
  if (!secretCheck.valid) {
    console.warn("[auth/register] SESSION_SECRET validation:", secretCheck.error);
  }

  const ipRl = rateLimit(`auth-register:ip:${getClientIp(req)}`, 20, 60_000);
  if (!ipRl.ok) return ipRl.response;

  let email: string | undefined;
  let password: string | undefined;
  let fullName: string | undefined;
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      fullName?: string;
      name?: string;
      turnstileToken?: string;
    };
    email = typeof body.email === "string" ? body.email.toLowerCase().trim() : undefined;
    password = body.password;
    // Accept both `fullName` (API) and `name` (e2e / curl docs).
    fullName =
      typeof body.fullName === "string"
        ? body.fullName
        : typeof body.name === "string"
          ? body.name
          : undefined;

    const { verifyTurnstileToken } = await import("@/lib/turnstile");
    const turnstile = await verifyTurnstileToken(body.turnstileToken, getClientIp(req));
    if (!turnstile.ok) {
      return NextResponse.json({ error: turnstile.error }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const emailRl = rateLimit(`auth-register:email:${email}`, 5, 600_000);
  if (!emailRl.ok) return emailRl.response;

  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    return NextResponse.json({ error: strength.error }, { status: 400 });
  }

  try {
    const result = await createUser(db, email, password, fullName);
    if (result.error) {
      if (result.error === "User already exists") {
        // Defeat enumeration — look like success
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const secret =
      process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? process.env.SESSION_SECRET ?? "";
    const exp = Date.now() + 5 * 60 * 1000;
    const nonce = randomBytes(16).toString("hex");
    const sig = createHmac("sha256", secret).update(`${email}:${exp}:${nonce}`).digest("base64url");
    const token = `${nonce}.${exp}.${sig}`;

    sendActivationEmail(email, token).catch((e) =>
      console.error("[auth/register] activation email failed:", e)
    );

    recordNotification({
      category: "auth",
      type: "info",
      title: "New user sign-up",
      message: `${email}${fullName ? ` (${fullName})` : ""}`,
      actor: email,
      route: "/api/auth/register",
      metadata: { fullName: fullName ?? null, provider: "d1" },
    });

    slackRegistrationNotify(email).catch(() => {});
    notifyTeam(
      "New User Registration",
      email + (fullName ? ` (${fullName})` : "") + " just signed up."
    ).catch(() => {});

    return NextResponse.json({ ok: true, token });
  } catch (err) {
    console.error("[auth/register] registration failed:", err);
    return NextResponse.json({ error: "Sign up failed" }, { status: 500 });
  }
}
