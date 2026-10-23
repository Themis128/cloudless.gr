import { NextRequest, NextResponse } from "next/server";
import {
  fetchStripeSession,
  resolvedItemsFromSession,
  ucpCheckoutFromStripe,
  ucpEnvelope,
} from "@/lib/agentic-commerce";

/** GET /api/ucp/checkout-sessions/{id} — retrieve a UCP checkout session. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
  return NextResponse.json(ucpCheckoutFromStripe(result.session, resolved));
}
