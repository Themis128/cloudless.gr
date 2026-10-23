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
 * GET /api/ucp/checkout-sessions/{id} — retrieve a UCP checkout session.
 * The id is the Stripe Checkout Session id; Stripe is the state store.
 */
export async function GET(
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
  return NextResponse.json(ucpCheckoutFromStripe(session, resolved));
}
