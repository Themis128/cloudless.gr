import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getConfig } from "@/lib/ssm-config";
import { getSeoSnapshot } from "@/lib/gsc";
import { isHubSpotConfigured, getPipelineStats } from "@/lib/hubspot";
import {
  isActiveCampaignConfigured,
  getEmailStats,
} from "@/lib/activecampaign";
import { getStripe } from "@/lib/stripe";

async function safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const config = await getConfig();

  const [seo, pipeline, email, stripe] = await Promise.all([
    config.GOOGLE_CLIENT_EMAIL && config.GOOGLE_PRIVATE_KEY
      ? safeCall(() => getSeoSnapshot())
      : Promise.resolve(null),

    (await isHubSpotConfigured())
      ? safeCall(() => getPipelineStats())
      : Promise.resolve(null),

    (await isActiveCampaignConfigured())
      ? safeCall(() => getEmailStats())
      : Promise.resolve(null),

    config.STRIPE_SECRET_KEY
      ? safeCall(async () => {
          const stripeClient = await getStripe();
          const [sessions, subscriptions] = await Promise.all([
            stripeClient.checkout.sessions.list({ limit: 100 }),
            stripeClient.subscriptions.list({ limit: 100, status: "active" }),
          ]);
          const revenue = sessions.data
            .filter((s) => s.payment_status === "paid")
            .reduce((acc, s) => acc + (s.amount_total ?? 0), 0);
          return {
            totalOrders: sessions.data.filter(
              (s) => s.payment_status === "paid",
            ).length,
            revenue: revenue / 100,
            activeSubscriptions: subscriptions.data.length,
            mrr:
              subscriptions.data.reduce(
                (acc, sub) =>
                  acc + (sub.items.data[0]?.price?.unit_amount ?? 0),
                0,
              ) / 100,
          };
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    seo,
    pipeline,
    email,
    stripe,
    fetchedAt: new Date().toISOString(),
  });
}
