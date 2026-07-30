import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

/**
 * POST /api/pi-proxy
 * Admin-only proxy to preconfigured Tailscale / internal bases.
 *
 * Free-form URLs and paths are rejected. Clients pick a target + pathKey from
 * fixed allowlists; bases come from env. This keeps the fetch URL free of
 * request-tainted data (CodeQL js/request-forgery).
 *
 * Body: { target: "omv" | "funnel"; pathKey?: "root" | "health"; method?; body? }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);

/** Fixed path keys → literal path strings (never from the request). */
const PATHS = {
  root: "/",
  health: "/api/health",
} as const;

type PathKey = keyof typeof PATHS;

function readOrigin(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Resolve base via switch so env lookup keys are literals, not request data. */
function resolveOrigin(target: string): string | null {
  switch (target) {
    case "omv":
      return readOrigin(process.env.PI_PROXY_TARGET_OMV);
    case "funnel":
      return readOrigin(process.env.PI_PROXY_TARGET_FUNNEL);
    default:
      return null;
  }
}

function resolvePath(pathKey: unknown): string | null {
  if (pathKey === undefined || pathKey === null || pathKey === "") {
    return PATHS.root;
  }
  if (typeof pathKey !== "string") return null;
  if (pathKey === "root") return PATHS.root;
  if (pathKey === "health") return PATHS.health;
  return null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const payload = (await request.json()) as {
      target?: string;
      pathKey?: PathKey | string;
      method?: string;
      body?: unknown;
    };

    if (!payload.target || typeof payload.target !== "string") {
      return NextResponse.json(
        { error: 'target is required. Valid: "omv", "funnel"' },
        { status: 400 }
      );
    }

    const origin = resolveOrigin(payload.target);
    if (!origin) {
      return NextResponse.json(
        {
          error:
            "target unknown or base URL env not configured (PI_PROXY_TARGET_OMV / PI_PROXY_TARGET_FUNNEL)",
        },
        { status: 403 }
      );
    }

    const path = resolvePath(payload.pathKey);
    if (!path) {
      return NextResponse.json({ error: 'pathKey must be "root" or "health"' }, { status: 400 });
    }

    const verb = (payload.method || "GET").toUpperCase();
    if (!ALLOWED_METHODS.has(verb)) {
      return NextResponse.json({ error: "method not allowed" }, { status: 400 });
    }

    // Both origin (env) and path (string literal from PATHS) are untainted.
    const url = new URL(path, `${origin}/`);

    const response = await fetch(url.href, {
      method: verb,
      headers: { "Content-Type": "application/json" },
      body:
        payload.body !== undefined && verb !== "GET" && verb !== "HEAD"
          ? JSON.stringify(payload.body)
          : undefined,
      redirect: "manual",
    });

    const data = await response.json().catch(() => null);

    return NextResponse.json(data ?? { ok: response.ok }, { status: response.status });
  } catch {
    console.error("Pi-proxy error: upstream request failed");
    return NextResponse.json({ error: "Proxy request failed" }, { status: 500 });
  }
}
