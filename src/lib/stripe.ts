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

  stripeInstance = new Stripe(config.STRIPE_SECRE