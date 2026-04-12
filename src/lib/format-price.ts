import { DEFAULT_LOCALE, DEFAULT_CURRENCY } from "./locale-defaults";

/**
 * Format a Stripe price amount (cents → display string).
 */
export function formatPrice(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amount / 1