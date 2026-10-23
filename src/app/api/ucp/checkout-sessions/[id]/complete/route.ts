import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  resolvedItemsFromSession,
  ucpCheckoutFromStripe,
  ucpEnvelope,
} from "@/lib/agentic-commerce";

function ucpError(message: string, status: number) {
  return NextResponse.json(
    {
      ucp: ucpEnvelope("checkout"),
      messages: [{ type: "error", content_type: "plain", content: message }],
    },
    { status },
  );
}

/**
 * POST /api/ucp/checkout-sessions/{id}/complete — UCP complete.
 * No delegated payment instruments are accepted: payment completes on the
 * Stripe-hosted page. If the session is already paid this returns the
 * completed checkout; otherwise it explains the hosted flow.
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const stripe = await getStripe();
  if (!stripe) return ucpError("Payment processing is temporarily unavailable.", 503);

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(id);
  } catch {
    return ucpError("Checkout session not found.", 404);
  }

  const resolved = await resolvedItemsFromSession(session);
  const body = ucpCheckoutFromStripe(session, resolved);

  if (body.status === "completed") return NextResponse.json(body);
  if (session.status === "expired") {
    return ucpError("Checkout session has expired; create a new one.", 400);
  }
  return ucpError(
    "This merchant does not accept delegated payment instruments. The buyer must complete payment at the session's continue_url (Stripe-hosted checkout).",
    400,
  );
}
