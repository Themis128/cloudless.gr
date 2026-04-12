import { escapeHtml } from "@/lib/escape-html";
import { isValidEmail } from "@/lib/validation";
import { sendEmail } from "@/lib/email";
import { getConfig } from "@/lib/ssm-config";
import { slackContactNotify } from "@/lib/slack-notify";
import { upsertContact } from "@/lib/hubspot";

export async function POST(request: Request) {
  try {
    const { name, email, company, service, message } = await request.json();

    if (!name || !email || !message) {
      return Response.json(
        { error: "Name, email, and message are required." },
        { status: 400 },
      );
    }

    if (!isValidEmail(email)) {
      return Response.json(
        { error: "Invalid email address." },
        { status: 400 },
      );
    }

    const config = await getConfig();

    const subject = `[Contact] ${String(service || "General inquiry").slice(0, 100)} — ${String(name).slice(0, 100)}`;

    const html = `
      <h2>New contact form submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Company:</strong> ${escapeHtml(company || "—")}</p>
      <p><strong>Service:</strong> ${escapeHtml(service || "—")}</p>
      <hr />
      <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
    `;

    const text = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Company: ${company || "—"}`,
      `Service: ${service || "—"}`,
      ``,
      message,
    ].join("\n");

    await sendEmail({
      to: config.SES_TO_EMAIL,
      subject,
      html,
      text,
      replyTo: [email],
      fromLabel: "Cloudless Contact Form",
    });

    // Fire-and-forget: push to CRM + not