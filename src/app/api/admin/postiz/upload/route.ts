import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  saErrorToResponse,
  uploadFromUrlToSocialAuto,
} from "@/lib/socialauto";

export const dynamic = "force-dynamic";

/**
 * SocialAuto has no upload-from-url endpoint — this route fetches the bytes
 * itself, so the private/loopback guard below is load-bearing (it protects
 * our own fetch, not just the upstream's). HTTPS + publicly resolvable
 * host only.
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

  const body = (await req.json().catch(() => null)) as { url?: string } | null;
  if (!body?.url) {
    return NextResponse.json({ error: "missing_url" }, { status: 400 });
  }

  if (isLikelyPrivateOrLocalUrl(body.url)) {
    return NextResponse.json(
      { error: "url_blocked", reason: "private/loopback hosts are not allowed" },
      { status: 400 }
    );
  }

  try {
    const uploaded = await uploadFromUrlToSocialAuto(body.url);
    return NextResponse.json(uploaded, { status: 201 });
  } catch (err) {
    return saErrorToResponse(err);
  }
}
