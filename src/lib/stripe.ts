import Stripe from "stripe";
import { getConfig } from "./ssm-config";

let stripeInstance: Stripe | null = null;

export async function getStripe(): Promise<Stripe | null> {
  if (stripeInstance) return stripeInstance;

  const config = await getConfig();
  if (!config.STRIPE_SECRET_KEY) return null;

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
 * Returns empty list when Stripe is not configured.
 */
export async function listRecentCheckoutSessions(
  limit: number = 10
): Promise<{ orders: RecentOrder[]; hasMore: boolean }> {
  const stripe = await getStripe();
  if (!stripe) return { orders: [], hasMore: false };

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
    if (!stripe) return null;

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

// ---------------------------------------------------------------------------
// Invoices — agency one-off Stripe Invoicing (no custom ledger)
// ---------------------------------------------------------------------------

export interface AdminInvoiceSummary {
  id: string;
  number: string | null;
  customerId: string | null;
  customerEmail: string | null;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  created: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
}

function mapInvoice(inv: Stripe.Invoice): AdminInvoiceSummary {
  const customer = inv.customer as string | { id?: string; email?: string | null } | null;
  const customerId = typeof customer === "string" ? customer : (customer?.id ?? null);
  const customerEmail =
    inv.customer_email ??
    (typeof customer === "object" && customer ? (customer.email ?? null) : null);
  return {
    id: inv.id,
    number: inv.number,
    customerId,
    customerEmail,
    status: inv.status ?? "unknown",
    amountDue: inv.amount_due ?? 0,
    amountPaid: inv.amount_paid ?? 0,
    currency: (inv.currency ?? "eur").toUpperCase(),
    created: inv.created,
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    invoicePdf: inv.invoice_pdf ?? null,
  };
}

export async function listRecentInvoices(
  limit = 50,
  status?: string
): Promise<{ invoices: AdminInvoiceSummary[]; hasMore: boolean }> {
  const stripe = await getStripe();
  if (!stripe) return { invoices: [], hasMore: false };

  const list = await stripe.invoices.list({
    limit: Math.min(Math.max(limit, 1), 50),
    ...(status && status !== "all" ? { status: status as Stripe.InvoiceListParams.Status } : {}),
    expand: ["data.customer"],
  });

  return {
    invoices: list.data.map(mapInvoice),
    hasMore: list.has_more,
  };
}

/** Find Stripe customer by email or create one. */
export async function resolveOrCreateCustomerByEmail(
  email: string,
  name?: string
): Promise<string | null> {
  const stripe = await getStripe();
  if (!stripe) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return null;

  const existing = await stripe.customers.list({ email: normalized, limit: 1 });
  if (existing.data[0]?.id) return existing.data[0].id;

  const created = await stripe.customers.create({
    email: normalized,
    ...(name?.trim() ? { name: name.trim() } : {}),
  });
  return created.id;
}

export async function createDraftInvoice(input: {
  customerId: string;
  description: string;
  amountCents: number;
  currency?: string;
  daysUntilDue?: number;
}): Promise<AdminInvoiceSummary | null> {
  const stripe = await getStripe();
  if (!stripe) return null;
  const currency = (input.currency ?? "eur").toLowerCase();
  const description = input.description.trim().slice(0, 500);
  if (!description || input.amountCents < 1) return null;

  await stripe.invoiceItems.create({
    customer: input.customerId,
    amount: input.amountCents,
    currency,
    description,
  });

  const invoice = await stripe.invoices.create({
    customer: input.customerId,
    collection_method: "send_invoice",
    days_until_due: input.daysUntilDue ?? 14,
    auto_advance: false,
  });

  return mapInvoice(invoice);
}

// Re-export for server-side callers; client components should import from '@/lib/format-price'
export { formatPrice } from "./format-price";
