import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { findPendingByEmail } from "@/lib/pending-clients";

/**
 * GET /api/portal/me
 * Auth required (Cognito Bearer token).
 * Returns the authenticated user's pending-portal status.
 *
 * Response:
 *   { status: "none" | "waiting" | "approved", portalToken?: string, plan?: string, planLabel?: string, submittedAt?: string }
 *
 * The waiting room polls this endpoint to detect when the admin has
 * approved their portal and the portalToken is available.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const email = auth.user.email;
  if (!email) {
    return NextResponse.json({ status: "none" });
  }

  const pending = await findPendingByEmail(email);
  if (!pending) {
    return NextResponse.json({ status: "none", email });
  }

  return NextResponse.json({
    status: pending.status,
    portalToken: pending.portalToken,
    plan: pending.plan,
    planLabel: pending.planLabel,
    submittedAt: pending.submittedAt,
    approvedAt: pending.approvedAt,
    email: pending.email,
    name: pending.name,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
