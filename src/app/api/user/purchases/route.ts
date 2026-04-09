import { NextRequest, NextResponse } from "next/server";
import { isConfigured } from "@/lib/integrations";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/purchases
 * Returns checkout sessions for the authenticated user (from JWT).
 * 
 * Requires: Authorization: Bearer <JWT token>
 */
export async function GET(req: NextRequest) {
  // Verify JWT authentication
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const email = auth.user.email;
  if (!email) {
    return NextResponse.json({ error: "No email in token" }, { status: 400 });
  }

  if (!isConfigured("STRIPE_SECRET_KEY")) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  try {
    const stripe = await getStripe();

    // Search for customers by email
    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];

    if (!customer) {
      // Fall back to searching checkout sessions directly
      const sessions = await stripe.checkout.sessions.list({
        limit: 50,
        expand: ["data.line_items"],
      });

      const userSessions = sessions.data.filter(
        (s) => s.customer_email?.toLowerCase() === email.toLowerCase(),
      );

      return NextResponse.json({
        purchases: userSessions.map(mapSession),
        subscriptions: [],
      });
    }

    // Fetch checkout sessions for this customer
    const [sessions, subscriptions] = await Promise.all([
      stripe.checkout.sessions.list({
        customer: customer.id,
        limit: 50,
        expand: ["data.line_items"],
      }),
      stripe.subscriptions.list({
        customer: customer.id,
        limit: 20,
        status: "all",
      }),
    ]);

    return NextResponse.json({
      purchases: sessions.data.map(mapSession),
      subscriptions: subscriptions.data.map((sub: Stripe.Subscription) => ({
        id: sub.id,
        status: sub.status,
        currentPeriodEnd: new Date(((sub as unknown as Record<string, number>).current_period_end ?? 0) * 1000).toISOString(),
        items: sub.items.data.map((item) => ({
          name: item.price?.product
            ? typeof item.price.product === "string"
              ? item.price.product
              : (item.price.product as { name?: string }).name ?? "Subscription"
            : "Subscription",
          amount: (item.price?.unit_amount ?? 0) / 100,
          currency: (item.price?.currency ?? "eur").toUpperCase(),
        })),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        created: new Date(sub.created * 1000).toISOString(),
      })),
    });
  } catch (err) {
    console.error("Failed to fetch user purchases:", err);
    return NextResponse.json({ error: "Failed to fetch purchases" }, { status: 500 });
  }
}

function mapSession(s: Stripe.Checkout.Session) {
  const session = s as {
    id: string;
    payment_status: string;
    status: string;
    amount_total: number | null;
    currency: string | null;
    created: number;
    line_items?: { data: Array<{ description?: string; quantity?: number; amount_total?: number }> };
  };

  return {
    id: session.id,
    status: session.payment_status,
    amount: (session.amount_total ?? 0) / 100,
    currency: (session.currency ?? "eur").toUpperCase(),
    items: (session.line_items?.data ?? []).map((item) => ({
      name: item.description ?? "Item",
      quantity: item.quantity ?? 1,
      amount: (item.amount_total ?? 0) / 100,
    })),
    date: new Date(session.created * 1000).toISOString(),
  };
}
