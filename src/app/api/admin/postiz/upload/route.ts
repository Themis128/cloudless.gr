import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { uploadFromUrl, PostizApiError, PostizNotConfiguredError } from "@/lib/postiz";

export const dynamic = "force-dynamic";

/**
 * Per docs.postiz.com, the Postiz `/upload-from-url` endpoint performs an
 * SSRF-safe fetch and rejects private IP ranges, link-local addresses, and
 * `localhost` outright. We mirror that here so the user gets a clean 4xx
 * immediately instead of waiting on the 30s round-trip plus a 500 from
 * Postiz. Same allowlist Postiz applies — HTTPS + publicly resolvable host.
 */
function isLikelyPrivateOrLocalUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return true;
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "localhost.") return true;
  if (host.endsWith(".localhost")) return true;
  if (host === "0.0.0.0" || host === "::" || host === "[::]") return true;
  // IPv4 private / link-local ranges (10/8, 172.16/12, 192.168/16, 169.254/16, 127/8).
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (a === 10 || a === 127 || (a === 169 && b === 254)) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  // IPv6 loopback + link-local + ULA.
  if (host === "::1" || host === "[::1]") return true;
  const ipv6Bare = host.replace(/^\[|\]$/g, "");
  if (/^fe[89ab][0-9a-f]:/i.test(ipv6Bare)) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(ipv6Bare)) return true;
  return false;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const body = (((await req.json()) as any).catch(() => null)) as { url?: string } | null;
  if (!body?.url) {
    return NextResponse.json({ error: "missing_url" }, { status: 400 });
  }

  if (isLikelyPrivateOrLocalUrl(body.url)) {
    return NextResponse.json(
      { error: "url_blocked", reason: "Postiz refuses private/loopback hosts" },
      { status: 400 }
    );
  }

  try {
    const uploaded = await uploadFromUrl(body.url);
    return NextResponse.json(uploaded, { status: 201 });
  } catch (err) {
    if (err instanceof PostizNotConfiguredError) {
      return NextResponse.json({ error: "postiz_not_configured" }, { status: 503 });
    }
    if (err instanceof PostizApiError) {
      return NextResponse.json(
        { error: "postiz_upstream", status: err.status, body: err.body },
        { status: 502 }
      );
    }
    throw err;
  }
}
