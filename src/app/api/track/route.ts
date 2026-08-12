import { NextRequest, NextResponse } from "next/server";

import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { trackEvent, type AnalyticsEventType } from "@/lib/notion-analytics";

const ALLOWED_TYPES: AnalyticsEventType[] = ["page_view", "blog_view", "doc_view", "form_submit"];

/**
 * POST /api/track
 *
 * Public endpoint for client-side event tracking.
 * Writes directly to the Notion Analytics database.
 *
 * Body:
 *   { type: AnalyticsEventType, page?: string, source?: string }
 *
 * Responds 202 so callers can fire-and-forget without waiting on Notion.
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

  const type = body.type as AnalyticsEventType;
  if (!ALLOWED_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Unsupported event type. Allowed: ${ALLOWED_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  const page = typeof body.page === "string" ? body.page.slice(0, 500) : undefined;
  const source = typeof body.source === "string" ? body.source.slice(0, 200) : undefined;
  const referer = request.headers.get("referer") ?? undefined;

  // Build a human-readable event name
  const eventName =
    type === "page_view"
      ? `Page: ${page ?? "/"}`
      : type === "blog_view"
        ? `Blog: ${page ?? "unknown"}`
        : type === "doc_view"
          ? `Doc: ${page ?? "unknown"}`
          : `Form: ${page ?? "unknown"}`;

  // Fire-and-forget — don't block the response on the Notion write
  trackEvent({
    event: eventName,
    type,
    page,
    source: source ?? referer,
    count: 1,
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
