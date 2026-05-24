import { NextRequest, NextResponse } from "next/server";
import { SSMClient, PutParameterCommand } from "@aws-sdk/client-ssm";
import { getConfig } from "@/lib/ssm-config";
import { getSeoSnapshot } from "@/lib/gsc";
import {
  isHubSpotConfigured,
  getPipelineStats,
  listNewsletterSubscribers,
} from "@/lib/hubspot";
import { getStripe } from "@/lib/stripe";
import { isCronAuthorized, cronUnauthorized } from "@/lib/cron-auth";
import { mapIntegrationError } from "@/lib/api-errors";
import { runVoiceBriefAgent } from "@/lib/agent-voice-brief";
import { SlackClient } from "@/lib/slack-notify";

const SSM_PARAM_NAME = "/cloudless/VOICE_BRIEF_LATEST";

function now() {
  return new Date();
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function weekLabel(d: Date): string {
  return `${d.getFullYear()}-W${String(getWeekNumber(d)).padStart(2, "0")}`;
}

async function safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Legacy pipeline — kept available via ?legacy=true for at least one release
// cycle so the agent path can be A/B'd. Lifted verbatim from the pre-agent
// implementation.
// ---------------------------------------------------------------------------

async function buildLegacyBriefText(
  cfg: Record<string, string | undefined>,
): Promise<string> {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-IE", {
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
    (await isHubSpotConfigured())
      ? safeCall(async () => {
          const subs = await listNewsletterSubscribers();
          return { totalContacts: subs.length, totalCampaigns: 0 };
        })
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
      `Search: ${seo.clicks.toLocaleString()} clicks, ${seo.impressions.toLocaleString()} impressions, average CTR ${seo.ctr.toFixed(1)}%.`,
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

async function narrateLegacyBrief(
  rawText: string,
  apiKey: string | undefined,
): Promise<string> {
  if (!apiKey) return rawText;
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
    if (!res.ok) return rawText;
    const data = await res.json();
    return data.content?.[0]?.text ?? rawText;
  } catch {
    return rawText;
  }
}

// ---------------------------------------------------------------------------
// Persistence + notification — shared by both legacy and agent paths.
// ---------------------------------------------------------------------------

async function persistBrief(
  text: string,
  cfg: Record<string, string | undefined>,
): Promise<void> {
  const region = cfg.AWS_REGION ?? "eu-central-1";
  const client = new SSMClient({ region });
  const brief = {
    text,
    generatedAt: new Date().toISOString(),
    week: weekLabel(now()),
  };
  await client.send(
    new PutParameterCommand({
      Name: SSM_PARAM_NAME,
      Value: JSON.stringify(brief),
      Type: "String",
      Overwrite: true,
    }),
  );
}

interface SlackSourceSummary {
  name: string;
  status: "ok" | "failed" | "skipped";
  detail?: string;
}

const STATUS_EMOJI: Record<SlackSourceSummary["status"], string> = {
  ok: "✅",
  failed: "❌",
  skipped: "⏭️",
};

async function notifySlack(
  mode: "agent" | "legacy",
  text: string,
  sources: SlackSourceSummary[],
): Promise<void> {
  const client = new SlackClient();
  const sourceLines =
    sources.length > 0
      ? sources
          .map(
            (s) =>
              `${STATUS_EMOJI[s.status]} \`${s.name}\` — ${s.detail ?? s.status}`,
          )
          .join("\n")
      : "_no per-source breakdown (legacy path)_";

  await client.post({
    text: `Weekly voice brief generated (${mode})`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `🎙️ Weekly Brief — ${mode}` },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: text.slice(0, 2500) },
      },
      { type: "divider" },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Sources*\n${sourceLines}` },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!(await isCronAuthorized(request))) {
    return cronUnauthorized();
  }

  const useLegacy = new URL(request.url).searchParams.get("legacy") === "true";

  const cfg = (await getConfig()) as unknown as Record<
    string,
    string | undefined
  >;

  let text: string;
  let sources: SlackSourceSummary[] = [];

  try {
    if (useLegacy) {
      const apiKey = cfg.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
      const raw = await buildLegacyBriefText(cfg);
      text = await narrateLegacyBrief(raw, apiKey);
    } else {
      const agentResult = await runVoiceBriefAgent({
        dateLabel: new Date().toLocaleDateString("en-IE", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      });
      text = agentResult.text;
      sources = agentResult.sources;
    }
  } catch (err) {
    const mapped = mapIntegrationError(err);
    if (mapped) return mapped;
    throw err;
  }

  await safeCall(() => persistBrief(text, cfg));
  await safeCall(() =>
    notifySlack(useLegacy ? "legacy" : "agent", text, sources),
  );

  return NextResponse.json({
    text,
    mode: useLegacy ? "legacy" : "agent",
    sources,
    generatedAt: new Date().toISOString(),
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
