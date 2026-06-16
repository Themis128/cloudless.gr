import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { findPendingByEmail } from "@/lib/pending-clients";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * GET /api/portal/me
 * Auth required (next-auth session or Bearer token).
 * Returns the authenticated user's pending-portal status.
 *
 * Response:
 *   { status: "none" | "waiting" | "approved", portalToken?: string, plan?: string, planLabel?: string, submittedAt?: string }
 *
 * The waiting room polls this endpoint to detect when the admin has
 * approved their portal and the portalToken is available.
 */
export async function GET(request: NextRequest) {
  // The waiting room polls this endpoint; 120/min is well above any sane poll
  // rate (even multi-tab) while still bounding gross abuse.
  const rl = rateLimit(`portal-me:${getClientIp(request)}`, 120, 60_000);
  if (!rl.ok) return rl.response;

  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const email = auth.user.email?.toLowerCase();
  // Personal-data response — never edge-cache, never CDN-cache.
  const NO_STORE = { "Cache-Control": "private, no-store" } as const;

  if (!email) {
    return NextResponse.json({ status: "none" }, { headers: NO_STORE });
  }

  const pending = await findPendingByEmail(email);
  if (!pending) {
    return NextResponse.json({ status: "none", email }, { headers: NO_STORE });
  }

  return NextResponse.json(
    {
      status: pending.status,
      portalToken: pending.portalToken,
      plan: pending.plan,
      planLabel: pending.planLabel,
      submittedAt: pending.submittedAt,
      approvedAt: pending.approvedAt,
      email: pending.email,
      name: pending.name,
    },
    { headers: NO_STORE },
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
