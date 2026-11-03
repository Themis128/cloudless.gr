import { NextResponse } from "next/server";

/**
 * POST /api/audit — free 30-minute tech checkup booking intake.
 *
 * Spec: Cloudless Agent Manifest (Founders 3-11-2026 day2) —
 * CALENDAR_INTEGRATION_ROUTING defines the three required discovery fields
 * (goal / pain / timeline) that seed the audit call. The lead is forwarded
 * server-side to the SocialAuto public capture endpoint as
 * form="audit-request" so it lands in the same funnel as the other public
 * forms (newsletter / free-audit / survey).
 */
export async function POST(req: Request) {
  let body: {
    email?: string;
    name?: string;
    goal?: string;
    pain?: string;
    timeline?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  // Linear-time check — no regex on user input (CodeQL js/polynomial-redos).
  const at = email.indexOf("@");
  const emailOk =
    email.length <= 254 &&
    at > 0 &&
    email.lastIndexOf("@") === at &&
    email.slice(at + 1).includes(".") &&
    !email.endsWith(".");
  if (!emailOk) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }
  for (const key of ["goal", "pain", "timeline"] as const) {
    if (!(body[key] ?? "").trim()) {
      return NextResponse.json({ error: `${key} is required` }, { status: 400 });
    }
  }

  const apiBase =
    process.env.SOCIALAUTO_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "https://social.cloudless.gr";

  const res = await fetch(`${apiBase}/api/v1/leads/public`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      name: (body.name ?? "").trim() || email.split("@")[0],
      form: "audit-request",
      interest: "audit",
      site: "cloudless.gr/audit",
      consent_at: new Date().toISOString(),
      message:
        `Goal: ${body.goal!.trim()}\n` +
        `Pain: ${body.pain!.trim()}\n` +
        `Timeline: ${body.timeline!.trim()}`,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "booking failed, please try again" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
