import { addContactToList } from "@/lib/activecampaign";
import { notifyTeam } from "@/lib/email";
import { escapeHtml } from "@/lib/escape-html";
import { isValidEmail } from "@/lib/validation";
import { slackSubscriberNotify } from "@/lib/slack-notify";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getConfig } from "@/lib/ssm-config";

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

    const config = await getConfig();
    const listId = config.ACTIVECAMPAIGN_NEWSLETTER_LIST_ID;

    // AC subscribe is the source of truth for the newsletter list. If it fails
    // we still surface success to the user (team-notify + Slack run in parallel
    // so we have a manual fallback path), but the failure is logged.
    const acPromise = listId
      ? addContactToList(email, listId)
      : Promise.resolve(null);

    await Promise.all([
      acPromise,
      notifyTeam(
        `[Newsletter] New subscriber: ${email.slice(0, 80)}`,
        `<h2>New newsletter subscriber</h2>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Date:</strong> ${new Date().toISOString()}</p>
        <hr />
        <p style="color: #666; font-size: 12px;">
          Subscriber added to ActiveCampaign list ${escapeHtml(listId || "(unconfigured)")}.
          This notification was sent from the cloudless.gr subscribe form.
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
