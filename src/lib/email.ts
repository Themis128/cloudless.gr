import { NextResponse } from "next/server";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { getConfig } from "@/lib/ssm-config";
import { getS3Client } from "@/lib/s3-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { getD1Client } from "@/lib/d1-client";

const isWorkers = typeof (globalThis as any).caches !== "undefined" && typeof process === "undefined";

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
    const email = globalThis.__ENV__.EMAIL_BINDING;
    if (!email) {
      console.warn("[email-sender] No email binding available. Skipping send.");
      return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
    }

    try {
      const headers = {};
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
      const client = new SESv2Client({ region: cfg.AWS_REGION || "eu-west-1" });

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
          },
        },
        FromEmailAddress: `${options.fromLabel || "Cloudless"} <noreply@cloudless.gr>`,
        ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
        ReturnPath: "noreply@cloudless.gr",
        Headers: options.listUnsubscribeUrl
          ? [{ Name: "List-Unsubscribe", Value: `<${options.listUnsubscribeUrl}>` }]
          : undefined,
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
export async function sendOrderConfirmation(email: string, sessionId: string, amount: number) {
  const safeSessionId = sessionId.replace(/[<>&']/g, "");
  await sendEmail({
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
  });
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

export type { SendEmailCommandInput } from "@aws-sdk/client-sesv2";