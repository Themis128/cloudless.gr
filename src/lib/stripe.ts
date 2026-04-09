"use server";

/**
 * Server-side Stripe operations.
 * 
 * NOTE: Only async functions are allowed in "use server" files.
 * For formatPrice (sync), import directly from @/lib/format-price
 */

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
// Products
// ---------------------------------------------------------------------------

// Type for the expanded price object returned by Stripe
interface StripePrice {
  id: string;
  unit_amount: number | null;
  currency: string;
  recurring?: {
    interval: "day" | "month" | "year";
    interval_count: number;
  };
}

export interface StripeProduct {
  id: string;
  name: string;
  description: string | null;
  images: string[];
  metadata: Record<string, string>;
  defaultPrice: {
    id: string;
    unitAmount: number | null;
    currency: string;
    recurring?: {
      interval: "day" | "month" | "year";
      intervalCount: number;
    };
  };
}

/**
 * Fetch all active products from Stripe.
 * Returns formatted StripeProduct data for use in store-products.ts.
 */
export async function listStripeProducts(): Promise<StripeProduct[]> {
  const stripe = await getStripe();

  try {
    const products = await stripe.products.list({
      active: true,
      limit: 100,
      expand: ["data.default_price"],
    });

    return products.data
      .filter((p) => p.default_price && typeof p.default_price !== "string")
      .map((p) => {
        const price = p.default_price as StripePrice;
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          images: p.images || [],
          metadata: p.metadata || {},
          defaultPrice: {
            id: price.id,
            unitAmount: price.unit_amount,
            currency: price.currency,
            recurring: price.recurring
              ? {
                  interval: price.recurring.interval,
                  intervalCount: price.recurring.interval_count,
                }
              : undefined,
          },
        };
      });
  } catch (err) {
    console.error("Failed to list Stripe products:", err);
    return [];
  }
}
