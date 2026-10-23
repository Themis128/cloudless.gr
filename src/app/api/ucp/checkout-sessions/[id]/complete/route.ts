import { NextRequest, NextResponse } from "next/server";
import {
  fetchStripeSession,
  resolvedItemsFromSession,
  ucpCheckoutFromStripe,
  ucpEnvelope,
} from "@/lib/agentic-commerce";

/**
 * POST /api/ucp/checkout-sessions/{id}/complete — UCP complete.
 * No delegated payment instruments: payment completes on the Stripe-hosted
 * page. Returns the completed checkout when Stripe reports payment.
 */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await fetchStripeSession(id);
  if (!result.ok) {
    return NextResponse.json(
      {
        ucp: ucpEnvelope("checkout"),
        messages: [{ type: "error", content_type: "plain", content: result.message }],
      },
      { status: result.status }
    );
  }

  const resolved = await resolvedItemsFromSession(result.session);
  const body = ucpCheckoutFromStripe(result.session, resolved);
  if (body.status === "completed") return NextResponse.json(body);

  const expired = result.session.status === "expired";
  return NextResponse.json(
    {
      ucp: ucpEnvelope("checkout"),
      messages: [
        {
          type: "error",
          content_type: "plain",
          content: expired
            ? "Checkout session has expired; create a new one."
            : "This merchant does not accept delegated payment instruments. The buyer must complete payment at the session's continue_url (Stripe-hosted checkout).",
        },
      ],
    },
    { status: 400 }
  );
}
