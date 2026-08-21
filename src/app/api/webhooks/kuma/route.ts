/**
 * Uptime Kuma → Slack bridge.
 *
 * Incoming Webhook URLs were revoked (2026-05-25) and are not in the Pi
 * secret store. Kuma still speaks HTTP webhooks natively, so we accept its
 * JSON payload here and fan out via `SlackClient` (bot token → `#general`).
 *
 * Auth: `Authorization: Bearer <ADMIN_ALERT_SECRET>` (same as admin-alert),
 * or `?token=` query for providers that cannot set headers.
 *
 * Kuma default body: `{ msg, heartbeat, monitor }`.
 *
 * DNS flaps (`getaddrinfo EAI_AGAIN`, etc.) that hit many monitors at once
 * are coalesced into a single Slack message (see kuma-dns-coalesce).
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getConfig } from "@/lib/ssm-config";
import { SlackClient } from "@/lib/slack-notify";
import {
  formatDnsFlapSlack,
  getKumaDnsCoalescer,
  type CoalesceFlush,
} from "@/lib/kuma-dns-coalesce";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function extractToken(request: NextRequest): string {
  const auth = request.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const header = request.headers.get("x-cloudless-alert-secret") || "";
  if (header) return header.trim();
  return (request.nextUrl.searchParams.get("token") || "").trim();
}

function statusLabel(raw: unknown): "DOWN" | "UP" | "PENDING" | "MAINTENANCE" | "UNKNOWN" {
  if (raw === 0 || raw === "0") return "DOWN";
  if (raw === 1 || raw === "1") return "UP";
  if (raw === 2 || raw === "2") return "PENDING";
  if (raw === 3 || raw === "3") return "MAINTENANCE";
  return "UNKNOWN";
}

async function postSlack(title: string, text: string, url?: string): Promise<void> {
  const slack = new SlackClient({ channel: "#general" });
  await slack.post({
    text: title,
    blocks: [
      { type: "header", text: { type: "plain_text", text: title.slice(0, 150), emoji: true } },
      { type: "section", text: { type: "mrkdwn", text: text.slice(0, 2000) } },
      ...(url
        ? [
            {
              type: "context" as const,
              elements: [{ type: "mrkdwn" as const, text: `<${url}|probe target>` }],
            },
          ]
        : []),
    ],
  });
}

async function flushDnsBatch(flush: CoalesceFlush): Promise<void> {
  const { title, text } = formatDnsFlapSlack(flush);
  await postSlack(title, text, flush.urls[0]);
}

/** Process-local coalescer (Pi deploy is single-replica). */
const coalescer = getKumaDnsCoalescer((flush) => {
  flushDnsBatch(flush).catch(() => {});
});

export async function POST(request: NextRequest) {
  const cfg = await getConfig();
  const expected = cfg.ADMIN_ALERT_SECRET || cfg.NOTION_WEBHOOK_SECRET || "";
  if (!expected) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  const provided = extractToken(request);
  if (!provided || !safeEq(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const msg = typeof body.msg === "string" ? body.msg : "";
  const monitor =
    body.monitor && typeof body.monitor === "object"
      ? (body.monitor as Record<string, unknown>)
      : {};
  const heartbeat =
    body.heartbeat && typeof body.heartbeat === "object"
      ? (body.heartbeat as Record<string, unknown>)
      : {};

  const name = typeof monitor.name === "string" ? monitor.name : "monitor";
  const url = typeof monitor.url === "string" ? monitor.url : "";
  const status = statusLabel(heartbeat.status);

  const result = coalescer.ingest({ name, status, msg, url: url || undefined });
  if (result.action === "buffered") {
    return NextResponse.json({ ok: true, coalesced: true });
  }

  const title = `Kuma ${status}: ${name}`;
  const urlSuffix = url ? " (" + url + ")" : "";
  const text = msg || name + " is " + status + urlSuffix;
  await postSlack(title, text, url || undefined);

  // Forward to n8n so DOWN events open an EspoCRM incident case.
  const n8nBase = process.env.N8N_INTERNAL_URL ?? "http://n8n.n8n.svc.cluster.local:5678";
  fetch(`${n8nBase}/webhook/kuma-alert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, status, msg, url: url || "" }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
