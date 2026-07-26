import { sendEmail as sendEmailUnified } from "@/lib/email-sender";
import { escapeHtml } from "@/lib/escape-html";
import { DEFAULT_LOCALE } from "@/lib/locale-defaults";

/**
 * Email sending service using Cloudflare Email (for Workers) or unified sender (for other environments)
 * This module abstracts the email sending implementation to support both Cloudflare Email and fallback services
 */

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string[];
  fromLabel?: string;
  listUnsubscribeUrl?: string;
  locale?: string;
}

/**
 * Main email sending function - uses Cloudflare Email in Workers environment, falls back to unified sender otherwise
 * @param options - Email sending options
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  // Use the unified email sender which handles environment-specific implementations
  await sendEmailUnified(options);
}

/**
 * Send order confirmation email with proper formatting and security
 * @param customerEmail - Customer email address
 * @param sessionId - Order/session ID
 * @param amountTotal - Total amount in cents (e.g., 9999 = $99.99)
 * @param currency - Currency code (e.g., 'usd', 'eur', 'gbp')
 */
export async function sendOrderConfirmation(
  customerEmail: string,
  sessionId: string,
  amountTotal: number,
  currency: string,
): Promise<void> {
  const formatted = new Intl.NumberFormat(
    DEFAULT_LOCALE,
    {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    },
  ).format(amountTotal / 100);

  await sendEmail({
    to: customerEmail,
    subject: `Order confirmed: ${formatted}`,
    replyTo: ["tbaltzakis@cloudless.gr"],
    html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
  <table style="width: 100%; border-collapse: separate; border-spacing: 0; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <thead style="background: linear-gradient(135deg, #00fff5, #00b8ff);">
      <tr>
        <th style="padding: 20px; text-align: center;">
          <h2 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">
            Order Confirmed ✅
          </h2>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 20px;">
          <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 24px;">
            Thanks for your purchase! Here are your order details:
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e0e0e0; color: #666; font-weight: 500; background-color: #f5f5f5;">Order ID</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e0e0e0; color: #333;">${escapeHtml(sessionId)}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e0e0e0; color: #666; font-weight: 500; background-color: #f5f5f5;">Total</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e0e0e0; color: #333; font-weight: 600;">${formatted}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; color: #666; font-weight: 500; background-color: #f5f5f5;">Date</td>
              <td style="padding: 12px 16px; color: #333;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
            </tr>
          </table>
          <p style="font-size: 16px; line-height: 1.6; color: #333; margin: 24px 0 16px;">
            If you have any questions about your order, please reply to this email.
          </p>
          <p style="font-size: 14px; line-height: 1.6; color: #666; margin-bottom: 20px;">
            Best regards,<br />
            <strong>The Cloudless Team</strong>
          </p>
        </td>
      </tr>
    </tbody>
  </table>
  <div style="margin-top: 32px; padding: 16px; background-color: #fff3cd; border-radius: 4px; text-align: center;">
    <p style="font-size: 12px; color: #856404; margin: 0;">
      This is an automated confirmation email. Please do not reply directly to this message.
    </p>
  </div>
</div>
    `,
    text: `Order Confirmation
Thanks for your purchase!

Order Details:
- Order ID: ${sessionId}
- Total: ${formatted}
- Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

If you have any questions, please reply to this email.

Best regards,
The Cloudless Team`,
  });
}

/**
 * Send contact form submission email
 * @param formData - Contact form data
 */
export async function sendContactFormEmail(formData: {
  name: string;
  email: string;
  company?: string;
  service: string;
  message: string;
}): Promise<void> {
  const htmlContent = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #00b8ff; margin-bottom: 20px;">New Contact Form Submission</h2>
  <p><strong>Name:</strong> ${escapeHtml(formData.name)}</p>
  <p><strong>Email:</strong> ${escapeHtml(formData.email)}</p>
  ${formData.company ? `<p><strong>Company:</strong> ${escapeHtml(formData.company)}</p>` : ''}
  <p><strong>Service:</strong> ${escapeHtml(formData.service)}</p>
  <p><strong>Message:</strong></p>
  <p style="background: #f8f9fa; padding: 12px; border-left: 4px solid #00b8ff; margin: 16px 0;">
    ${escapeHtml(formData.message)}
  </p>
  <p>This lead should be processed in the CRM system.</p>
</div>
`;

  await sendEmail({
    to: "tbaltzakis@cloudless.gr",
    subject: `New Contact Form: ${formData.service} from ${formData.name}`,
    html: htmlContent,
    text: `New Contact Form Submission

Name: ${formData.name}
Email: ${formData.email}
Company: ${formData.company || 'N/A'}
Service: ${formData.service}

Message:
${formData.message}

This lead should be processed in the CRM system.`,
    replyTo: [formData.email],
  });
}

/**
 * Notify team via email about important events
 * @param subject - Email subject
 * @param html - HTML content
 */
export async function notifyTeam(subject: string, html: string): Promise<void> {
  await sendEmail({
    to: "tbaltzakis@cloudless.gr",
    subject: `[Notification] ${subject}`,
    html: html,
    text: `[Notification] ${subject.replace(/<[^>]*>/g, '')}`,
  });
}

/**
 * Send activation email for user registration
 * @param email - User email address
 * @param activationUrl - Activation URL
 */
export async function sendActivationEmail(email: string, activationUrl: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Please verify your email address",
    html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #00b8ff; margin-bottom: 20px;">Email Verification Required</h2>
  <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">Please click the button below to verify your email address:</p>
  <p style="text-align: center; margin: 30px 0;">
    <a href="${activationUrl}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #00fff5, #00b8ff); color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Verify Email Address</a>
  </p>
  <p style="font-size: 14px; line-height: 1.6; color: #666;">If you didn't request this, please ignore this email.</p>
  <p style="font-size: 12px; color: #856404; margin-top: 40px;">This is an automated email. Please do not reply directly.</p>
</div>
    `,
    text: `Email Verification
Please verify your email address by visiting: ${activationUrl}

If you didn't request this, please ignore this email.

This is an automated email. Please do not reply directly.`,
  });
}

/**
 * Send contact acknowledgment email
 * @param formData - Contact form data
 */
export async function sendContactAcknowledgment(formData: {
  name: string;
  email: string;
  company?: string;
  service: string;
}): Promise<void> {
  await sendEmail({
    to: "tbaltzakis@cloudless.gr",
    subject: `Contact Form: ${formData.service} from ${formData.name}`,
    html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #00b8ff; margin-bottom: 20px;">Contact Form Submission</h2>
  <p><strong>Name:</strong> ${escapeHtml(formData.name)}</p>
  <p><strong>Email:</strong> ${escapeHtml(formData.email)}</p>
  ${formData.company ? `<p><strong>Company:</strong> ${escapeHtml(formData.company)}</p>` : ''}
  <p><strong>Service:</strong> ${escapeHtml(formData.service)}</p>
  <p style="font-size: 16px; line-height: 1.6; color: #333; margin-top: 20px;">Thank you for contacting us! We'll respond shortly.</p>
</div>
    `,
    text: `Contact Form Submission
Name: ${formData.name}
Email: ${formData.email}
Company: ${formData.company || 'N/A'}
Service: ${formData.service}

Thank you for contacting us! We'll respond shortly.`,
    replyTo: [formData.email],
  });
}

/**
 * Send password reset email
 * @param email - User email address
 * @param resetUrl - Password reset URL
 */
export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Password Reset Request",
    html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
  <h2 style="color: #00b8ff; margin-bottom: 20px;">Password Reset</h2>
  <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">You requested a password reset. Click the button below to reset your password:</p>
  <p style="text-align: center; margin: 30px 0;">
    <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #00fff5, #00b8ff); color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Password</a>
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

/**
 * Send booking confirmation email
 * @param bookingData - Booking data
 */
export async function sendBookingConfirmation(bookingData: {
  customerEmail: string;
  customerName: string;
  service: string;
  date: string;
  time: string;
}): Promise<void> {
  await sendEmail({
    to: bookingData.customerEmail,
    subject: `Booking Confirmation: ${bookingData.service}`,
    html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
  <h2 style="color: #00b8ff; margin-bottom: 20px;">Booking Confirmed ✅</h2>
  <p style="font-size: 16px; line-height: 1.6; color: #333;">
    <strong>Service:</strong> ${escapeHtml(bookingData.service)}<br />
    <strong>Date:</strong> ${escapeHtml(bookingData.date)}<br />
    <strong>Time:</strong> ${escapeHtml(bookingData.time)}<br />
    <strong>Customer:</strong> ${escapeHtml(bookingData.customerName)}
  </p>
  <p style="font-size: 16px; line-height: 1.6; color: #333; margin: 20px 0;">Thank you for booking with us! We look forward to seeing you.</p>
  <div style="margin-top: 30px; padding: 16px; background-color: #fff3cd; border-radius: 4px; text-align: center; font-size: 12px; color: #856404;">
    <p>This is an automated confirmation. Please do not reply directly to this message.</p>
  </div>
</div>
    `,
    text: `Booking Confirmation
Service: ${bookingData.service}
Date: ${bookingData.date}
Time: ${bookingData.time}
Customer: ${bookingData.customerName}

Thank you for booking with us! We look forward to seeing you.`,
  });
}

/**
 * Send subscriber welcome email
 * @param email - Subscriber email address
 */
export async function sendSubscriberWelcome(email: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "Welcome to Cloudless!",
    html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
  <h2 style="color: #00b8ff; margin-bottom: 20px;">Welcome! 🎉</h2>
  <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">Thank you for subscribing to Cloudless updates!</p>
  <p style="text-align: center; margin: 30px 0;">
    <a href="https://cloudless.gr" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #00fff5, #00b8ff); color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Visit Website</a>
  </p>
  <p style="font-size: 14px; line-height: 1.6; color: #666;">If you have any questions, reply to this email.</p>
  <p style="font-size: 12px; color: #856404; margin-top: 40px;">This is an automated welcome email. Please do not reply directly.</p>
</div>
    `,
    text: `Welcome to Cloudless!
Thank you for subscribing. Visit https://cloudless.gr to learn more.

This is an automated welcome email. Please do not reply directly.`,
  });
}

/**
 * Send unsubscribe confirmation email
 * @param email - User email address
 */
export async function sendUnsubscribeConfirmation(email: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: "You've been unsubscribed",
    html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
  <h2 style="color: #00b8ff; margin-bottom: 20px;">Unsubscribed</h2>
  <p style="font-size: 16px; line-height: 1.6; color: #333;">You have been successfully unsubscribed from our newsletter. You won't receive any further emails from us.</p>
  <p style="font-size: 14px; line-height: 1.6; color: #666; margin-top: 20px;">Best regards,<br /><strong>The Cloudless Team</strong></p>
</div>
    `,
    text: `You've been unsubscribed from our newsletter. You won't receive any further emails from us.

Best regards,
The Cloudless Team`,
  });
}

/**
 * Send payment failure notice to customer
 * @param customerEmail - Customer email address
 * @param invoiceId - Stripe invoice ID
 */
export async function sendPaymentFailureNotice(
  customerEmail: string,
  invoiceId: string,
): Promise<void> {
  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  await sendEmail({
    to: customerEmail,
    subject: `Payment Failed - Invoice ${invoiceId}`,
    html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff3cd;">
  <h2 style="color: #ff4444; margin-bottom: 20px;">⚠️ Payment Failed</h2>
  <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 24px;">
    Your payment for invoice <strong>${invoiceId}</strong> failed on <strong>${formattedDate}</strong>.
  </p>
  <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 24px;">
    Please update your payment method to avoid service interruption.
  </p>
  <p style="font-size: 16px; line-height: 1.6; color: #666; margin-bottom: 24px;">
    If you believe this is an error, please contact support.
  </p>
  <p style="font-size: 14px; line-height: 1.6; color: #666;">
    Best regards,<br />
    <strong>The Cloudless Team</strong>
  </p>
</div>
    `,
    text: `Payment Failed - Invoice ${invoiceId}
Your payment for invoice ${invoiceId} failed on ${formattedDate}.

Please update your payment method to avoid service interruption.

If you believe this is an error, please contact support.

Best regards,
The Cloudless Team`,
  });
}

/**
 * Send Slack registration notification
 * @param userData - User data
 */
export async function slackRegistrationNotify(userData: {
  name: string;
  email: string;
}): Promise<void> {
  await sendEmail({
    to: "tbaltzakis@cloudless.gr",
    subject: `New Registration: ${userData.email}`,
    html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #00b8ff; margin-bottom: 20px;">New User Registered</h2>
  <p><strong>Name:</strong> ${escapeHtml(userData.name)}</p>
  <p><strong>Email:</strong> ${escapeHtml(userData.email)}</p>
  <p style="margin-top: 20px; font-size: 14px;">This user should be processed in the CRM system.</p>
</div>
    `,
    text: `New Registration
Name: ${userData.name}
Email: ${userData.email}

Process this user in the CRM system.`,
  });
}