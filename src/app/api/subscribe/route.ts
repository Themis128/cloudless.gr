import { notifyTeam, sendSubscriberWelcome } from "@/lib/email";
import { escapeHtml } from "@/lib/escape-html";
import { setNewsletterStatus } from "@/lib/hubspot";
import { removeFromSuppressionList } from "@/lib/ses-suppression";
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

    // Clear any stale SES suppression first, so a previously-unsubscribed
    // user re-subscribing can receive the welcome email below.
    await removeFromSuppressionList(email);

    // HubSpot is the source of truth for the newsletter contact list.
    // setNewsletterStatus swallows its own errors and returns false, so a
    // HubSpot outage never fails the subscriber; team-notify and Slack
    // provide a manual fallback path.
    await Promise.all([
      setNewsletterStatus(email, "newsletter_signup"),
      notifyTeam(
        `[Newsletter] New subscriber: ${email.slice(0, 80)}`,
        `<h2>New newsletter subscriber</h2>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Date:</strong> ${new Date().toISOString()}</p>
        <hr />
        <p style="color: #666; font-size: 12px;">
          Subscriber recorded as a HubSpot contact (lead_source: newsletter_signup).
          This notification was sent from the cloudless.gr subscribe form.
        </p>`,
      ),
      sendSubscriberWelcome(email),
    ]);

    slackSubscriberNotify(email).catch((err) => {
      console.error("[subscribe] Slack notification failed:", err);
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Subscribe error:", error);
    return Response.json(
      { error: "Failed to subscribe. Please try again." },
      { status: 500 },
    );
  }
}
