import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getStripe } from "@/lib/stripe";

export interface AdminSubscription {
  id: string;
  customerId: string;
  customerEmail: string | null;
  customerName: string | null;
  status: string;
  planName: string;
  amount: number;
  currency: string;
  interval: string;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  created: number;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const stripe = await getStripe();
    if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "active";
    const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 100);

    const subs = await stripe.subscriptions.list({
      status:
        status === "all" ? undefined : (status as "active" | "past_due" | "canceled" | "trialing"),
      limit,
      // Stripe allows expanding at most 4 levels deep. "data.items.data.price"
      // is already 4 (data→items→data→price); adding ".product" makes 5 and
      // Stripe rejects the whole request → the list 500s. Stop at price and
      // fall back to price.nickname for the plan name below.
      expand: ["data.customer", "data.items.data.price"],
    });

    const subscriptions: AdminSubscription[] = subs.data.map((sub) => {
      const customer = sub.customer as {
        id: string;
        email?: string | null;
        name?: string | null;
      } | null;
      const item = sub.items.data[0];
      const price = item?.price;
      const product = price?.product as { name?: string } | null;

      return {
        id: sub.id,
        customerId: typeof sub.customer === "string" ? sub.customer : (customer?.id ?? ""),
        customerEmail: customer?.email ?? null,
        customerName: customer?.name ?? null,
        status: sub.status,
        planName: product?.name ?? price?.nickname ?? "Unknown Plan",
        amount: price?.unit_amount ?? 0,
        currency: (price?.currency ?? "eur").toUpperCase(),
        interval: price?.recurring?.interval ?? "month",
        currentPeriodEnd: (sub as unknown as Record<string, number>).current_period_end ?? 0,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        created: sub.created as number,
      };
    });

    return NextResponse.json({
      subscriptions,
      hasMore: subs.has_more,
      total: subscriptions.length,
    });
  } catch (e) {
    console.error("[Stripe] Error fetching subscriptions:", e);
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = ((await request.json()) as any);
  const { action, customerId, subscriptionId } = body as {
    action: "portal" | "cancel";
    customerId?: string;
    subscriptionId?: string;
  };

  if (customerId && !/^cus_[a-zA-Z0-9]+$/.test(customerId)) {
    return NextResponse.json({ error: "Invalid customerId format" }, { status: 400 });
  }
  if (subscriptionId && !/^sub_[a-zA-Z0-9]+$/.test(subscriptionId)) {
    return NextResponse.json({ error: "Invalid subscriptionId format" }, { status: 400 });
  }

  try {
    const stripe = await getStripe();
    if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

    if (action === "portal" && customerId) {
      const baseUrl =
        process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://cloudless.gr";
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${baseUrl}/admin/subscriptions`,
      });
      return NextResponse.json({ url: session.url });
    }

    if (action === "cancel" && subscriptionId) {
      const sub = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      return NextResponse.json({
        ok: true,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e) {
    console.error("[Stripe] Error performing subscription action:", e);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
