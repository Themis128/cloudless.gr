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
 * POST /api/acp/checkout_sessions/{id}/complete — ACP completeCheckoutSession.
 *
 * This deployment does not accept delegated payment instruments: payment is
 * completed by the buyer on the Stripe-hosted page (session.continue_url).
 * Calling complete is therefore only meaningful as a status confirmation —
 * if Stripe reports the session paid, we return the completed session with
 * the order; otherwise we explain the hosted-completion flow.
 */
export async function POST(
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
  const body = acpSessionFromStripe(session, resolved);

  if (body.status === "completed") {
    return NextResponse.json(body);
  }
  if (session.status === "expired") {
    return acpError(
      "invalid_request",
      "session_expired",
      "Checkout session has expired; create a new one.",
      400,
    );
  }
  return acpError(
    "invalid_request",
    "hosted_payment_required",
    "This merchant does not accept delegated payment instruments. The buyer must complete payment at the session's continue_url (Stripe-hosted checkout).",
    400,
  );
}
