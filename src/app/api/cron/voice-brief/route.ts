import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/ssm-config";
import { getSeoSnapshot } from "@/lib/gsc";
import { isHubSpotConfigured, getPipelineStats } from "@/lib/hubspot";
import {
  isActiveCampaignConfigured,
  getEmailStats,
} from "@/lib/activecampaign";
import { getStripe } from "@/lib/stripe";
import { isCronAuthorized, cronUnauthorized } from "@/lib/cron-auth";
import { mapIntegrationError } from "@/lib/api-errors";

async function safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

async function buildBriefText(
  cfg: Record<string, string | undefined>,
): Promise<string> {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const [seo, pipeline, email, stripeData] = await Promise.all([
    cfg.GOOGLE_CLIENT_EMAIL && cfg.GOOGLE_PRIVATE_KEY
      ? safeCall(() => getSeoSnapshot())
      : Promise.resolve(null),
    (await isHubSpotConfigured())
      ? safeCall(() => getPipelineStats())
      : Promise.resolve(null),
    (await isActiveCampaignConfigured())
      ? safeCall(() => getEmailStats())
      : Promise.resolve(null),
    cfg.STRIPE_SECRET_KEY
      ? safeCall(async () => {
          const stripe = await getStripe();
          const sessions = await stripe.checkout.sessions.list({ limit: 50 });
          const paid = sessions.data.filter((s) => s.payment_status === "paid");
          const rev = paid.reduce((a, s) => a + (s.amount_total ?? 0), 0) / 100;
          return { orders: paid.length, revenue: rev };
        })
      : Promise.resolve(null),
  ]);

  const lines: string[] = [`Weekly brief for Cloudless.gr — ${dateStr}.`, ""];

  if (stripeData) {
    lines.push(
      `Revenue: ${stripeData.orders} paid orders this period, totalling €${stripeData.revenue.toFixed(0)}.`,
    );
  }
  if (seo) {
    lines.push(
      `Search: ${seo.clicks.toLocaleString()} clicks, ${seo.impressions.toLocaleString()} impressions, average CTR ${(seo.ctr * 100).toFixed(1)}%.`,
    );
  }
  if (pipeline) {
    lines.push(
      `Pipeline: ${pipeline.totalDeals} open deals valued at €${(pipeline.totalValue / 100).toFixed(0)}.`,
    );
  }
  if (email) {
    lines.push(
      `Email: ${email.totalContacts.toLocaleString()} contacts across ${email.totalCampaigns} campaigns.`,
    );
  }

  lines.push(
    "",
    "That concludes this week's Cloudless brief. Stay focused and keep shipping.",
  );
  return lines.join(" ");
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return cronUnauthorized();
  }

  const cfg = (await getConfig()) as unknown as Record<
    string,
    string | undefined
  >;
  const apiKey = cfg.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

  const rawText = await buildBriefText(cfg);

  let enhancedText = rawText;
  if (apiKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          messages: [
            {
              role: "user",
              content: `You are a professional narrator for a weekly business brief. Rewrite the following raw metrics as a polished, conversational 3–5 sentence spoken brief suitable for text-to-speech. Keep it factual, positive, and concise. Do not add information not present in the input.\n\n${rawText}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        const data = await res.json();
        enhancedText = data.content?.[0]?.text ?? rawText;
      }
    } catch (err) {
      const _r = mapIntegrationError(err); if (_r) return _r;
      // fall back to raw text
    }
  }

  // Store brief in SSM for the admin page to retrieve
  try {
    const SSM = await import("@aws-sdk/client-ssm");
    const region = cfg.AWS_REGION ?? "eu-central-1";
    const client = new SSM.SSMClient({ region });
    const brief = {
      text: enhancedText,
      generatedAt: new Date().toISOString(),
      week: `${now().getFullYear()}-W${String(getWeekNumber(now())).padStart(2, "0")}`,
    };
    await client.send(
      new SSM.PutParameterCommand({
        Name: "/cloudless/VOICE_BRIEF_LATEST",
        Value: JSON.stringify(brief),
        Type: "String",
        Overwrite: true,
      }),
    );
  } catch (err) {
    const _r = mapIntegrationError(err); if (_r) return _r;
    // SSM unavailable — still return the brief
  }

  return NextResponse.json({
    text: enhancedText,
    generatedAt: new Date().toISOString(),
  });
}

function now() {
  return new Date();
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
