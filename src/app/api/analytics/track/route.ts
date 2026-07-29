import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import {
  isFunnelEventType,
  normalizeFunnelEvent,
  recordFunnelEvent,
  type FunnelEventType,
} from "@/lib/search-funnel";
import { trackAnalyticsEvent } from "@/lib/analytics";

/**
 * Consent-gated analytics ingest — Cloudflare D1 only (no S3).
 * Funnel events → search_funnel_events; everything else → analytics_events.
 */
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

  const cookieHeader = req.headers.get("cookie") ?? "";
  const analyticsConsented = (() => {
    try {
      const raw = cookieHeader.match(/cookieConsent=([^;]+)/)?.[1];
      return raw ? JSON.parse(decodeURIComponent(raw)).analytics === true : false;
    } catch {
      return false;
    }
  })();
  if (!analyticsConsented) return NextResponse.json({ ok: true });

  const session = await auth().catch(() => null);
  const properties =
    typeof body.properties === "object" && body.properties !== null
      ? (body.properties as Record<string, unknown>)
      : {};

  if (isFunnelEventType(event)) {
    const session_id =
      (typeof body.session_id === "string" && body.session_id) ||
      (typeof properties.session_id === "string" && properties.session_id) ||
      "";
    const normalized = normalizeFunnelEvent({
      event_type: event as FunnelEventType,
      session_id,
      query: typeof properties.query === "string" ? properties.query : undefined,
      result_ids: Array.isArray(properties.result_ids)
        ? (properties.result_ids as string[])
        : undefined,
      product_id:
        typeof properties.product_id === "string"
          ? properties.product_id
          : typeof body.product_id === "string"
            ? body.product_id
            : undefined,
      source: typeof properties.source === "string" ? properties.source : undefined,
      result_count:
        typeof properties.result_count === "number" ? properties.result_count : undefined,
      ab_variant: typeof properties.ab_variant === "string" ? properties.ab_variant : undefined,
      user_id: session?.user?.id ?? (typeof body.user_id === "string" ? body.user_id : undefined),
    });

    if (normalized) {
      const written = await recordFunnelEvent(normalized);
      return NextResponse.json({ ok: true, sink: written ? "d1-funnel" : "noop" });
    }
    return NextResponse.json({ ok: true, sink: "noop" });
  }

  const written = await trackAnalyticsEvent({
    event,
    user_id: session?.user?.id ?? (typeof body.user_id === "string" ? body.user_id : undefined),
    email: session?.user?.email ?? (typeof body.email === "string" ? body.email : undefined),
    session_id: typeof body.session_id === "string" ? body.session_id : undefined,
    page: typeof body.page === "string" ? body.page : undefined,
    referrer: typeof body.referrer === "string" ? body.referrer : undefined,
    source: typeof body.source === "string" ? body.source : undefined,
    campaign: typeof body.campaign === "string" ? body.campaign : undefined,
    medium: typeof body.medium === "string" ? body.medium : undefined,
    product_id: typeof body.product_id === "string" ? body.product_id : undefined,
    properties,
  });

  return NextResponse.json({ ok: true, sink: written ? "d1" : "noop" });
}
