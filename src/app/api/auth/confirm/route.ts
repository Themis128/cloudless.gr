import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getAuthDbFromEnv, markEmailVerified, type AuthDatabase } from "@/lib/auth-d1";
import { verifyActivationOtp } from "@/lib/auth-activation";

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

/**
 * POST /api/auth/confirm — D1 email verification.
 * Body: { email, code, token } where code is the 6-digit OTP and token is the HMAC payload.
 */
export async function POST(req: NextRequest) {
  const ipRl = rateLimit(`auth-confirm:ip:${getClientIp(req)}`, 10, 60_000);
  if (!ipRl.ok) return ipRl.response;

  let email: string | undefined;
  let code: string | undefined;
  let token: string | undefined;
  try {
    const body = (await req.json()) as { email?: string; code?: string; token?: string };
    email = typeof body.email === "string" ? body.email.toLowerCase().trim() : undefined;
    code = typeof body.code === "string" ? body.code.trim() : undefined;
    token = typeof body.token === "string" ? body.token : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!email || !code)
    return NextResponse.json({ error: "Email and code required" }, { status: 400 });

  if (!token)
    return NextResponse.json(
      { error: "token required for D1 confirmation (use /api/auth/activate)" },
      { status: 400 }
    );

  if (!verifyActivationOtp(email, code, token))
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });

  let db = getAuthDbFromEnv();
  // Fallback to HTTP D1 client if the binding is not available (e.g., in some environments)
  if (!db) {
    const fallback = getHttpAuthDbFallback();
    if (fallback) {
      db = fallback;
    }
  }
  if (!db) return NextResponse.json({ error: "Auth not configured" }, { status: 503 });

  const ok = await markEmailVerified(db, email);
  if (!ok) return NextResponse.json({ error: "Confirmation failed" }, { status: 500 });

  return NextResponse.json({ ok: true, provider: "d1" });
}
