import { NextResponse } from "next/server";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { getConfig } from "@/lib/ssm-config";
import { isResendConfigured, sendEmailResend } from "@/lib/email-resend";

interface CloudflareEmailBinding {
  send: (message: Record<string, unknown>) => Promise<void>;
}

interface WorkersGlobal {
  caches?: CacheStorage;
  __ENV__?: { EMAIL_BINDING?: CloudflareEmailBinding };
}

const isWorkers =
  typeof (globalThis as unknown as WorkersGlobal).caches !== "undefined" &&
  typeof process === "undefined";

/**
 * Send an email using the configured email provider.
 * @param options - Email options
 * @returns Promise<NextResponse>
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromLabel?: string;
  replyTo?: string;
  listUnsubscribeUrl?: string;
}) {
  if (isWorkers) {
    // Cloudflare Workers email binding
    const email = (globalThis as unknown as WorkersGlobal).__ENV__?.EMAIL_BINDING;
    if (!email) {
      console.warn("[email-sender] No email binding available. Skipping send.");
      return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
    }

    try {
      const headers: Record<string, string> = {};
      if (options.listUnsubscribeUrl) {
        headers["List-Unsubscribe"] = `<${options.listUnsubscribeUrl}>`;
      }

      await email.send({
        from: `${options.fromLabel || "Cloudless"} <noreply@cloudless.gr>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        headers,
      });
    } catch (err) {
      console.error("[email-sender] Cloudflare Email failed:", err);
      throw new Error(`SES failure: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    // AWS SES or R2-based email
    try {
      const cfg = await getConfig();
      const client = new SESv2Client({ region: cfg.AWS_SES_REGION || "eu-west-1" });

      const command = new SendEmailCommand({
        Destination: {
          ToAddresses: [options.to],
        },
        Content: {
          Simple: {
            Body: {
              Html: { Data: options.html },
              Text: { Data: options.text },
            },
            Subject: { Data: options.subject },
            Headers: options.listUnsubscribeUrl
              ? [{ Name: "List-Unsubscribe", Value: `<${options.listUnsubscribeUrl}>` }]
              : undefined,
          },
        },
        FromEmailAddress: `${options.fromLabel || "Cloudless"} <noreply@cloudless.gr>`,
        ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
      });

      await client.send(command);
    } catch (err) {
      console.error("[email-sender] SES failed:", err);
      throw new Error(`SES failure: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/**
 * Send a welcome email to a new subscriber.
 * @param email - Subscriber's email address
 */
