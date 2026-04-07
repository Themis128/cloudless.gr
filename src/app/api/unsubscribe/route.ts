import { isValidEmail } from "@/lib/validation";
import { notifyTeam } from "@/lib/email";
import { escapeHtml } from "@/lib/escape-html";

/**
 * Newsletter unsubscribe endpoint.
 * Since we don't have a dedicated mailing list DB yet, this:
 *   1. Validates the email
 *   2. Notifies the team to remove the subscriber
 *   3. Returns a confirmation
 *
 * When a proper email platform (SES lists, Mailchimp, etc.) is added,
 * this should call the platform's unsubscribe API directly.
 */
export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!isValidEmail(email)) {
      return Response.json({ error: "Invalid email address." }, { status: 400 });
    }

    await notifyTeam(
      `[Newsletter] Unsubscribe request: ${email.slice(0, 80)}`,
      `<h2>Newsletter unsubscribe request</h2>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Date:</strong> ${new Date().toISOString()}</p>
      <hr />
      <p style="color: #666; font-size: 12px;">
        Please remove this email from your mailing list.
        This request was submitted via the cloudless.gr unsubscribe endpoint.
      </p>`,
    );

    return Response.json({ success: true, message: "You have been unsubscribed." });
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
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email || !isValidEmail(email)) {
    return new Response(unsubscribePage("Invalid or missing email address.", false), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  try {
    await notifyTeam(
      `[Newsletter] Unsubscribe request: ${email.slice(0, 80)}`,
      `<h2>Newsletter unsubscribe request (via email link)</h2>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Date:</strong> ${new Date().toISOString()}</p>`,
    );

    return new Response(unsubscribePage(email, true), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return new Response(unsubscribePage("Something went wrong. Please try again.", false), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
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
