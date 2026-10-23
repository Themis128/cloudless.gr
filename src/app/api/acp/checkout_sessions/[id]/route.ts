import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  acpSessionFromStripe,
  resolvedItemsFromSession,
} from "@/lib/agentic-commerce";

function acpError(
  type: "invalid_request" | "processing_error" | "service_unavailable",
  code: string,
  message: string,
  status: number,
) {
  return NextResponse.json({ type, code, message }, { status });
}

/**
 * GET /api/acp/checkout_sessions/{id} — ACP getCheckoutSession.
 * The session id is the Stripe Checkout Session id; Stripe is the store.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const stripe = await getStripe();
  if (!stripe) {
    return acpError(
      "service_unavailable",
      "payments_unavailable",
      "Payment processing is temporarily unavailable.",
      503,
    );
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(id);
  } catch {
    return acpError(
      "invalid_request",
      "session_not_found",
      "Checkout session not found.",
      404,
    );
  }

  const resolved = await resolvedItemsFromSession(session);
  return NextResponse.json(acpSessionFromStripe(session, resolved));
}
