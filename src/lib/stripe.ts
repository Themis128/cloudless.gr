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

// Re-export for server-side callers; client components should import from '@/lib/format-price'
export { formatPrice } from "./format-price";
