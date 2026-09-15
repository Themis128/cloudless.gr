import { notifyTeam, sendSubscriberWelcome } from "@/lib/email";
import { escapeHtml } from "@/lib/escape-html";
import { setNewsletterStatus } from "@/lib/espocrm";
import { removeFromSuppressionList } from "@/lib/ses-suppression";
import { isValidEmail } from "@/lib/validation";
import { slackSubscriberNotify } from "@/lib/slack-notify";
import { recordNotification } from "@/lib/admin-notifications";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { sendContactEvent } from "@/lib/meta-capi";
import { generateEventId } from "@/lib/meta-pixel";
import { trackEvent } from "@/lib/appflowy-analytics";
import { sendSocialAutoEventServer } from "@/lib/socialauto-analytics-server";

export async function GET() {
  return Response.json({ error: "POST only" }, { status: 405 });
}

export async function POST(request: Request) {
  // Rate limit: 3 subscribe attempts per IP per 10 minutes
  const ip = getClientIp(request);
  const rl = rateLimit(`subscribe:${ip}`, 3, 10 * 60_000);
  if (!rl.ok) return rl.response;

  // Parse the body in its own guard: a malformed JSON payload is a client
  // error (400), not a 500.
  let parsed;
  try {
    parsed = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const { email, turnstileToken } = parsed as { email?: string; turnstileToken?: string };

    const turnstile = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstile.ok) {
      return Response.json({ error: turnstile.error }, { status: 403 });
    }

    if (!isValidEmail(email)) {
      return Response.json({ error: "Invalid email address." }, { status: 400 });
    }

    // Clear any stale SES suppression first, so a previously-unsubscribed
    // user re-subscribing can receive the welcome email below.
    await removeFromSuppressionList(email);

    // EspoCRM is the source of truth for the newsletter contact list.
    // setNewsletterStatus swallows its own errors and returns false, so a
    // EspoCRM outage never fails the subscriber; team-notify and Slack
    // provide a manual fallback path.
    await setNewsletterStatus(email, "newsletter_signup");

    notifyTeam(
      `[Newsletter] New subscriber: ${email.slice(0, 80)}`,
      `<h2>New newsletter subscriber</h2>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Date:</strong> ${new Date().toISOString()}</p>
      <hr />
      <p style="color: #666; font-size: 12px;">
        Subscriber recorded as a EspoCRM contact (lead_source: newsletter_signup).
        This notification was sent from the cloudless.gr subscribe form.
      </p>`
    ).catch(() => {});
    sendSubscriberWelcome(email).catch(() => {});

    slackSubscriberNotify(email).catch((err) => {
      console.error("[subscribe] Slack notification failed:", err);
    });

    recordNotification({
      category: "subscribe",
      type: "success",
      title: "New newsletter subscriber",
      message: email,
      actor: email,
      route: "/api/subscribe",
    });

    const eventId = generateEventId("contact");
    sendContactEvent({
      eventId,
      email,
      clientIpAddress: ip === "unknown" ? undefined : ip,
      clientUserAgent: request.headers.get("user-agent") ?? undefined,
      eventSourceUrl: "https://cloudless.gr",
      customData: { content_name: "newsletter_signup" },
    }).catch(() => {});

    trackEvent({
      event: "newsletter_signup",
      path: "/",
      referrer: request.headers.get("referer") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
      metadata: { source: "homepage_inline_form" },
    }).catch(() => {});

    sendSocialAutoEventServer(
      {
        event: "home_newsletter_subscribe",
        domain: "cloudless.gr",
        path: "/",
        locale: undefined,
        payload: { source: "homepage_inline_form", email },
      },
      request
    ).catch(() => {});

    return Response.json({ success: true, eventId });
  } catch (error) {
    console.error(
      "[subscribe] Internal error:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return Response.json({ error: "Failed to subscribe. Please try again." }, { status: 500 });
  }
}
