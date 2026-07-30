import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

/**
 * POST /api/pi-proxy
 * Admin-only proxy to allowlisted Tailscale / internal hosts.
 * Open URL forwarding is blocked (CodeQL js/request-forgery).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);

/** Host suffixes from env (comma-separated) plus Tailscale defaults. */
function allowedHostSuffixes(): string[] {
  const fromEnv = (process.env.PI_PROXY_ALLOWED_HOSTS || "ts.net,tailscale.net")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv;
}

/** Tailscale CGNAT 100.64.0.0/10 */
function isTailscaleCgnatHost(hostname: string): boolean {
  const m = /^100\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = Number(m[3]);
  if (![a, b, c].every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) return false;
  return a >= 64 && a <= 127;
}

function resolveAllowedTarget(targetUrl: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  // Block obvious SSRF pivots
  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1") {
    return null;
  }
  if (parsed.hostname === "metadata.google.internal" || parsed.hostname.endsWith(".internal")) {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (isTailscaleCgnatHost(host)) return parsed;

  const suffixes = allowedHostSuffixes();
  const ok = suffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  return ok ? parsed : null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { targetUrl, method, headers, body } = (await request.json()) as {
      targetUrl?: string;
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
    };

    if (!targetUrl || typeof targetUrl !== "string") {
      return NextResponse.json({ error: "targetUrl is required" }, { status: 400 });
    }

    const allowed = resolveAllowedTarget(targetUrl);
    if (!allowed) {
      return NextResponse.json({ error: "targetUrl host is not allowlisted" }, { status: 403 });
    }

    const verb = (method || "GET").toUpperCase();
    if (!ALLOWED_METHODS.has(verb)) {
      return NextResponse.json({ error: "method not allowed" }, { status: 400 });
    }

    // Drop hop-by-hop / auth headers from the client payload
    const safeHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (headers && typeof headers === "object") {
      for (const [k, v] of Object.entries(headers)) {
        const key = k.toLowerCase();
        if (key === "host" || key === "authorization" || key === "cookie" || key === "connection") {
          continue;
        }
        if (typeof v === "string") safeHeaders[k] = v;
      }
    }

    const response = await fetch(allowed.toString(), {
      method: verb,
      headers: safeHeaders,
      body: body !== undefined && verb !== "GET" && verb !== "HEAD" ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });

    const data = await response.json().catch(() => null);

    return NextResponse.json(data ?? { ok: response.ok }, { status: response.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Proxy request failed";
    console.error("Pi-proxy error:", msg.replace(/[\r\n\x00-\x1f\x7f]/g, " "));
    return NextResponse.json({ error: "Proxy request failed" }, { status: 500 });
  }
}
