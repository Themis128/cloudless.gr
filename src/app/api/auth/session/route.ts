import { NextRequest, NextResponse } from "next/server";
import {
  getUserBySession,
  deleteSession,
  isAdmin,
  getAuthDbFromEnv,
  type AuthDatabase,
} from "@/lib/auth-d1";

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

export async function GET(req: NextRequest) {
  const db = getDb(req);
  if (!db) {
    return NextResponse.json({ user: null });
  }

  const sessionId = req.cookies.get("session_token")?.value;
  if (!sessionId) {
    return NextResponse.json({ user: null });
  }

  try {
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
  } catch {
    const response = NextResponse.json({ user: null });
    response.cookies.delete("session_token");
    return response;
  }
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
