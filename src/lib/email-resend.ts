/**
 * R23: Resend pilot for order-confirmation flow
 * Alternative email provider (vs SES baseline). Keep SES for ETL/bulk.
 */

// Lazy-load Resend to allow compilation without the package installed
// Operator: npm install resend, then add RESEND_API_KEY to SSM

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

let resendClient: unknown = null;

function getResendClient(): unknown {
  if (resendClient) return resendClient;
  if (isResendConfigured()) {
    // Dynamic import to avoid hard dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    resendClient = new (require("resend").Resend)(process.env.RESEND_API_KEY);
  }
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
    await (client as { emails: { send: (opts: Record<string, unknown>) => Promise<unknown> } }).emails.send({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      ...(options.replyTo ? { replyTo: options.replyTo.join(",") } : {}),
      ...(options.listUnsubscribeUrl
        ? {
            headers: {
              "List-Unsubscribe": `<${options.listUnsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }
        : {}),
    });
  } catch (err) {
    console.error("[resend] Email send failed:", err);
    throw err;
  }
}