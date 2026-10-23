import { NextRequest, NextResponse } from "next/server";
import {
  acpSessionFromStripe,
  fetchStripeSession,
  resolvedItemsFromSession,
} from "@/lib/agentic-commerce";

/** GET /api/acp/checkout_sessions/{id} — ACP getCheckoutSession. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
  return NextResponse.json(acpSessionFromStripe(result.session, resolved));
}
