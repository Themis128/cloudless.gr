import { isValidEmail } from "@/lib/validation";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { recordNotification } from "@/lib/admin-notifications";
import { isSupportedLocale } from "@/lib/i18n";
import { forwardPlaybookLead, PUBLIC_PLAYBOOK_URL } from "@/lib/socialauto-public-leads";

/**
 * Public Cloud Migration Playbook lead form (/[locale]/playbook).
 *
 * Validates + bot-checks on cloudless.gr (rate limit, Turnstile, honeypot,
 * explicit consent), then forwards server-side to SocialAuto's
 * `POST /api/v1/leads/public` through Cloudflare Access with a service token.
 * SocialAuto stores the lead and emails the playbook.
 */

const MAX_NAME_CHARS = 200;

interface PlaybookLeadBody {
  email?: unknown;
  name?: unknown;
  consent?: unknown;
  locale?: unknown;
  website?: unknown;
  turnstileToken?: unknown;
}

function jsonError(error: string, code: string, status: number): Response {
  return Response.json({ error, code, playbookUrl: PUBLIC_PLAYBOOK_URL }, { status });
}

function pagePathFromReferer(referer: string | null): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).pathname.slice(0, 200);
  } catch {
    return undefined;
  }
}

export async function GET() {
  return Response.json({ error: "POST only" }, { status: 405 });
}

export async function POST(request: Request) {
  // Same budget style as /api/subscribe: 5 attempts per IP per 10 minutes.
  const ip = getClientIp(request);
  const rl = rateLimit(`playbook-lead:${ip}`, 5, 10 * 60_000);
  if (!rl.ok) return rl.response;

  let body: PlaybookLeadBody;
  try {
    body = (await request.json()) as PlaybookLeadBody;
  } catch {
    return jsonError("Invalid request body.", "invalid_body", 400);
  }
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body.", "invalid_body", 400);
  }

  // Honeypot: hidden field humans never fill. Pretend success, forward nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return Response.json({ success: true, delivery: "email", playbookUrl: PUBLIC_PLAYBOOK_URL });
  }

  const turnstile = await verifyTurnstileToken(
    typeof body.turnstileToken === "string" ? body.turnstileToken : undefined,
    ip
  );
  if (!turnstile.ok) {
    return jsonError(turnstile.error, "turnstile", 403);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isValidEmail(email)) {
    return jsonError("Invalid email address.", "invalid_email", 400);
  }
  if (body.consent !== true) {
    return jsonError("Please confirm you agree to receive the playbook by email.", "consent", 400);
  }
  if (body.name !== undefined && body.name !== null && typeof body.name !== "string") {
    return jsonError("Name must be a string.", "invalid_name", 400);
  }
  const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim() : "";
  if (name.length > MAX_NAME_CHARS) {
    return jsonError(`Name must be at most ${MAX_NAME_CHARS} characters.`, "invalid_name", 400);
  }
  const locale =
    typeof body.locale === "string" && isSupportedLocale(body.locale) ? body.locale : undefined;

  const result = await forwardPlaybookLead({
    email,
    name: name || undefined,
    locale,
    pagePath: pagePathFromReferer(request.headers.get("referer")),
    consentAt: new Date().toISOString(),
  });

  if (result.ok) {
    recordNotification({
      category: "subscribe",
      type: "success",
      title: "Playbook lead captured",
      message: email,
      actor: email,
      route: "/api/playbook-lead",
    });
    return Response.json({
      success: true,
      delivery: result.delivery,
      playbookUrl: result.playbookUrl,
    });
  }

  if (result.reason === "rejected") {
    return jsonError("Invalid email address.", "invalid_email", 400);
  }

  console.error(
    `[playbook-lead] forward failed: ${result.reason}${result.status ? ` (${result.status})` : ""}`
  );
  recordNotification({
    category: "error",
    type: result.reason === "not_configured" ? "warning" : "error",
    title: "Playbook lead not forwarded to SocialAuto",
    message: `${result.reason}${result.status ? ` (HTTP ${result.status})` : ""} — ${email}`,
    actor: email,
    route: "/api/playbook-lead",
  });

  if (result.reason === "not_configured") {
    return jsonError(
      "Email delivery is temporarily unavailable. You can download the playbook directly.",
      "not_configured",
      503
    );
  }
  return jsonError(
    "We couldn't send the playbook right now. You can download it directly.",
    "upstream_error",
    502
  );
}
