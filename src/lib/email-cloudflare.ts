/**
 * Cloudflare Email Service (REST) — Node/Pi path.
 * Uses CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (same as Workers AI).
 * https://developers.cloudflare.com/email-service/api/send-emails/rest-api/
 */

export interface CloudflareEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string[];
  fromLabel?: string;
  listUnsubscribeUrl?: string;
}

export function isCloudflareEmailConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
}

export async function sendEmailCloudflare(options: CloudflareEmailOptions): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN not configured");
  }

  const fromAddress = options.fromLabel
    ? `${options.fromLabel} <noreply@cloudless.gr>`
    : "Cloudless <noreply@cloudless.gr>";

  const headers: Record<string, string> = {};
  if (options.listUnsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${options.listUnsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const body: Record<string, unknown> = {
    to: options.to,
    from: fromAddress,
    subject: options.subject,
    html: options.html,
    text: options.text,
  };
  if (options.replyTo?.length) {
    body.reply_to = options.replyTo.length === 1 ? options.replyTo[0] : options.replyTo;
  }
  if (Object.keys(headers).length > 0) {
    body.headers = headers;
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = (await response.json()) as {
    success?: boolean;
    errors?: { message?: string }[];
    result?: { permanent_bounces?: string[] };
  };

  if (!response.ok || !data.success) {
    const msg = data.errors?.[0]?.message ?? `Cloudflare Email HTTP ${response.status}`;
    throw new Error(msg);
  }

  if (data.result?.permanent_bounces?.length) {
    throw new Error(
      `Cloudflare Email permanent bounce: ${data.result.permanent_bounces.join(", ")}`
    );
  }
}
