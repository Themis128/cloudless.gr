import { getConfig } from "@/lib/ssm-config";
import { splitServiceToken, type CfAccessCreds } from "@/lib/upstream-client";

/**
 * /api/survey — forwards the public survey form to SocialAuto's
 * POST /api/v1/leads/public/survey server-to-server (CF Access service token),
 * same pattern as /api/playbook-lead.
 */

const BASE = () => getConfig("SOCIALAUTO_API_URL") || "https://social.cloudless.gr";

async function forward(payload: Record<string, unknown>) {
  const raw = getConfig("SOCIALAUTO_SERVICE_TOKEN") || getConfig("SOCIALAUTO_SECRET");
  const creds: CfAccessCreds = splitServiceToken(raw, getConfig("SOCIALAUTO_CF_ACCESS_CLIENT_ID"));
  if (!creds.id || !creds.secret) return { delivered: "not_configured" as const };
  const res = await fetch(`${BASE()}/api/v1/leads/public/survey`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cf-Access-Client-Id": creds.id,
      "Cf-Access-Client-Secret": creds.secret,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  return { delivered: res.ok ? ("sent" as const) : ("upstream_error" as const) };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.website === "string" && body.website) {
    return Response.json({ ok: true }); // honeypot
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Invalid email", code: "bad_email" }, { status: 400 });
  }
  const forwarded = await forward({
    email,
    name: body.name ? String(body.name) : undefined,
    phone: body.phone ? String(body.phone) : undefined,
    consent: body.consent === true,
    company_size: body.companySize ? String(body.companySize) : undefined,
    interest: body.interest ? String(body.interest) : undefined,
    answers: typeof body.answers === "object" && body.answers ? body.answers : {},
    pagePath: req.headers.get("referer") ?? undefined,
    locale: body.locale ? String(body.locale) : undefined,
    form: "social-survey",
  });
  return Response.json({ ok: true, forwarded });
}
