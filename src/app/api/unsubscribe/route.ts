import { isValidEmail } from "@/lib/validation";
import { notifyTeam } from "@/lib/email";
import { escapeHtml } from "@/lib/escape-html";
import { addToSuppressionList } from "@/lib/ses-suppression";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Newsletter unsubscribe endpoint.
 *
 * Uses the SES account-level suppression list to prevent future emails.
 * Also notifies the team for audit purposes.
 */
export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!isValidEmail(email)) {
      return Response.json(
        { error: "Invalid email address." },
        { status: 400 },
      );
    }

    // Add to SES suppression list — this prevents all future SES sends to this address
    const suppressed = await addToSuppressionList(email);

    // Notify team for audit trail (fire-and-forget)
    notifyTeam(
      `[Newsletter] Unsubscribe: ${email.slice(0, 80)}`,
      `<h2>Newsletter unsubscribe</h2>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>SES suppressed:</strong> ${suppressed ? "Yes" : "Failed (manual removal needed)"}</p>
      <p><strong>Date:</strong> ${new Date().toISOString()}</p>`,
    ).catch(() => {});

    return Response.json({
      success: true,
      message: "You have been unsubscribed.",
    });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return Response.json(
      { error: "Failed to process unsubscribe request. Please try again." },
      { status: 500 },
    );
  }
}

/** GET handler for email link unsubscribes (List-Unsubscribe header) */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = rateLimit(`unsubscribe:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return new Response(
      unsubscribePage("Too many requests. Please try again later.", false),
      { status: 429, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email || !isValidEmail(email)) {
    return new Response(
      unsubscribePage("Invalid or missing email address.", false),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  try {
    const suppressed = await addToSuppressionList(email);

    // Notify team (fire-and-forget)
    notifyTeam(
      `[Newsletter] Unsubscribe (via link): ${email.slice(0, 80)}`,
      `<h2>Newsletter unsubscribe (via email link)</h2>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>SES suppressed:</strong> ${suppressed ? "Yes" : "Failed"}</p>
      <p><strong>Date:</strong> ${new Date().toISOString()}</p>`,
    ).catch(() => {});

    return new Response(unsubscribePage(email, true), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return new Response(
      unsubscribePage("Something went wrong. Please try again.", false),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
}

/** Simple branded confirmation page for email-link unsubscribes */
function unsubscribePage(emailOrMessage: string, success: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${success ? "Unsubscribed" : "Error"} — Cloudless.gr</title>
  <style>
    body { background: #0a0a0f; color: #e2e8f0; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #12121a; border: 1px solid ${success ? "#00fff5" : "#ff4444"}; border-radius: 12px; padding: 2rem 2.5rem; max-width: 420px; text-align: center; }
    h1 { color: ${success ? "#00fff5" : "#ff4444"}; font-size: 1.5rem; margin: 0 0 1rem; }
    p { color: #94a3b8; line-height: 1.6; margin: 0; }
    a { color: #00fff5; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${success ? "Unsubscribed" : "Error"}</h1>
    <p>${success ? `<strong>${escapeHtml(emailOrMessage)}</strong> has been removed from our newsletter.` : escapeHtml(emailOrMessage)}</p>
    <p style="margin-top: 1.5rem;"><a href="https://cloudless.gr">← Back to cloudless.gr</a></p>
  </div>
</body>
</html>`;
}
