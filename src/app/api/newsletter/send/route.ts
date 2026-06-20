import { timingSafeEqual } from "node:crypto";
import { sendEmail } from "@/lib/email";
import { listNewsletterSubscribers } from "@/lib/espocrm";
import { getConfig } from "@/lib/ssm-config";

/** Constant-time secret compare — avoids leaking the token via response timing. */
function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// The publisher script renders this token into the newsletter footer; the
// route swaps it for a per-recipient unsubscribe URL at send time.
const UNSUBSCRIBE_TOKEN = "%UNSUBSCRIBELINK%";

interface SendPayload {
  subject: string;
  html: string;
  text: string;
}

function parsePayload(body: unknown): SendPayload | null {
  if (typeof body !== "object" || body === null) return null;
  const { subject, html, text } = body as Record<string, unknown>;
  if (
    typeof subject !== "string" ||
    typeof html !== "string" ||
    typeof text !== "string" ||
    !subject.trim() ||
    !html.trim() ||
    !text.trim()
  ) {
    return null;
  }
  return { subject, html, text };
}

async function broadcast(
  recipients: string[],
  payload: SendPayload
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const to of recipients) {
    const unsubscribeUrl = `https://cloudless.gr/api/unsubscribe?email=${encodeURIComponent(to)}`;
    try {
      await sendEmail({
        to,
        subject: payload.subject,
        fromLabel: "Cloudless",
        html: payload.html.replaceAll(UNSUBSCRIBE_TOKEN, unsubscribeUrl),
        text: payload.text.replaceAll(UNSUBSCRIBE_TOKEN, unsubscribeUrl),
        listUnsubscribeUrl: unsubscribeUrl,
      });
      sent++;
    } catch (err) {
      failed++;
      console.error(`[newsletter/send] delivery failed for ${to}:`, err);
    }
  }
  return { sent, failed };
}

/**
 * Sends a rendered newsletter to every HubSpot newsletter subscriber.
 *
 * Called by scripts/publish-and-send-newsletter.ts from the weekly cron.
 * Runs on Lambda, which already holds SES permissions, so no AWS keys are
 * needed in CI. Authenticated with the shared NEWSLETTER_SEND_SECRET.
 */
export async function POST(request: Request): Promise<Response> {
  const config = await getConfig();
  const secret = config.NEWSLETTER_SEND_SECRET;
  if (!secret) {
    return Response.json({ error: "Newsletter sending is not configured." }, { status: 503 });
  }
  if (!secretsMatch(request.headers.get("x-newsletter-secret"), secret)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = parsePayload(rawBody);
  if (!payload) {
    return Response.json({ error: "subject, html and text are required." }, { status: 400 });
  }

  const recipients = await listNewsletterSubscribers();
  if (recipients.length === 0) {
    return Response.json({ sent: 0, failed: 0, total: 0 });
  }

  const { sent, failed } = await broadcast(recipients, payload);
  return Response.json({ sent, failed, total: recipients.length });
}
