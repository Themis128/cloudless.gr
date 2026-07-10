import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { getConfig } from "@/lib/ssm-config";
import { escapeHtml } from "@/lib/escape-html";
import { DEFAULT_LOCALE } from "@/lib/locale-defaults";

let sesClient: SESv2Client | null = null;

async function getSES(): Promise<SESv2Client> {
  if (sesClient) return sesClient;
  const config = await getConfig();
  sesClient = new SESv2Client({ region: config.AWS_SES_REGION });
  return sesClient;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string[];
  fromLabel?: string;
  /** When set, adds List-Unsubscribe + List-Unsubscribe-Post headers (RFC 8058). */
  listUnsubscribeUrl?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const config = await getConfig();
  const ses = await getSES();

  const fromAddress = options.fromLabel
    ? `${options.fromLabel} <${config.SES_FROM_EMAIL}>`
    : config.SES_FROM_EMAIL;

  const extraHeaders = options.listUnsubscribeUrl
    ? [
        {
          Name: "List-Unsubscribe",
          Value: `<${options.listUnsubscribeUrl}>`,
        },
        { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
      ]
    : [];

  try {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: fromAddress,
        Destination: { ToAddresses: [options.to] },
        ...(options.replyTo ? { ReplyToAddresses: options.replyTo } : {}),
        Content: {
          Simple: {
            Subject: { Data: options.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: options.html, Charset: "UTF-8" },
              Text: { Data: options.text, Charset: "UTF-8" },
            },
            ...(extraHeaders.length ? { Headers: extraHeaders } : {}),
          },
        },
      })
    );
  } catch (err: unknown) {
    // AWS SDK v3 XML parser throws a deserialization error on SES success responses
    // that contain &#xD; entities. If HTTP status is 200 the email was delivered —
    // swallow the parse error and continue.
    const meta = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata;
    if (meta?.httpStatusCode !== 200) throw err;
  }
}

export async function sendOrderConfirmation(
  customerEmail: string,
  sessionId: string,
  amountTotal: number,
  currency: string
): Promise<void> {
  const formatted = new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amountTotal / 100);

  await sendEmail({
    to: customerEmail,
    subject: `Order confirmed: ${formatted}`,
    replyTo: ["tbaltzakis@cloudless.gr"],
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00fff5;">Order Confirmed</h2>
        <p>Thanks for your purchase! Here are your order details:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #333; color: #888;">Order ID</td>
            <td style="padding: 8px; border-bottom: 1px solid #333;">${escapeHtml(sessionId)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #333; color: #888;">Total</td>
            <td style="padding: 8px; border-bottom: 1px solid #333; font-weight: bold;">${escapeHtml(formatted)}</td>
          </tr>
        </table>
        <p>If your order includes digital products, download links will be sent in a separate email shortly.</p>
        <p>If you ordered physical items, we'll notify you when they ship.</p>
        <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;" />
        <p style="color: #888; font-size: 12px;">
          Questions? Reply to this email or contact us at
          <a href="mailto:tbaltzakis@cloudless.gr" style="color: #00fff5;">tbaltzakis@cloudless.gr</a>
        </p>
      </div>
    `,
    text: [
      "Order Confirmed",
      "",
      "Thanks for your purchase!",
      "",
      `Order ID: ${sessionId}`,
      `Total: ${formatted}`,
      "",
      "If your order includes digital products, download links will be sent in a separate email shortly.",
      "If you ordered physical items, we'll notify you when they ship.",
      "",
      "Questions? Email tbaltzakis@cloudless.gr",
    ].join("\n"),
  });
}

export async function sendPaymentFailureNotice(
  customerEmail: string,
  invoiceId: string
): Promise<void> {
  await sendEmail({
    to: customerEmail,
    subject: "Payment failed for your Cloudless subscription",
    replyTo: ["tbaltzakis@cloudless.gr"],
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff4444;">Payment Failed</h2>
        <p>We were unable to process your payment for invoice <strong>${escapeHtml(invoiceId)}</strong>.</p>
        <p>Please update your payment method to keep your subscription active:</p>
        <p>
          <a href="https://cloudless.gr/contact" style="display: inline-block; padding: 12px 24px; background: #00fff5; color: #0a0a0f; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Contact Support
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;" />
        <p style="color: #888; font-size: 12px;">
          If this was a mistake, no action is needed. We'll retry the payment automatically.
        </p>
      </div>
    `,
    text: [
      "Payment Failed",
      "",
      `We were unable to process your payment for invoice ${invoiceId}.`,
      "Please update your payment method to keep your subscription active.",
      "",
      "Contact us at tbaltzakis@cloudless.gr for help.",
      "",
      "If this was a mistake, no action is needed. We'll retry the payment automatically.",
    ].join("\n"),
  });
}

