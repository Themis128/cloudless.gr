import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

/**
 * POST /api/pi-proxy
 * Admin-only proxy to preconfigured Tailscale / internal bases.
 *
 * Clients pass a target *key* (not a free-form URL). Bases come from env so
 * the fetch destination is never user-controlled (CodeQL js/request-forgery).
 *
 * Body: { target: "omv" | "funnel" | ...; method?; path?; body? }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);

/** Map of public target keys → env vars holding the absolute base URL. */
const TARGET_ENV_KEYS = {
  omv: "PI_PROXY_TARGET_OMV",
  funnel: "PI_PROXY_TARGET_FUNNEL",
} as const;

type ProxyTarget = keyof typeof TARGET_ENV_KEYS;

function resolveBase(target: string): string | null {
  if (!(target in TARGET_ENV_KEYS)) return null;
  const envName = TARGET_ENV_KEYS[target as ProxyTarget];
  const base = process.env[envName]?.trim();
  if (!base) return null;
  try {
    const u = new URL(base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Path must be absolute on the origin — no scheme-relative `//` pivots. */
function normalizePath(path: unknown): string | null {
  if (path === undefined || path === null || path === "") return "/";
  if (typeof path !== "string") return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.includes("\\") || path.includes("\0")) return null;
  return path;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { target, method, path, body } = (await request.json()) as {
      target?: string;
      method?: string;
      path?: string;
      body?: unknown;
    };

    if (!target || typeof target !== "string") {
      return NextResponse.json(
        { error: `target is required. Valid: ${Object.keys(TARGET_ENV_KEYS).join(", ")}` },
        { status: 400 }
      );
    }

    const origin = resolveBase(target);
    if (!origin) {
      return NextResponse.json(
        {
          error:
            "target unknown or base URL env not configured (PI_PROXY_TARGET_OMV / PI_PROXY_TARGET_FUNNEL)",
        },
        { status: 403 }
      );
    }

    const safePath = normalizePath(path);
    if (!safePath) {
      return NextResponse.json({ error: "path must be a root-absolute path" }, { status: 400 });
    }

    const verb = (method || "GET").toUpperCase();
    if (!ALLOWED_METHODS.has(verb)) {
      return NextResponse.json({ error: "method not allowed" }, { status: 400 });
    }

    // `origin` is from env (trusted); path is constrained to `/…` — never a free URL.
    const url = new URL(safePath, `${origin}/`);

    const response = await fetch(url, {
      method: verb,
      headers: { "Content-Type": "application/json" },
      body:
        body !== undefined && verb !== "GET" && verb !== "HEAD" ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });

    const data = await response.json().catch(() => null);

    return NextResponse.json(data ?? { ok: response.ok }, { status: response.status });
  } catch {
    console.error("Pi-proxy error: upstream request failed");
    return NextResponse.json({ error: "Proxy request failed" }, { status: 500 });
  }
}
