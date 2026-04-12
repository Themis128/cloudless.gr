import Stripe from "stripe";
import { getConfig } from "./ssm-config";

let stripeInstance: Stripe | null = null;

export async function getStripe(): Promise<Stripe> {
  if (stripeInstance) return stripeInstance;

  const config = await getConfig();
  if (!config.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set in SSM Parameter Store");
  }

  stripeInstance = new Stripe(config.STRIPE_SECRET_KEY);
  return stripeInstance;
}

// ---------------------------------------------------------------------------
// Orders — fetch recent checkout sessions from Stripe
// ---------------------------------------------------------------------------

export interface RecentOrder {
  id: string;
  email: string | null;
  amount: number;
  currency: string;
  status: string;
  created: number;
  paymentStatus: string;
  mode: string;
}

/**
 * Fetch the most recent completed checkout sessions from Stripe.
 * Used by the /cloudless-orders slash command and admin dashboard.
 */
export async function listRecentCheckoutSessions(
  limit: number = 10,
): Promise<{ orders: RecentOrder[]; hasMore: boolean }> {
  const stripe = await getStripe();

  const sessions = await stripe.checkout.sessions.list({
    limit,
    expand: ["data.line_items"],
  });

  const orders: RecentOrder[] = sessions.data.map((s) => ({
    id: s.id,
    email: s.customer_email ?? s.customer_details?.email ?? null,
    amount: s.amount_total ?? 0,
    currency: (s.currency ?? "eur").toUpperCase(),
    status: s.status ?? "unknown",
    created: s.created,
    paymentStatus: s.payment_status,
    mode: s.mode ?? "payment",
  }));

  return { orders, hasMore: sessions.has_more };
}

// ---------------------------------------------------------------------------
// Products — fetch live products from Stripe
// ---------------------------------------------------------------------------

export interface StripeProduct {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  images: string[];
  metadata: Record<string, string>;
  defaultPrice: {
    id: string;
    unitAmount: number | null;
    currency: string;
    recurring: { interval: string; intervalCount: number } | null;
  } | null;
}

/**
 * Fetch active products from Stripe with their default prices.
 * Returns null if Stripe is not configured (caller should fall back to demo data).
 */
export async function listStripeProducts(): Promise<StripeProduct[] | null> {
  try {
    const stripe = await getStripe();

    const products = await stripe.products.list({
      active: true,
      limit: 100,
      expand: ["data.default_price"],
    });

    return products.data.map((p) => {
      const price = p.default_price as Stripe.Price | null;
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        active: p.active,
        images: p.images,
        metadata: p.metadata as Record<string, string>,
        defaultPrice: price
          ? {
              id: price.id,
              unitAmount: price.unit_amount,
              currency: (price.currency ?? "eur").toUpperCase(),
              recurring: price.recurring
                ? {
                    interval: price.recurring.interval,
                    intervalCount: price.recurring.interval_count,
                  }
                : null,
            }
          : null,
      };
    });
  } catch (err) {
    console.error("[Stripe] Failed to fetch products:", err);
    return null;
  }
}

// Re-export for server-side callers; client components should import from '@/lib/format-price'
export { formatPrice } from "./format-price";
