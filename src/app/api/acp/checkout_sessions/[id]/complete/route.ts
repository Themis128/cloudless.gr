import { NextRequest, NextResponse } from "next/server";
import {
  acpSessionFromStripe,
  chargeDelegatedToken,
  delegatedPaymentsEnabled,
  fetchStripeSession,
  resolvedItemsFromSession,
} from "@/lib/agentic-commerce";

/**
 * POST /api/acp/checkout_sessions/{id}/complete — ACP completeCheckoutSession.
 *
 * With `payment_data`/`token` in the body (and ACP_DELEGATED_PAYMENTS=1),
 * charges the delegated token server-side. Without a token, returns
 * `hosted_payment_required` pointing the buyer at continue_url — the
 * Stripe-hosted page remains the default payment path.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await fetchStripeSession(id);
  if (!result.ok) {
    const type = result.status === 503 ? "service_unavailable" : "invalid_request";
    return NextResponse.json(
      { type, code: result.code, message: result.message },
      { status: result.status }
    );
  }

  // Optional delegated-payment token (ACP payment_data / token field).
  let token: string | undefined;
  try {
    const raw = (await request.json()) as Record<string, unknown>;
    const t = raw.payment_data ?? raw.token ?? raw.payment_token;
    if (typeof t === "string" && t.trim()) token = t.trim();
    else if (t && typeof t === "object" && typeof (t as { id?: string }).id === "string") {
      token = (t as { id: string }).id;
    }
  } catch {
    // No JSON body — hosted-checkout path.
  }

  const resolved = await resolvedItemsFromSession(result.session);
  const body = acpSessionFromStripe(result.session, resolved) as Record<string, unknown>;
  if (body.status === "completed") return NextResponse.json(body);

  const expired = result.session.status === "expired";
  if (expired) {
    return NextResponse.json(
      {
        type: "invalid_request",
        code: "session_expired",
        message: "Checkout session has expired; create a new one.",
      },
      { status: 400 }
    );
  }

  if (token && delegatedPaymentsEnabled()) {
    const charge = await chargeDelegatedToken(result.stripe, result.session, token);
    if (charge.ok && charge.paymentStatus === "succeeded") {
      body.status = "completed";
      body.order = {
        id: result.session.id,
        checkout_session_id: result.session.id,
        permalink_url: body.continue_url,
      };
      return NextResponse.json(body);
    }
    if (charge.ok && charge.paymentStatus === "requires_action") {
      return NextResponse.json(
        {
          type: "invalid_request",
          code: "requires_action",
          message:
            "Payment requires an intervention (e.g. 3DS). The buyer must complete authentication at the session's continue_url.",
        },
        { status: 402 }
      );
    }
    return NextResponse.json(
      {
        type: charge.ok ? "processing_error" : "invalid_request",
        code: charge.ok ? "payment_processing" : charge.code,
        message: charge.ok ? "Payment is processing; poll the session." : charge.message,
      },
      { status: charge.ok ? 409 : 402 }
    );
  }

  if (token && !delegatedPaymentsEnabled()) {
    return NextResponse.json(
      {
        type: "invalid_request",
        code: "delegate_payment_unavailable",
        message:
          "Delegated payments are not enabled for this merchant. The buyer must complete payment at the session's continue_url.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      type: "invalid_request",
      code: "hosted_payment_required",
      message:
        "The buyer must complete payment at the session's continue_url (Stripe-hosted checkout).",
    },
    { status: 400 }
  );
}
