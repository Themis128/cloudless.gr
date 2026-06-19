/**
 * Server-side mirror of the LinkedIn Insight-Tag conversion fired from
 * `/[locale]/campaigns/<slug>/thanks`.
 *
 * Phase 1 (2026-06-19) — this route delegates to the reusable ad-analytics
 * runtime instead of POSTing to LinkedIn CAPI directly. The runtime:
 *   1. Looks up the campaign in `src/data/campaigns.ts`.
 *   2. For each `adPlatforms[]` entry with `capiConversionId != null`,
 *      mirrors the conversion via the platform's adapter.
 *   3. For each `notifyChannels[].level === "event"`, posts a Block Kit
 *      message (Slack `#ads-realtime` by default).
 *
 * Behaviour preserved from the legacy route:
 *   - Same POST shape (`ThanksConversion.tsx` is unchanged).
 *   - Returns 204 when nothing fires (no `adPlatforms`, no `notifyChannels`,
 *     or the CAPI `capiConversionId` is still null because the operator
 *     hasn't yet created a `CONVERSIONS_API`-typed conversion in Campaign
 *     Manager — see the Gilgamesh source-bound note in
 *     `skills/ad-analytics/SKILL.md`).
 *   - Never throws — failures degrade silently so the browser-side Insight
 *     Tag (which already counted the conversion) remains the system of record.
 */

import { NextRequest, NextResponse } from "next/server";
import { dispatchConversion } from "@/lib/ad-analytics/runtime";
import { getStripe } from "@/lib/stripe";

type Body = {
  campaign?: string;
  tier?: string | null;
  orderId?: string | null;
  conversionId?: number | null;
  url?: string | null;
  userAgent?: string | null;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  } | null;
};

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.campaign) {
    return NextResponse.json({ error: "Missing campaign" }, { status: 400 });
  }

  // Enrich with Stripe customer details when orderId is a checkout session
  let customer: { name?: string; email?: string; phone?: string } | undefined;
  if (body.orderId && body.orderId.startsWith("cs_")) {
    try {
      const stripe = await getStripe();
      if (stripe) {
        const session = await stripe.checkout.sessions.retrieve(body.orderId);
        const d = session.customer_details;
        if (d) {
          customer = {
            name: d.name ?? undefined,
            email: d.email ?? undefined,
            phone: d.phone ?? undefined,
          };
        }
      }
    } catch {
      // Non-critical — Slack still fires without customer info
    }
  }

  const outcome = await dispatchConversion({
    campaign: body.campaign,
    tier: body.tier ?? null,
    orderId: body.orderId ?? null,
    conversionId: body.conversionId ?? null,
    url: body.url ?? undefined,
    userAgent: body.userAgent ?? undefined,
    country: request.headers.get("cf-ipcountry") ?? undefined,
    ipAddress: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    utm: body.utm ?? undefined,
    customer,
  });

  if (outcome.noop) {
    // Nothing to fan out — return 204 so the client treats this as "ok,
    // browser-side Insight Tag is the system of record."
    return new NextResponse(null, { status: 204 });
  }

  // 200 OK with a small JSON receipt so the dashboard / Sentry breadcrumb
  // can correlate which platforms and channels accepted the conversion.
  return NextResponse.json({
    ok: true,
    capi: outcome.capi,
    notifications: outcome.notifications,
  });
}
