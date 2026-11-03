import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { isSupportedLocale } from "@/lib/i18n";
import { forwardAuditLead } from "@/lib/socialauto-public-leads";

/**
 * POST /api/audit — free 30-minute tech checkup booking intake.
 *
 * Spec: Cloudless Agent Manifest (Founders 3-11-2026 day2) —
 * CALENDAR_INTEGRATION_ROUTING defines the three required discovery fields
 * (goal / pain / timeline) that seed the audit call. The lead is forwarded
 * server-side to the SocialAuto public capture endpoint as
 * form="audit-request" so it lands in the same funnel as the other public
 * forms (newsletter / free-audit / survey).
 *
 * Abuse controls mirror /api/playbook-lead: 5 attempts per IP per 10 minutes
 * plus a honeypot field. SocialAuto sits behind Cloudflare Access, so the
 * forward goes through `forwardAuditLead` with a service token — never an
 * unauthenticated fetch that an Access login page could answer with a 200.
 */

const MAX_FIELD_CHARS = 1000;
const MAX_NAME_CHARS = 200;

interface AuditBody {
  email?: unknown;
  name?: unknown;
  goal?: unknown;
  pain?: unknown;
  timeline?: unknown;
  consent?: unknown;
  locale?: unknown;
  website?: unknown;
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** Linear-time email check — no regex on user input (CodeQL js/polynomial-redos). */
function isPlausibleEmail(email: string): boolean {
  const at = email.indexOf("@");
  return (
    email.length <= 254 &&
    at > 0 &&
    email.lastIndexOf("@") === at &&
    email.slice(at + 1).includes(".") &&
    !email.endsWith(".")
  );
}

function pagePathFromReferer(referer: string | null): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).pathname.slice(0, 200);
  } catch {
    return undefined;
  }
}

/**
 * Booking-confirmation mail via the mail-outbound worker (send_email binding)
 * — fire-and-forget: a mail failure must never break a captured booking.
 */
function sendConfirmationMail(
  email: string,
  name: string,
  discovery: Record<"goal" | "pain" | "timeline", string>
): void {
  const mailBase = process.env.MAIL_OUTBOUND_URL;
  const mailToken = process.env.MAIL_OUTBOUND_TOKEN;
  if (!mailBase || !mailToken) return;
  const firstName = name ? ` ${name.split(" ")[0]}` : "";
  void fetch(`${mailBase.replace(/\/$/, "")}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${mailToken}` },
    body: JSON.stringify({
      to: email,
      subject: "Your free 30-minute tech checkup — confirmed",
      text:
        `Hi${firstName},\n\n` +
        "Got your request — we'll confirm your slot shortly.\n\n" +
        `Your goal: ${discovery.goal}\n` +
        `What's hard: ${discovery.pain}\n` +
        `Timeline: ${discovery.timeline}\n\n` +
        "— Themis, Cloudless",
      category: "audit-confirm",
    }),
  }).catch(() => {});
}

export async function POST(req: Request) {
  // Same budget as /api/playbook-lead: 5 attempts per IP per 10 minutes.
  const ip = getClientIp(req);
  const rl = rateLimit(`audit:${ip}`, 5, 10 * 60_000);
  if (!rl.ok) return rl.response;

  let body: AuditBody;
  try {
    body = (await req.json()) as AuditBody;
  } catch {
    return jsonError("invalid JSON", 400);
  }
  if (!body || typeof body !== "object") {
    return jsonError("invalid JSON", 400);
  }

  // Honeypot: a hidden field humans never fill. Ack without forwarding.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const email = (typeof body.email === "string" ? body.email : "").trim().toLowerCase();
  if (!isPlausibleEmail(email)) {
    return jsonError("valid email required", 400);
  }

  const discovery: Record<"goal" | "pain" | "timeline", string> = {
    goal: "",
    pain: "",
    timeline: "",
  };
  for (const key of ["goal", "pain", "timeline"] as const) {
    const raw = body[key];
    if (raw !== undefined && raw !== null && typeof raw !== "string") {
      return jsonError(`${key} must be a string`, 400);
    }
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) {
      return jsonError(`${key} is required`, 400);
    }
    if (value.length > MAX_FIELD_CHARS) {
      return jsonError(`${key} must be at most ${MAX_FIELD_CHARS} characters`, 400);
    }
    discovery[key] = value;
  }

  if (body.name !== undefined && body.name !== null && typeof body.name !== "string") {
    return jsonError("name must be a string", 400);
  }
  const name = (typeof body.name === "string" ? body.name : "").replace(/\s+/g, " ").trim();
  if (name.length > MAX_NAME_CHARS) {
    return jsonError(`name must be at most ${MAX_NAME_CHARS} characters`, 400);
  }

  // GDPR: `consent_at` is only recorded when the visitor explicitly ticked the
  // consent box — never derived from a bare submission.
  if (body.consent !== true) {
    return jsonError("consent is required", 400);
  }

  const locale =
    typeof body.locale === "string" && isSupportedLocale(body.locale) ? body.locale : undefined;

  const result = await forwardAuditLead({
    email,
    name: name || undefined,
    locale,
    pagePath: pagePathFromReferer(req.headers.get("referer")),
    consentAt: new Date().toISOString(),
    ...discovery,
  });

  if (result.ok) {
    sendConfirmationMail(email, name, discovery);
    return NextResponse.json({ ok: true });
  }

  if (result.reason === "rejected") {
    // Upstream field-level rejection — not necessarily the email.
    return jsonError("submission rejected — check the details and try again", 400);
  }

  const statusSuffix = result.status ? ` (HTTP ${result.status})` : "";
  console.error(`[audit] forward failed: ${result.reason}${statusSuffix}`);
  if (result.reason === "not_configured") {
    return jsonError("Audit booking is temporarily unavailable. Please email us instead.", 503);
  }
  return jsonError("booking failed, please try again", 502);
}
