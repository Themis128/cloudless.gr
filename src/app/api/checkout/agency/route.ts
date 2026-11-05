import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getStripe } from "@/lib/stripe";
import { getConfig } from "@/lib/ssm-config";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SocialAuto-facing agency checkout minter.
 *
 * POST { amount_eur, description, client_email, client_name?, proposal_id }
 *   → { url, id } — a Stripe Checkout Session link for a fixed-price
 *   agency engagement. The proposal mail embeds the URL; when the client
 *   pays, `checkout.session.completed` creates the Closed Won deal in
 *   EspoCRM and SocialAuto's won_sweep kicks off the project — the whole
 *   money hop needs no human.
 *
 * Auth: same shared secret lane as /api/webhooks/socialauto-leads
 * (X-SocialAuto-Webhook-Secret or Bearer).
 */

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length || ab.length === 0) return false;
  return timingSafeEqual(ab, bb);
}

async function verifySecret(req: NextRequest): Promise<true | Response> {
  const cfg = await getConfig();
  const expected = cfg.SOCIALAUTO_LEADS_WEBHOOK_SECRET || "";
  if (!expected) {
    return NextResponse.json({ error: "receiver_not_configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const provided = req.headers.get("x-socialauto-webhook-secret") || bearer;
  if (!provided || !safeEq(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return true;
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(`agency-checkout:${getClientIp(req)}`, 20, 10 * 60_000);
  if (!rl.ok) return rl.response;

  const auth = await verifySecret(req);
  if (auth !== true) return auth;

  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  let body: {
    amount_eur?: number;
    description?: string;
    client_email?: string;
    client_name?: string;
    proposal_id?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const amountEur = Number(body.amount_eur);
  if (!Number.isFinite(amountEur) || amountEur < 1 || amountEur > 100_000) {
    return NextResponse.json({ error: "amount_eur must be 1..100000" }, { status: 400 });
  }
  const description = String(body.description ?? "Cloudless engagement").slice(0, 200);
  const proposalId = String(body.proposal_id ?? "").slice(0, 64);

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cloudless.gr";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: Math.round(amountEur * 100),
          product_data: {
            name: description,
            description: `Cloudless fixed-scope engagement${body.client_name ? ` — ${body.client_name}` : ""}`,
          },
        },
        quantity: 1,
      },
    ],
    customer_email: body.client_email || undefined,
    success_url: `${origin}/en/store?paid=agency`,
    cancel_url: `${origin}/en/store`,
    billing_address_collection: "required",
    metadata: {
      source: "agency_proposal",
      proposal_id: proposalId,
    },
    ...(proposalId ? { client_reference_id: proposalId } : {}),
  });

  return NextResponse.json({ url: session.url, id: session.id });
}