export async function sendSubscriberWelcome(subscriberEmail: string): Promise<void> {
  const unsubscribeUrl = `https://cloudless.gr/api/unsubscribe?email=${encodeURIComponent(subscriberEmail)}`;
  const safeUnsub = escapeHtml(unsubscribeUrl);
  await sendEmail({
    to: subscriberEmail,
    subject: "Welcome to Cloudless — your first issue lands Monday",
    fromLabel: "Themis at Cloudless",
    listUnsubscribeUrl: unsubscribeUrl,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0f;color:#e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="padding:36px 40px 24px;border-bottom:1px solid #1e293b;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#00fff5;">Cloudless Newsletter</p>
          <h1 style="margin:0;font-size:30px;font-weight:700;color:#f1f5f9;line-height:1.25;">You're subscribed.</h1>
        </div>
        <div style="padding:28px 40px 32px;">
          <p style="margin:0 0 20px;font-size:16px;color:#94a3b8;line-height:1.7;">Every Monday morning you'll get one practical article on cloud infrastructure, serverless, analytics, or AI marketing. No filler, no hype. Written for technical decision-makers who are busy and skeptical.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr><td style="padding:0 0 10px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #00fff5;background:#0f172a;border-radius:0 6px 6px 0;">
                <tr><td style="padding:12px 16px;">
                  <p style="margin:0 0 2px;font-size:12px;font-weight:700;letter-spacing:0.5px;color:#00fff5;text-transform:uppercase;">Cloud and Serverless</p>
                  <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">Real-world cost-cutting and architecture decisions. AWS, eu-regions, actual numbers.</p>
                </td></tr>
              </table>
            </td></tr>
            <tr><td style="padding:0 0 10px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #6366f1;background:#0f172a;border-radius:0 6px 6px 0;">
                <tr><td style="padding:12px 16px;">
                  <p style="margin:0 0 2px;font-size:12px;font-weight:700;letter-spacing:0.5px;color:#6366f1;text-transform:uppercase;">Analytics and AI Marketing</p>
                  <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">Data pipelines, attribution, and AI tools that move the needle for startups and SMBs.</p>
                </td></tr>
              </table>
            </td></tr>
            <tr><td>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #f59e0b;background:#0f172a;border-radius:0 6px 6px 0;">
                <tr><td style="padding:12px 16px;">
                  <p style="margin:0 0 2px;font-size:12px;font-weight:700;letter-spacing:0.5px;color:#f59e0b;text-transform:uppercase;">Company Updates and Offers</p>
                  <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">Service announcements, free audits, and limited-time offers from Cloudless.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
          <div style="text-align:center;margin:0 0 28px;">
            <a href="https://cloudless.gr/en/blog" style="display:inline-block;padding:14px 32px;background:#00fff5;color:#0a0a0f;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:0.3px;">Browse past issues</a>
          </div>
          <p style="margin:0 0 4px;font-size:15px;color:#94a3b8;line-height:1.7;">Your first issue arrives this Monday. Until then, feel free to reply if you have a burning cloud question.</p>
          <p style="margin:20px 0 0;font-size:14px;color:#64748b;">
            Themistoklis Baltzakis<br/>
            <span style="font-size:12px;color:#475569;">AWS Certified Cloud Architect · cloudless.gr</span>
          </p>
        </div>
        <div style="padding:16px 40px;background:#080811;border-top:1px solid #1e293b;">
          <p style="margin:0;font-size:12px;color:#475569;line-height:1.8;">
            You're receiving this because you subscribed at <a href="https://cloudless.gr" style="color:#00fff5;text-decoration:none;">cloudless.gr</a>.<br/>
            <a href="${safeUnsub}" style="color:#475569;">Unsubscribe</a> · Cloudless, Athens, Greece
          </p>
        </div>
      </div>`,
    text: [
      "You're subscribed.",
      "",
      "Every Monday morning you'll get one practical article on cloud infrastructure, serverless, analytics, or AI marketing. No filler, no hype.",
      "",
      "WHAT TO EXPECT:",
      "Cloud and Serverless: Real-world cost-cutting and architecture decisions. AWS, eu-regions, actual numbers.",
      "Analytics and AI Marketing: Data pipelines, attribution, and AI tools that move the needle.",
      "Company Updates and Offers: Service announcements, free audits, and limited-time offers from Cloudless.",
      "",
      "Browse past issues: https://cloudless.gr/en/blog",
      "",
      "Your first issue arrives this Monday.",
      "",
      "Themistoklis Baltzakis",
      "AWS Certified Cloud Architect · cloudless.gr",
      "",
      `Unsubscribe: ${unsubscribeUrl}`,
    ].join("\n"),
  });
}

export async function sendBookingConfirmation(data: {
  name: string;
  email: string;
  slotLabel: string; // e.g. "Mon, 12 May, 10:00–10:30 Athens"
  meetLink: string;
  notes?: string;
}): Promise<void> {
  const safeName = escapeHtml(data.name);
  const safeSlot = escapeHtml(data.slotLabel);
  const safeMeet = escapeHtml(data.meetLink);
  const safeNotes = data.notes ? escapeHtml(data.notes) : null;

  await sendEmail({
    to: data.email,
    subject: "Your Cloudless consultation is confirmed",
    fromLabel: "Themis at Cloudless",
    replyTo: ["tbaltzakis@cloudless.gr"],
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #e0e0e0; background: #0a0a0f; padding: 32px; border-radius: 12px;">
        <h2 style="color: #00fff5; margin-top: 0;">Your consultation is confirmed ✅</h2>
        <p>Hi ${safeName},</p>
        <p>Your free 30-minute cloud audit with Themistoklis Baltzakis is all set.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #222; color: #888; width: 120px;">📅 When</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #222; font-weight: bold;">${safeSlot}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #222; color: #888;">📹 Google Meet</td>
            <td style="padding: 10px 0; border-bottom: 1px solid #222;">
              <a href="${safeMeet}" style="color: #00fff5;">Join the call</a>
            </td>
          </tr>
          ${safeNotes ? `<tr><td style="padding: 10px 0; color: #888; vertical-align: top;">📝 Notes</td><td style="padding: 10px 0;">${safeNotes}</td></tr>` : ""}
        </table>
        <p style="margin-top: 24px;">A calendar invite has been sent to this address. If you need to reschedule, just reply to this email.</p>
        <p>In the meantime, feel free to jot down any specific questions about your cloud setup — we'll cover as much ground as possible in 30 minutes.</p>
        <hr style="border: none; border-top: 1px solid #222; margin: 24px 0;" />
        <p style="color: #555; font-size: 12px;">
          Themistoklis Baltzakis · AWS Certified Cloud Architect ·
          <a href="https://cloudless.gr" style="color: #00fff5;">cloudless.gr</a>
        </p>
      </div>
    `,
    text: [
      `Hi ${data.name},`,
      "",
      "Your free 30-minute cloud audit with Themistoklis Baltzakis is confirmed.",
      "",
      `When: ${data.slotLabel}`,
      `Google Meet: ${data.meetLink}`,
      ...(data.notes ? [`Notes: ${data.notes}`, ""] : [""]),
      "A calendar invite has been sent to this address.",
      "To reschedule, reply to this email.",
      "",
      "Themistoklis Baltzakis · AWS Certified Cloud Architect · cloudless.gr",
    ].join("\n"),
  });
}

