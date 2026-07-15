/**
 * Unified Email Sender — Cloudflare Email Service (primary) + AWS SES (fallback)
 *
 * In Cloudflare Workers: uses the `env.EMAIL` binding (no API keys needed).
 * In AWS Lambda: falls back to AWS SESv2.
 *
 * This module is the migration bridge; once fully on Workers, the SES fallback
 * can be removed.
 */

import { sanitizeError, sanitizeLog } from "@/lib/log-sanitizer";

export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string[];
  fromLabel?: string;
  listUnsubscribeUrl?: string;
}

// Module-level binding set by the Worker entry point
let _emailBinding: any | null = null;
let _sesFallback: any | null = null;

/** Called by the Worker fetch handler to inject the EMAIL binding. */
export function setEmailBinding(binding: any): void {
  _emailBinding = binding;
}

/** Detect if running in Cloudflare Workers (not Lambda, not Node.js). */
function isWorkers(): boolean {
  return typeof (globalThis as any).caches !== "undefined" && typeof process === "undefined";
}

/** Detect if running in a Node.js environment (Lambda, local dev). */
function isNode(): boolean {
  return typeof process !== "undefined" && !!process.env;
}

function getFromAddress(fromLabel: string | undefined, defaultFrom: string): string {
  return fromLabel ? `${fromLabel} <${defaultFrom}>` : defaultFrom;
}

async function sendViaCloudflare(
  binding: any,
  payload: SendEmailPayload,
  fromAddress: string
): Promise<void> {
  const replyTo = payload.replyTo?.[0];

  await binding.send({
    to: payload.to,
    from: { email: fromAddress, name: payload.fromLabel || "Cloudless" },
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    ...(replyTo ? { replyTo: { email: replyTo } } : {}),
    ...(payload.listUnsubscribeUrl
      ? {
          headers: {
            "List-Unsubscribe": `<${payload.listUnsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }
      : {}),
  });
}

async function getSESFallback() {
  if (_sesFallback) return _sesFallback;
  const [{ SESv2Client }, { SendEmailCommand }] = await Promise.all([
    import("@aws-sdk/client-sesv2"),
    import("@aws-sdk/client-sesv2"),
  ]);
  const { getConfig } = await import("@/lib/ssm-config");
  const cfg = await getConfig();
  _sesFallback = new SESv2Client({ region: cfg.AWS_SES_REGION || "us-east-1" });
  return { client: _sesFallback, SendEmailCommand, cfg };
}

async function sendViaSES(payload: SendEmailPayload, fromAddress: string): Promise<void> {
  const { client, SendEmailCommand, cfg } = await getSESFallback();

  const extraHeaders = payload.listUnsubscribeUrl
    ? [
        { Name: "List-Unsubscribe", Value: `<${payload.listUnsubscribeUrl}>` },
        { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
      ]
    : [];

  try {
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: fromAddress,
        Destination: { ToAddresses: [payload.to] },
        ...(payload.replyTo ? { ReplyToAddresses: payload.replyTo } : {}),
        Content: {
          Simple: {
            Subject: { Data: payload.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: payload.html, Charset: "UTF-8" },
              Text: { Data: payload.text, Charset: "UTF-8" },
            },
            ...(extraHeaders.length ? { Headers: extraHeaders } : {}),
          },
        },
      })
    );
  } catch (err: unknown) {
    const meta = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata;
    if (meta?.httpStatusCode !== 200) throw err;
  }
}

/**
 * Send an email using the best available transport.
 *
 * Priority:
 * 1. Cloudflare Email binding (Workers, no API key)
 * 2. AWS SES (Lambda / local dev with AWS creds)
 * 3. Log-and-skip (if nothing is configured — e.g. test environments)
 */
export async function sendEmail(payload: SendEmailPayload): Promise<void> {
  const { getConfig } = await import("@/lib/ssm-config");
  const cfg = await getConfig().catch(() => ({
    SES_FROM_EMAIL: "noreply@cloudless.gr",
    SES_TO_EMAIL: "tbaltzakis@cloudless.gr",
  }));

  const fromAddress = getFromAddress(
    payload.fromLabel,
    cfg.SES_FROM_EMAIL || "noreply@cloudless.gr"
  );

  // 1. Workers binding — primary
  if (_emailBinding) {
    await sendViaCloudflare(_emailBinding, payload, fromAddress);
    return;
  }

  // 2. Workers auto-detect (binding may be set via global injection)
  const globalBinding = (globalThis as any).__EMAIL_BINDING__;
  if (globalBinding) {
    await sendViaCloudflare(globalBinding, payload, fromAddress);
    return;
  }

  // 3. SES fallback — Lambda or local dev
  if (isNode()) {
    try {
      await sendViaSES(payload, fromAddress);
      return;
    } catch (err) {
      // Sanitize err to prevent format string injection (% specifiers)
      const safeErr = err instanceof Error ? err.message.replace(/%/g, "") : String(err).replace(/[\x00-\x1F\x7F]/g, "");
      console.warn("[email-sender] SES failed, logging only:", safeErr);
    }
  }

  // 4. Log mode — no transport available (tests, unconfigured environments)
  console.log("[email-sender] No email transport configured. Skipping send.");
  // Sanitize email fields to prevent log injection attacks
  console.log("  To:", String(payload.to).replace(/[\x00-\x1F\x7F]/g, ""), "Subject:", String(payload.subject).replace(/[\x00-\x1F\x7F]/g, ""));
}
