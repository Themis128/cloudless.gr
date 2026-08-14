import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getUnifiedFromLake } from "@/lib/datalake-serve";
import { getStripeAnalyticsSnapshot } from "@/lib/stripe-analytics-read";

/** Unified analytics — gold KPIs + D1 Stripe dailyTrend when AUTH_DB is bound. */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const days = Math.max(
    1,
    Math.min(Number(request.nextUrl.searchParams.get("days") ?? "28"), 365 * 2)
  );

  const payload = await getUnifiedFromLake(days);
  const stripe =
    payload.stripe && typeof payload.stripe === "object"
      ? ({ ...(payload.stripe as Record<string, unknown>) } as Record<string, unknown>)
      : null;

  if (stripe) {
    try {
      const snap = await getStripeAnalyticsSnapshot(days);
      stripe.dailyTrend = snap.dailyTrend;
      stripe.dailyTrendSource = "d1-stripe-transaction";
    } catch {
      stripe.dailyTrend = Array.isArray(stripe.dailyTrend) ? stripe.dailyTrend : [];
      stripe.dailyTrendSource = "unavailable";
    }
  }

  return NextResponse.json({
    seo: payload.seo,
    pipeline: payload.pipeline,
    email: payload.email,
    stripe,
    attribution: payload.attribution,
    keywords: payload.keywords,
    sectionsMissing: payload.sectionsMissing,
    fetchedAt: payload.fetchedAt,
    source: payload.source,
    _filters: { days },
  });
}
