/**
 * Cloudflare Email Service (REST) — Node/Pi path.
 * Prefers CLOUDFLARE_EMAIL_API_TOKEN (Email Sending Write); falls back to
 * CLOUDFLARE_API_TOKEN. Account: CLOUDFLARE_ACCOUNT_ID.
 * https://developers.cloudflare.com/email-service/api/send-emails/rest-api/
 */

export interface CloudflareEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string[];
  from?: string;
  fromLabel?: string;
  listUnsubscribeUrl?: string;
}

function cloudflareEmailApiToken(): string | undefined {
  return process.env.CLOUDFLARE_EMAIL_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
}

export function isCloudflareEmailConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && cloudflareEmailApiToken());
}

export async function sendEmailCloudflare(options: CloudflareEmailOptions): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = cloudflareEmailApiToken();
  if (!accountId || !apiToken) {
    throw new Error(
      "CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_EMAIL_API_TOKEN (or CLOUDFLARE_API_TOKEN) not configured"
    );
  }

  const fromEmail = options.from || "noreply@cloudless.gr";
  const fromAddress = options.fromLabel
    ? `${options.fromLabel} <${fromEmail}>`
    : `Cloudless <${fromEmail}>`;

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
