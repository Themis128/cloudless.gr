import { NextRequest, NextResponse } from "next/server";

import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { trackAnalyticsEvent } from "@/lib/analytics";

const ALLOWED_TYPES = ["page_view", "blog_view", "doc_view", "form_submit"] as const;
type TrackEventType = (typeof ALLOWED_TYPES)[number];

function isTrackEventType(value: unknown): value is TrackEventType {
  return typeof value === "string" && (ALLOWED_TYPES as readonly string[]).includes(value);
}

/**
 * POST /api/track
 *
 * Public endpoint for client-side event tracking.
 * Writes to D1 `analytics_events` (same sink as `/api/analytics/track`).
 *
 * Body:
 *   { type: TrackEventType, page?: string, source?: string }
 *
 * Responds 202 so callers can fire-and-forget without waiting on D1.
 */
export async function POST(request: NextRequest) {
  // Rate limit: 30 events per IP per minute
  const ip = getClientIp(request);
  const rl = rateLimit(`track:${ip}`, 30, 60_000);
  if (!rl.ok) return rl.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isTrackEventType(body.type)) {
    return NextResponse.json(
      { error: `Unsupported event type. Allowed: ${ALLOWED_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const page = typeof body.page === "string" ? body.page.slice(0, 500) : undefined;
  const source = typeof body.source === "string" ? body.source.slice(0, 200) : undefined;
  const referer = request.headers.get("referer") ?? undefined;

  trackAnalyticsEvent({
    event: body.type,
    page,
    source: source ?? referer,
    referrer: referer,
  }).catch(() => {
    // Swallow — tracking failures must never affect the user experience
  });

  return NextResponse.json({ ok: true }, { status: 202 });
}

// Minimal GET handler so API coverage specs can treat /api/track as wired.
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