export async function sendSubscriberWelcome(email: string) {
  await sendEmail({
    to: email,
    subject: "Welcome to the Cloudless newsletter!",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Welcome to Cloudless</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; }
            h1 { color: #007bff; }
            a { color: #007bff; text-decoration: none; }
            .unsubscribe { font-size: 0.8em; color: #6c757d; margin-top: 30px; }
          </style>
        </head>
        <body>
          <h1>Welcome to Cloudless!</h1>
          <p>Thank you for subscribing to our newsletter. We'll keep you updated with the latest cloud technology news and insights.</p>

          <h2>What to expect</h2>
          <ul>
            <li>Weekly updates on cloud technologies</li>
            <li>Exclusive content and offers</li>
            <li>Invitations to our events and webinars</li>
          </ul>

          <p class="unsubscribe">
            You're receiving this email because you subscribed to our newsletter.
            <a href="https://cloudless.gr/api/unsubscribe?email=${encodeURIComponent(email)}">Unsubscribe</a>
          </p>
        </body>
      </html>
    `,
    text: `
Welcome to Cloudless!

Thank you for subscribing to our newsletter. We'll keep you updated with the latest cloud technology news and insights.

What to expect:
- Weekly updates on cloud technologies
- Exclusive content and offers
- Invitations to our events and webinars

You're receiving this email because you subscribed to our newsletter.
Unsubscribe: https://cloudless.gr/api/unsubscribe?email=${encodeURIComponent(email)}
    `,
    fromLabel: "Themis at Cloudless",
    listUnsubscribeUrl: `https://cloudless.gr/api/unsubscribe?email=${encodeURIComponent(email)}`,
  });
}

/**
 * Send an order confirmation email.
 * @param email - Customer's email address
 * @param sessionId - Stripe session ID
 * @param amount - Order amount
 */
export async function sendOrderConfirmation(
  email: string,
  sessionId: string,
  amount: number,
  _currency: string = "eur"
) {
  const safeSessionId = sessionId.replace(/[<>&']/g, "");
  const payload = {
    to: email,
    subject: `Order Confirmation #${safeSessionId}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Order Confirmation</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; }
            h1 { color: #007bff; }
            .order-info { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>Thank you for your order!</h1>
          <p>Your payment has been successfully processed.</p>

          <div class="order-info">
            <p><strong>Order ID:</strong> ${safeSessionId}</p>
            <p><strong>Amount:</strong> $${amount.toFixed(2)}</p>
          </div>

          <p>We appreciate your business and look forward to serving you again.</p>
        </body>
      </html>
    `,
    text: `
Thank you for your order!

Your payment has been successfully processed.

Order ID: ${safeSessionId}
Amount: $${amount.toFixed(2)}

We appreciate your business and look forward to serving you again.
    `,
    fromLabel: "Cloudless Shop",
  };

  // R23 pilot: prefer Resend for order-confirmation flow when configured,
  // then fall back to the existing email path for reliability.
  if (!isWorkers && isResendConfigured()) {
    try {
      await sendEmailResend({
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        fromLabel: payload.fromLabel,
      });
      return;
    } catch (err) {
      console.warn("[email-sender] Resend pilot failed, falling back to SES:", err);
    }
  }

  await sendEmail(payload);
}

/**
 * Send a payment failure notice.
 * @param email - Customer's email address
 * @param invoiceId - Invoice ID
 */
export async function sendPaymentFailureNotice(email: string, invoiceId: string) {
  await sendEmail({
    to: email,
    subject: "Payment Failed",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Payment Failed</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; }
            h1 { color: #dc3545; }
            .invoice { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>Payment Failed</h1>
          <p>We were unable to process your payment for invoice ${invoiceId}.</p>

          <div class="invoice">
            <p><strong>Invoice ID:</strong> ${invoiceId}</p>
          </div>

          <p>Please update your payment information and try again.</p>
          <p>If you have any questions, please contact our support team.</p>
        </body>
      </html>
    `,
    text: `
Payment Failed

We were unable to process your payment for invoice ${invoiceId}.

Invoice ID: ${invoiceId}

Please update your payment information and try again.
If you have any questions, please contact our support team.
    `,
    fromLabel: "Cloudless Billing",
  });
}

/**
 * Notify the team about an event.
 * @param subject - Email subject
 * @param body - Email body (HTML)
 */
export async function notifyTeam(subject: string, body: string) {
  const cfg = await getConfig();
  await sendEmail({
    to: cfg.SES_TO_EMAIL,
    subject: `[Team] ${subject}`,
    html: body,
    text: body.replace(/<[^>]*>/g, ""),
    fromLabel: "Cloudless Alerts",
  });
}

/**
 * Account activation email with link + optional OTP fallback.
 */
export async function sendActivationEmail(
  to: string,
  token: string,
  otp?: string,
  name?: string
): Promise<void> {
  const { escapeHtml } = await import("@/lib/escape-html");
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://cloudless.gr";
  const activationUrl = `${site}/api/auth/activate?email=${encodeURIComponent(to)}&token=${encodeURIComponent(token)}`;
  const safeUrl = escapeHtml(activationUrl);
  const greeting = name ? escapeHtml(name) : "there";
  const otpBlock = otp
    ? `
          <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:20px;text-align:center;margin:0 0 20px;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;">Can&rsquo;t tap the button? Enter this 6-digit code instead</p>
            <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:12px;color:#00fff5;font-family:monospace;">${escapeHtml(otp)}</p>
          </div>`
    : "";
  const otpText = otp
    ? [`OPTION 2 — enter this 6-digit code on the verification page: ${otp}`, ""]
    : [];

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
          ${otpBlock}
          <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">The link${otp ? " and code" : ""} expire in <strong style="color:#94a3b8;">24 hours</strong>. If you didn&rsquo;t create an account, ignore this email.</p>
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
      ...otpText,
      "Both expire in 24 hours. If you didn't create an account, ignore this email.",
      "",
      "Cloudless · cloudless.gr",
    ].join("\n"),
  });
}

/**
 * Password reset email with a one-time reset URL.
 */
export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const { escapeHtml } = await import("@/lib/escape-html");
  const safeUrl = escapeHtml(resetUrl);
  await sendEmail({
    to: email,
    subject: "Password Reset Request",
    html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
  <h2 style="color: #00b8ff; margin-bottom: 20px;">Password Reset</h2>
  <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">You requested a password reset. Click the button below to reset your password:</p>
  <p style="text-align: center; margin: 30px 0;">
    <a href="${safeUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#00fff5,#00b8ff);color:white;text-decoration:none;border-radius:6px;font-weight:600;">Reset Password</a>
  </p>
  <p style="font-size: 14px; line-height: 1.6; color: #666;">If you didn't request this, please ignore this email.</p>
  <p style="font-size: 14px; line-height: 1.6; color: #666;">Best regards,<br /><strong>The Cloudless Team</strong></p>
</div>
    `,
    text: `Password Reset Request
You requested a password reset. Visit this URL to reset your password: ${resetUrl}

If you didn't request this, please ignore this email.

Best regards,
The Cloudless Team`,
  });
}

/** @deprecated Prefer slackRegistrationNotify from @/lib/slack-notify */
export async function slackRegistrationNotify(email: string): Promise<boolean> {
  const { slackRegistrationNotify: notify } = await import("@/lib/slack-notify");
  return notify(email);
}

export async function sendContactAcknowledgment(opts: {
  name: string;
  email: string;
  service?: string;
}): Promise<void> {
  const { escapeHtml } = await import("@/lib/escape-html");
  const safeName = escapeHtml(opts.name);
  const serviceLine = opts.service
    ? `<p>We noted your interest in <strong>${escapeHtml(opts.service)}</strong>.</p>`
    : "";
  await sendEmail({
    to: opts.email,
    subject: "We received your message — Cloudless",
    html: `
      <p>Hi ${safeName},</p>
      <p>Thanks for contacting Cloudless. We review every enquiry and typically reply within 24 hours.</p>
      ${serviceLine}
      <p>— Themis at Cloudless<br/><a href="https://cloudless.gr">cloudless.gr</a></p>
    `,
    text: [
      `Hi ${opts.name},`,
      ``,
      `Thanks for contacting Cloudless. We review every enquiry and typically reply within 24 hours.`,
      opts.service ? `We noted your interest in: ${opts.service}` : "",
      ``,
      `— Themis at Cloudless`,
      `https://cloudless.gr`,
    ]
      .filter(Boolean)
      .join("\n"),
    fromLabel: "Themis at Cloudless",
  });
}

/**
 * Confirmation email after a consultation is booked (chat or calendar).
 */

export async function sendBookingConfirmation(opts: {
  name: string;
  email: string;
  slotLabel: string;
  meetLink?: string;
  notes?: string;
}): Promise<void> {
  const { escapeHtml } = await import("@/lib/escape-html");
  const meet = opts.meetLink
    ? `<p><strong>Google Meet:</strong> <a href="${escapeHtml(opts.meetLink)}">${escapeHtml(opts.meetLink)}</a></p>`
    : "";
  await sendEmail({
    to: opts.email,
    subject: `Consultation confirmed — ${opts.slotLabel}`,
    html: `
      <p>Hi ${escapeHtml(opts.name)},</p>
      <p>Your consultation is booked:</p>
      <p><strong>${escapeHtml(opts.slotLabel)}</strong></p>
      ${meet}
      ${opts.notes ? `<p>Notes: ${escapeHtml(opts.notes)}</p>` : ""}
      <p>— Cloudless</p>
    `,
    text: [
      `Hi ${opts.name},`,
      ``,
      `Your consultation is booked: ${opts.slotLabel}`,
      opts.meetLink ? `Google Meet: ${opts.meetLink}` : "",
      opts.notes ? `Notes: ${opts.notes}` : "",
      ``,
      `— Cloudless`,
    ]
      .filter(Boolean)
      .join("\n"),
    fromLabel: "Cloudless Bookings",
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

/**
 * Account activation email with link + optional OTP fallback.
 */

export type { SendEmailCommandInput } from "@aws-sdk/client-sesv2";
