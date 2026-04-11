import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { getConfig } from "@/lib/ssm-config";
import { escapeHtml } from "@/lib/escape-html";
import { DEFAULT_LOCALE } from "@/lib/locale-defaults";

let sesClient: SESClient | null = null;

function ensureSesConfig(config: {
  SES_FROM_EMAIL: string;
  SES_TO_EMAIL: string;
  AWS_SES_REGION: string;
}): void {
  if (!config.SES_FROM_EMAIL || !config.SES_TO_EMAIL) {
    throw new Error(
      "Missing required SES config: SES_FROM_EMAIL and SES_TO_EMAIL must be set",
    );
  }
  if (!config.AWS_SES_REGION) {
    throw new Error("Missing required SES config: AWS_SES_REGION must be set");
  }
}

async function getSES(): Promise<SESClient> {
  if (sesClient) return sesClient;
  const config = await getConfig();
  ensureSesConfig(config);
  sesClient = new SESClient({ region: config.AWS_SES_REGION });
  return sesClient;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string[];
  fromLabel?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const config = await getConfig();
  ensureSesConfig(config);
  const ses = await getSES();

  await ses.send(
    new SendEmailCommand({
      Source: `${options.fromLabel ?? "Cloudless"} <${config.SES_FROM_EMAIL}>`,
      Destination: { ToAddresses: [options.to] },
      ...(options.replyTo && { ReplyToAddresses: options.replyTo }),
      Message: {
        Subject: { Data: options.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: options.html, Charset: "UTF-8" },
          Text: { Data: options.text, Charset: "UTF-8" },
        },
      },
    }),
  );
}

export async function sendOrderConfirmation(
  customerEmail: string,
  sessionId: string,
  amountTotal: number,
  currency: string,
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
  invoiceId: string,
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

export async function notifyTeam(subject: string, body: string): Promise<void> {
  const config = await getConfig();
  await sendEmail({
    to: config.SES_TO_EMAIL,
    subject,
    html: `<div style="font-family: sans-serif;">${body}</div>`,
    text: body.replace(/<[^>]+>/g, ""),
  });
}
