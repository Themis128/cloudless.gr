import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized, cronUnauthorized } from "@/lib/cron-auth";
import { mapIntegrationError } from "@/lib/api-errors";
import { runVoiceBriefAgent } from "@/lib/agent-voice-brief";
import { SlackClient } from "@/lib/slack-notify";
import { persistVoiceBrief } from "@/lib/voice-brief-store";

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
// Persistence + notification
// ---------------------------------------------------------------------------

async function persistBrief(text: string): Promise<void> {
  await persistVoiceBrief({
    text,
    generatedAt: new Date().toISOString(),
    week: weekLabel(now()),
  });
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
  text: string,
  sources: SlackSourceSummary[],
): Promise<void> {
  const client = new SlackClient();
  const sourceLines = sources
    .map(
      (s) =>
        `${STATUS_EMOJI[s.status]} \`${s.name}\` — ${s.detail ?? s.status}`,
    )
    .join("\n");

  await client.post({
    text: "Weekly voice brief generated",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🎙️ Weekly Brief" },
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

async function handleVoiceBrief() {
  let text: string;
  let sources: SlackSourceSummary[] = [];

  try {
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
  } catch (err) {
    const mapped = mapIntegrationError(err);
    if (mapped) return mapped;
    throw err;
  }

  await safeCall(() => persistBrief(text));
  await safeCall(() => notifySlack(text, sources));

  return NextResponse.json({
    text,
    sources,
    generatedAt: new Date().toISOString(),
  });
}

// GET endpoint for manual testing / browser access
export async function GET(request: NextRequest) {
  // Still require auth for GET requests from external sources
  // Internal requests from SST Cron will use POST
  if (!await isCronAuthorized(request)) {
    return cronUnauthorized();
  }
  return handleVoiceBrief();
}

// POST endpoint for SST Cron triggers and programmatic access
export async function POST(request: NextRequest) {
  if (!await isCronAuthorized(request)) {
    return cronUnauthorized();
  }
  return handleVoiceBrief();
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";