/**
 * Auto-reply to a contact form submitter.
 * Sent fire-and-forget — never blocks the contact form response.
 */
export async function sendContactAcknowledgment(data: {
  name: string;
  email: string;
  service?: string;
}): Promise<void> {
  const safeName = escapeHtml(data.name);
  const safeService = data.service ? escapeHtml(data.service) : null;

  await sendEmail({
    to: data.email,
    subject: "Thanks for reaching out — Cloudless",
    fromLabel: "Themis at Cloudless",
    replyTo: ["tbaltzakis@cloudless.gr"],
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #e0e0e0; background: #0a0a0f; padding: 32px; border-radius: 12px;">
        <h2 style="color: #00fff5; margin-top: 0;">Got your message ✉️</h2>
        <p>Hi ${safeName},</p>
        <p>Thanks for getting in touch${safeService ? ` about <strong>${safeService}</strong>` : ""}. I'll review your message and get back to you within <strong>1 business day</strong>.</p>
        <p>In the meantime, feel free to <a href="https://cloudless.gr/store" style="color: #00fff5;">browse our services</a> or <a href="https://cloudless.gr/blog" style="color: #00fff5;">read the blog</a>.</p>
        <p>Talk soon,<br/><strong>Themistoklis Baltzakis</strong><br/>AWS Certified Cloud Architect · <a href="https://cloudless.gr" style="color: #00fff5;">cloudless.gr</a></p>
        <hr style="border: none; border-top: 1px solid #222; margin: 24px 0;" />
        <p style="color: #555; font-size: 12px;">You're receiving this because you submitted the contact form at cloudless.gr. This is an automated acknowledgment — no action required.</p>
      </div>
    `,
    text: [
      `Hi ${data.name},`,
      "",
      `Thanks for getting in touch${data.service ? ` about ${data.service}` : ""}. I'll review your message and get back to you within 1 business day.`,
      "",
      "Talk soon,",
      "Themistoklis Baltzakis",
      "AWS Certified Cloud Architect · cloudless.gr",
    ].join("\n"),
  });
}

