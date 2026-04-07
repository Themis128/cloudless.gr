import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export async function GET(request: Request) {
  try {
    const stripe = await getStripe();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 10), 50);

    // Fetch recent checkout sessions and subscriptions in parallel
    const [sessions, subscriptions] = await Promise.all([
      stripe.checkout.sessions.list({
        limit,
        expand: ["data.line_items"],
      }),
      stripe.subscriptions.list({
        limit,
        status: "all",
      }),
    ]);

    return NextResponse.json({
      orders: sessions.data.map((s) => ({
        id: s.id,
        email: s.customer_details?.email ?? s.customer_email,
        amount: (s.amount_total ?? 0) / 100,
        currency: (s.currency ?? "eur").toUpperCase(),
        status: s.payment_status,
        mode: s.mode,
        items: s.line_items?.data.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          amount: (li.amount_total ?? 0) / 100,
        })) ?? [],
        created: new Date((s.created ?? 0) * 1000).toISOString(),
      })),
      subscriptions: subscriptions.data.map((sub) => ({
        id: sub.id,
        customer: sub.customer,
        status: sub.status,
        plan: sub.items.data[0]?.price?.nickname ?? sub.items.data[0]?.price?.id ?? "unknown",
        amount: (sub.items.data[0]?.price?.unit_amount ?? 0) / 100,
        currency: (sub.items.data[0]?.price?.currency ?? "eur").toUpperCase(),
        interval: sub.items.data[0]?.price?.recurring?.interval ?? "month",
        currentPeriodEnd: new Date((sub.current_period_end ?? 0) * 1000).toISOString(),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        created: new Date((sub.created ?? 0) * 1000).toISOString(),
      })),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Stripe] Error fetching orders:", err);
    return NextResponse.json({ error: "Failed to fetch orders." }, { status: 500 });
  }
}
