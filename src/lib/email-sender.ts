/**
 * Unified Email Sender — Cloudflare Email Service (primary)
 *
 * In Cloudflare Workers: uses the `env.EMAIL` binding (no API keys needed).
 * AWS SES fallback has been removed as part of migration to Cloudflare.
 *
 * This module is now Workers-only; SES code has been removed.
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

/**
 * Check if an email address is suppressed before sending.
 * In Workers: checks D1 email_suppression table.
 * In Lambda: skips (SES handles suppression natively - but we removed SES, so always false in Node).
 */
async function checkSuppression(toEmail: string): Promise<boolean> {
  // In Node (local dev or Lambda without SES), we don't have suppression checking
  // since we removed SES. This is safe for development.
  if (isNode() && !_emailBinding && !(globalThis as any).__EMAIL_BINDING__) {
    return false;
  }

  // In Workers, check D1 suppression list
  try {
    const { isSuppressed } = await import("@/lib/ses-suppression-d1");
    return isSuppressed(toEmail);
  } catch {
    return false;
  }
}

/**
 * Send an email using Cloudflare Email binding.
 *
 * Priority:
 * 1. Check suppression list (skip if suppressed)
 * 2. Cloudflare Email binding (Workers, no API key)
 * 3. Log-and-skip (if no binding is configured — e.g. test environments)
 */
export async function sendEmail(payload: SendEmailPayload): Promise<void> {
  // Check suppression list first
  const isSuppressed = await checkSuppression(payload.to);
  if (isSuppressed) {
    console.warn(`[email-sender] Skipping email to suppressed address`);
    return;
  }

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

  // 3. No transport available (tests, unconfigured environments)
  console.warn("[email-sender] No email binding available. Skipping send.");
  // Sanitize email fields to prevent log injection attacks
  console.log(
    "  To:",
    String(payload.to).replace(/[\x00-\x1F\x7F]/g, ""),
    "Subject:",
    String(payload.subject).replace(/[\x00-\x1F\x7F]/g, "")
  );
}
