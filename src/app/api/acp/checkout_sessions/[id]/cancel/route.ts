import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { acpSessionFromStripe, resolvedItemsFromSession } from "@/lib/agentic-commerce";

function acpError(
  type: "invalid_request" | "processing_error" | "service_unavailable",
  code: string,
  message: string,
  status: number
) {
  return NextResponse.json({ type, code, message }, { status });
}

/**
 * POST /api/acp/checkout_sessions/{id}/cancel — ACP cancelCheckoutSession.
 * Expires the underlying Stripe Checkout Session.
 */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const stripe = await getStripe();
  if (!stripe) {
    return acpError(
      "service_unavailable",
      "payments_unavailable",
      "Payment processing is temporarily unavailable.",
      503
    );
  }

  let session;
  try {
    session = await stripe.checkout.sessions.expire(id);
  } catch {
    return acpError(
      "invalid_request",
      "cannot_cancel",
      "Checkout session not found or already completed/expired.",
      400
    );
  }

  const resolved = await resolvedItemsFromSession(session);
  const body = acpSessionFromStripe(session, resolved) as Record<string, unknown>;
  // Stripe reports the terminal state as `expired`; ACP semantics for an
  // agent-initiated cancel are `canceled`.
  if (body.status === "expired") body.status = "canceled";
  return NextResponse.json(body);
}
