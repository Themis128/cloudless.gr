import { NextRequest, NextResponse } from "next/server";
import { trackS3Event } from "@/lib/analytics";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const rl = rateLimit(`analytics:${getClientIp(req)}`, 60, 60_000);
  if (!rl.ok) return rl.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = typeof body.event === "string" ? body.event.slice(0, 100) : null;
  if (!event) return NextResponse.json({ error: "event required" }, { status: 400 });

  // Require analytics consent for client-submitted events (GDPR Art.6(1)(a))
  const cookieHeader = req.headers.get("cookie") ?? "";
  const analyticsConsented = (() => {
    try {
      const raw = cookieHeader.match(/cookieConsent=([^;]+)/)?.[1];
      return raw ? JSON.parse(decodeURIComponent(raw)).analytics === true : false;
    } catch {
      return false;
    }
  })();
  if (!analyticsConsented) return NextResponse.json({ ok: true }); // silent no-op

  // Enrich with server-side session if available
  const session = await auth().catch(() => null);

  trackS3Event({
    event,
    user_id: session?.user?.id ?? (typeof body.user_id === "string" ? body.user_id : undefined),
    email: session?.user?.email ?? (typeof body.email === "string" ? body.email : undefined),
    page: typeof body.page === "string" ? body.page : undefined,
    referrer: typeof body.referrer === "string" ? body.referrer : undefined,
    source: typeof body.source === "string" ? body.source : undefined,
    campaign: typeof body.campaign === "string" ? body.campaign : undefined,
    medium: typeof body.medium === "string" ? body.medium : undefined,
    ip: getClientIp(req),
    user_agent: req.headers.get("user-agent") ?? undefined,
    properties:
      typeof body.properties === "object" && body.properties !== null
        ? (body.properties as Record<string, unknown>)
        : undefined,
  });

  return NextResponse.json({ ok: true });
}
