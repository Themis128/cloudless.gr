import { NextRequest, NextResponse } from "next/server";
import {
  acpSessionFromStripe,
  expireStripeSession,
  resolvedItemsFromSession,
} from "@/lib/agentic-commerce";

/** POST /api/acp/checkout_sessions/{id}/cancel — expires the Stripe session. */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await expireStripeSession(id);
  if (!result.ok) {
    const type = result.status === 503 ? "service_unavailable" : "invalid_request";
    return NextResponse.json(
      { type, code: result.code, message: result.message },
      { status: result.status }
    );
  }
  const resolved = await resolvedItemsFromSession(result.session);
  const body = acpSessionFromStripe(result.session, resolved) as Record<string, unknown>;
  // Stripe reports the terminal state as `expired`; an agent-initiated
  // cancel maps to ACP `canceled`.
  if (body.status === "expired") body.status = "canceled";
  return NextResponse.json(body);
}
