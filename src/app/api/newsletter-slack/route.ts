/**
 * POST /api/newsletter-slack — Newsletter signups to Slack relay.
 *
 * Sends a notification to Slack when a new newsletter subscriber signs up.
 * Used by the newsletters page to relay signups to #newsletters channel.
 *
 * Auth: None (public endpoint) - validates via Content-Webhook-Secret header.
 */
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getConfig } from "@/lib/ssm-config";
import { SlackClient } from "@/lib/slack-notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface NewsletterSlackBody {
  email: string;
  source?: string;
  name?: string;
  timestamp?: string;
}

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as NewsletterSlackBody;

  if (!body?.email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const config = await getConfig();
  const secret =
    process.env.APPFLOWY_WEBHOOK_SECRET ||
    process.env.CONTENT_WEBHOOK_SECRET ||
    config.APPFLOWY_JWT_SECRET ||
    "";
  // Verify webhook secret if configured
  const providedSecret = request.headers.get("x-content-webhook-secret") ?? "";
  if (secret && !safeEq(providedSecret, secret)) {
    // Allow missing secret in dev mode for testing
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Send to Slack
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const text = `📰 New newsletter signup: ${body.email}${
        body.source ? ` (source: ${body.source})` : ""
      }${body.name ? ` - ${body.name}` : ""}`;

      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    } catch (err) {
      console.error("[newsletter-slack] Slack notification failed:", err);
    }
  }

  // Also try Slack bot if webhook fails or isn't configured
  if (process.env.SLACK_BOT_TOKEN && !webhookUrl) {
    try {
      const client = new SlackClient({ channel: "#newsletters" });
      await client.post({
        text: `📰 New newsletter signup: ${body.email}${
          body.source ? ` (source: ${body.source})` : ""
        }${body.name ? ` - ${body.name}` : ""}`,
      });
    } catch (err) {
      console.error("[newsletter-slack] Slack bot notification failed:", err);
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
