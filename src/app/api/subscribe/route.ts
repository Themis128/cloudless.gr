import { notifyTeam } from "@/lib/email";
import { escapeHtml } from "@/lib/escape-html";
import { isValidEmail } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!isValidEmail(email)) {
      return Response.json({ error: "Invalid email address." }, { status: 400 });
    }

    // Notify the team about the new subscriber (reuses cached SES client)
    await notifyTeam(
      `[Newsletter] New subscriber: ${email.slice(0, 80)}`,
      `<h2>New newsletter subscriber</h2>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Date:</strong> ${new Date().toISOString()}</p>
      <hr />
      <p style="color: #666; font-size: 12px;">
        Add this email to your mailing list. This notification was sent
        from the cloudless.gr subscribe form.
      </p>`,
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("Subscribe error:", error);
    return Response.json({ error: "Failed to subscribe. Please try again." }, { status: 500 });
  }
}
