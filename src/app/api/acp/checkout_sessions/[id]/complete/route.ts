import { NextRequest, NextResponse } from "next/server";
import {
  acpSessionFromStripe,
  fetchStripeSession,
  resolvedItemsFromSession,
} from "@/lib/agentic-commerce";

/**
 * POST /api/acp/checkout_sessions/{id}/complete — ACP completeCheckoutSession.
 * No delegated payment instruments: the buyer pays at continue_url. Returns
 * the completed session once Stripe reports payment, else explains the flow.
 */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await fetchStripeSession(id);
  if (!result.ok) {
    const type = result.status === 503 ? "service_unavailable" : "invalid_request";
    return NextResponse.json(
      { type, code: result.code, message: result.message },
      { status: result.status }
    );
  }

  const resolved = await resolvedItemsFromSession(result.session);
  const body = acpSessionFromStripe(result.session, resolved);
  if (body.status === "completed") return NextResponse.json(body);

  const expired = result.session.status === "expired";
  return NextResponse.json(
    {
      type: "invalid_request",
      code: expired ? "session_expired" : "hosted_payment_required",
      message: expired
        ? "Checkout session has expired; create a new one."
        : "This merchant does not accept delegated payment instruments. The buyer must complete payment at the session's continue_url (Stripe-hosted checkout).",
    },
    { status: 400 }
  );
}