/**
 * Confirmation email sent when a subscriber successfully unsubscribes.
 */
export async function sendUnsubscribeConfirmation(email: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "You've been unsubscribed — Cloudless",
    fromLabel: "Cloudless",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #e0e0e0; background: #0a0a0f; padding: 32px; border-radius: 12px;">
        <h2 style="color: #00fff5; margin-top: 0;">Unsubscribed ✓</h2>
        <p>You've been successfully removed from the Cloudless newsletter. You won't receive any further emails from us.</p>
        <p>If this was a mistake, you can <a href="https://cloudless.gr/#newsletter" style="color: #00fff5;">re-subscribe here</a>.</p>
        <hr style="border: none; border-top: 1px solid #222; margin: 24px 0;" />
        <p style="color: #555; font-size: 12px;">Cloudless · <a href="https://cloudless.gr" style="color: #555;">cloudless.gr</a></p>
      </div>
    `,
    text: [
      "Unsubscribed",
      "",
      "You've been successfully removed from the Cloudless newsletter.",
      "If this was a mistake, visit https://cloudless.gr/#newsletter to re-subscribe.",
      "",
      "Cloudless · cloudless.gr",
    ].join("\n"),
  });
}

export async function sendActivationEmail(
  to: string,
  token: string,
  otp: string,
  name?: string
): Promise<void> {
  const activationUrl = `https://cloudless.gr/api/auth/activate?email=${encodeURIComponent(to)}&token=${encodeURIComponent(token)}`;
  const safeUrl = escapeHtml(activationUrl);
  const greeting = name ? escapeHtml(name) : "there";
  await sendEmail({
    to,
    subject: "Activate your Cloudless account",
    fromLabel: "Cloudless",
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0f;color:#e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="padding:32px 40px 24px;border-bottom:1px solid #1e293b;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#00fff5;">Cloudless</p>
          <h1 style="margin:0;font-size:26px;font-weight:700;color:#f1f5f9;">Activate your account</h1>
        </div>
        <div style="padding:28px 40px 32px;">
          <p style="margin:0 0 20px;font-size:15px;color:#94a3b8;line-height:1.7;">Hi ${greeting}, thanks for signing up. Tap the button below to activate your account.</p>
          <div style="text-align:center;margin:0 0 28px;">
            <a href="${safeUrl}" style="display:inline-block;padding:14px 36px;background:#00fff5;color:#0a0a0f;text-decoration:none;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:0.3px;">Activate Account</a>
          </div>
          <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:20px;text-align:center;margin:0 0 20px;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;">Can&rsquo;t tap the button? Enter this code instead</p>
            <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:12px;color:#00fff5;font-family:monospace;">${otp}</p>
          </div>
          <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">Both the button and the code expire in <strong style="color:#94a3b8;">5 minutes</strong>. If you didn&rsquo;t create an account, ignore this email.</p>
        </div>
        <div style="padding:16px 40px;background:#080811;border-top:1px solid #1e293b;">
          <p style="margin:0;font-size:12px;color:#475569;">Cloudless &middot; <a href="https://cloudless.gr" style="color:#00fff5;text-decoration:none;">cloudless.gr</a></p>
        </div>
      </div>`,
    text: [
      `Hi ${name ?? "there"},`,
      "",
      "Thanks for signing up to Cloudless.",
      "",
      "OPTION 1 — tap this link to activate your account:",
      activationUrl,
      "",
      `OPTION 2 — enter this 6-digit code on the verification page: ${otp}`,
      "",
      "Both expire in 5 minutes. If you didn't create an account, ignore this email.",
      "",
      "Cloudless · cloudless.gr",
    ].join("\n"),
  });
}

export async function notifyTeam(subject: string, body: string): Promise<void> {
  const config = await getConfig();
  await sendEmail({
    to: config.SES_TO_EMAIL,
    subject,
    html: `<div style="font-family: sans-serif;">${body}</div>`,
    // Strip HTML tags for the plain-text part. We split on "<" and discard
    // everything up to and including the next ">" in each segment, which avoids
    // regex backtracking patterns that static analysers flag as ReDoS-prone.
    text: body
      .split("<")
      .map((seg, i) => {
        // First segment is plain text before any tag — keep as-is.
        if (i === 0) return seg;
        // Later segments start mid-tag: drop up to and including the ">".
        if (seg.includes(">")) return seg.slice(seg.indexOf(">") + 1);
        return "";
      })
      .join(""),
  });
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const safeUrl = escapeHtml(resetUrl);
  await sendEmail({
    to: email,
    subject: "Reset your Cloudless password",
    fromLabel: "Cloudless",
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;background:#0a0a0f;color:#e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="padding:32px 40px 24px;border-bottom:1px solid #1e293b;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#00fff5;">Cloudless</p>
          <h1 style="margin:0;font-size:26px;font-weight:700;color:#f1f5f9;">Reset your password</h1>
        </div>
        <div style="padding:28px 40px 32px;">
          <p style="margin:0 0 20px;font-size:15px;color:#94a3b8;line-height:1.7;">Click the button below to set a new password for your account.</p>
          <div style="text-align:center;margin:0 0 28px;">
            <a href="${safeUrl}" style="display:inline-block;padding:14px 36px;background:#00fff5;color:#0a0a0f;text-decoration:none;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:0.3px;">Reset Password</a>
          </div>
          <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">This link expires in <strong style="color:#94a3b8;">24 hours</strong>. If you didn't request a reset, ignore this email.</p>
        </div>
        <div style="padding:16px 40px;background:#080811;border-top:1px solid #1e293b;">
          <p style="margin:0;font-size:12px;color:#475569;">Cloudless &middot; <a href="https://cloudless.gr" style="color:#00fff5;text-decoration:none;">cloudless.gr</a></p>
        </div>
      </div>`,
    text: [
      "Reset your password",
      "",
      "Click the link below to set a new password for your Cloudless account:",
      resetUrl,
      "",
      "This link expires in 24 hours. If you didn't request a reset, ignore this email.",
      "",
      "Cloudless · cloudless.gr",
    ].join("\n"),
  });
}
