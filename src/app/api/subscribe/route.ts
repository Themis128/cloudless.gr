import { notifyTeam } from "@/lib/email";
import { escapeHtml } from "@/lib/escape-html";
import { isValidEmail } from "@/lib/validation";
import { slackSubscriberNotify } from "@/lib/slack-notify";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  // Rate limit: 3 subscribe attempts per IP per 10 minutes
  const ip = getClientIp(request);
  const rl = rateLimit(`subscribe:${ip}`, 3, 10 * 60_000);
  if (!rl.ok) return rl.response;

  try {
    const { email } = await request.json();

    if (!isValidEmail(email)) {
      return Response.json(
        { error: "Invalid email address." },
        { status: 400 },
      );
    }

    // Notify the team via email (reuses cached SES client) and Slack (fire-and-forget)
    await Promise.all([
      notifyTeam(
        `[Newsletter] New subscriber: ${email.slice(0, 80)}`,
        `<h2>New newsletter subscriber</h2>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Date:</strong> ${new Date().toISOString()}</p>
        <hr />
        <p style="color: #666; font-size: 12px;">
          Add this email to your mailing list. This notification was sent
          from the cloudless.gr subscribe form.
        </p>`,
      ),
      slackSubscriberNotify(email),
    ]);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Subscribe error:", error);
    return Response.json(
      { error: "Failed to subscribe. Please try again." },
      { status: 500 },
    );
  }
}
