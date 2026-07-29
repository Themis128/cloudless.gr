/**
 * R23: Resend pilot for order-confirmation flow
 * Alternative email provider (vs SES baseline). Keep SES for ETL/bulk.
 */

import { Resend } from "resend";

interface ResendOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string[];
  fromLabel?: string;
  listUnsubscribeUrl?: string;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (resendClient) return resendClient;
  if (!isResendConfigured()) return null;
  resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

export async function sendEmailResend(options: ResendOptions): Promise<void> {
  const client = getResendClient();
  if (!client) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const fromAddress = options.fromLabel
    ? `${options.fromLabel} <orders@cloudless.gr>`
    : "orders@cloudless.gr";

  try {
    const { error } = await client.emails.send({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      ...(options.replyTo ? { replyTo: options.replyTo } : {}),
      ...(options.listUnsubscribeUrl
        ? {
            headers: {
              "List-Unsubscribe": `<${options.listUnsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }
        : {}),
    });
    if (error) {
      throw new Error(
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "Resend send failed"
      );
    }
  } catch (err) {
    console.error("[resend] Email send failed:", err);
    throw err;
  }
}
