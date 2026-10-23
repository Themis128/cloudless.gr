/**
 * Agentic commerce mapping layer.
 *
 * Shared helpers that translate the real store catalog (`store-products.ts`,
 * Stripe-backed with the default catalog as source of truth for copy/pricing)
 * and real Stripe Checkout Sessions into the wire shapes of the two agentic
 * commerce discovery protocols we serve:
 *
 *   - ACP  — Agentic Commerce Protocol (OpenAI/Stripe draft), spec version
 *            2026-04-17. Discovery doc at /.well-known/acp.json, sessions at
 *            /api/acp/checkout_sessions.
 *   - UCP  — Universal Commerce Protocol (Google/Shopify), spec version
 *            2026-04-08. Discovery profile at /.well-known/ucp, service
 *            endpoint /api/ucp.
 *
 * Payment model: we do not accept delegated payment instruments. A checkout
 * session is backed 1:1 by a Stripe Checkout Session (the `id` IS the Stripe
 * session id) and the buyer completes payment on the hosted Stripe page at
 * `continue_url`. ACP status therefore maps:
 *   Stripe open     -> ready_for_payment (buyer pays at continue_url)
 *   Stripe complete -> completed (payment_status paid -> order confirmed)
 *   Stripe expired  -> expired
 */

import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getProducts, getProductByIdAsync, type StoreProduct } from "@/lib/store-products";

export const ACP_VERSION = "2026-04-17";
export const UCP_VERSION = "2026-04-08";
export const SITE_URL = "https://cloudless.gr";

export const ACP_SPEC = "https://agenticcommerce.dev";
export const UCP_SPEC = `https://ucp.dev/${UCP_VERSION}/specification/overview`;
export const UCP_REST_SCHEMA = `https://ucp.dev/${UCP_VERSION}/services/shopping/rest.openapi.json`;

// ---------------------------------------------------------------------------
// Catalog resolution
// ---------------------------------------------------------------------------

export interface ResolvedLineItem {
  product: StoreProduct;
  quantity: number;
}

export class UnknownItemError extends Error {
  constructor(id: string) {
    super(`Unknown item: ${id}`);
    this.name = "UnknownItemError";
  }
}

/** Resolve ACP/UCP item refs ({id, quantity}) to catalog products. */
export async function resolveLineItems(
  items: Array<{ id?: string; quantity?: number }>
): Promise<ResolvedLineItem[]> {
  const resolved: ResolvedLineItem[] = [];
  for (const item of items) {
    const id = (item.id ?? "").trim();
    if (!id) throw new UnknownItemError("(empty)");
    const product = await getProductByIdAsync(id);
    if (!product) throw new UnknownItemError(id);
    resolved.push({
      product,
      quantity: Math.max(1, Math.min(Math.trunc(item.quantity ?? 1) || 1, 99)),
    });
  }
  return resolved;
}

/** Search the live catalog (Stripe-backed) with a free-text + category filter. */
export async function searchCatalog(query: string, category?: string): Promise<StoreProduct[]> {
  const q = query.trim().toLowerCase();
  const products = await getProducts();
  return products.filter((p) => {
    if (category && p.category !== category) return false;
    if (!q) return true;
    const hay = [p.name, p.description, p.category, ...(p.features ?? [])].join(" ").toLowerCase();
    return q.split(/\s+/).every((tok) => hay.includes(tok));
  });
}

// ---------------------------------------------------------------------------
// ACP wire shapes
// ---------------------------------------------------------------------------

function acpLineItem({ product, quantity }: ResolvedLineItem, index: number) {
  return {
    id: `li_${index + 1}`,
    item: {
      id: product.id,
      name: product.name,
      unit_amount: product.price,
    },
    quantity,
    name: product.name,
    description: product.description,
    product_id: product.id,
    category: product.category,
    unit_amount: product.price,
    images: [product.image.startsWith("http") ? product.image : `${SITE_URL}${product.image}`],
    availability_status: "in_stock" as const,
  };
}

function acpTotals(items: ResolvedLineItem[]) {
  const subtotal = items.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0);
  return [
    { type: "subtotal", display_text: "Subtotal", amount: subtotal },
    { type: "total", display_text: "Total", amount: subtotal },
  ];
}

const POLICY_LINKS = [
  { type: "terms_of_use", url: `${SITE_URL}/terms`, title: "Terms of Service" },
  { type: "privacy_policy", url: `${SITE_URL}/privacy`, title: "Privacy Policy" },
  { type: "contact_us", url: `${SITE_URL}/contact`, title: "Contact" },
];

/**
 * Payment handler declaration. Honest shape: the only way to pay is the
 * Stripe-hosted checkout page — no delegate_payment, no PCI data through us.
 */
function acpPaymentHandlers() {
  return [
    {
      id: "stripe_hosted_checkout",
      name: "dev.acp.hosted_checkout",
      display_name: "Card via Stripe Checkout",
      version: ACP_VERSION,
      spec: "https://docs.stripe.com/payments/checkout",
      requires_delegate_payment: false,
      requires_pci_compliance: false,
      psp: "stripe",
      config_schema: "https://cloudless.gr/api/acp/handler-config.schema.json",
      instrument_schemas: [],
      config: {
        flow: "hosted_redirect",
        note: "Buyer completes card payment on the Stripe-hosted page at continue_url. No payment instruments are accepted through this API.",
      },
    },
  ];
}

type AcpStatus =
  | "incomplete"
  | "not_ready_for_payment"
  | "requires_escalation"
  | "authentication_required"
  | "ready_for_payment"
  | "pending_approval"
  | "complete_in_progress"
  | "completed"
  | "canceled"
  | "in_progress"
  | "expired";

function acpStatus(session: Stripe.Checkout.Session): AcpStatus {
  if (session.status === "expired") return "expired";
  if (session.status === "complete" || session.payment_status === "paid") return "completed";
  return "ready_for_payment";
}

function toIso(unix: number | null | undefined): string | undefined {
  return unix ? new Date(unix * 1000).toISOString() : undefined;
}

/**
 * Map a Stripe Checkout Session to an ACP CheckoutSession object.
 * `resolved` is the catalog line-item set used at creation; on retrieval we
 * rebuild it from the Stripe session metadata (`acp_items`).
 */
export function acpSessionFromStripe(
  session: Stripe.Checkout.Session,
  resolved: ResolvedLineItem[]
) {
  const status = acpStatus(session);
  const body: Record<string, unknown> = {
    id: session.id,
    protocol: { version: ACP_VERSION },
    status,
    currency: (session.currency ?? "eur").toLowerCase(),
    line_items: resolved.map(acpLineItem),
    totals: acpTotals(resolved),
    fulfillment_options: [],
    messages:
      status === "ready_for_payment"
        ? [
            {
              type: "info",
              resolution: "requires_buyer_input",
              content_type: "plain",
              content:
                "Payment is completed by the buyer on the Stripe-hosted checkout page at continue_url. This API does not accept payment instruments.",
            },
          ]
        : [],
    links: POLICY_LINKS,
    capabilities: {
      payment: { handlers: acpPaymentHandlers() },
      interventions: { supported: ["3ds"] },
    },
    continue_url: session.url ?? undefined,
    created_at: toIso(session.created),
    expires_at: toIso(session.expires_at),
    metadata: { source: "cloudless.gr", protocol: "acp" },
  };

  if (status === "completed") {
    body.order = {
      id: session.id,
      checkout_session_id: session.id,
      status: "confirmed",
      currency: (session.currency ?? "eur").toLowerCase(),
      totals: acpTotals(resolved),
      line_items: resolved.map(acpLineItem),
      created_at: toIso(session.created),
    };
  }
  return body;
}

// ---------------------------------------------------------------------------
// Stripe session lifecycle (shared by ACP and UCP transports)
// ---------------------------------------------------------------------------

interface CreateSessionInput {
  items: Array<{ id?: string; quantity?: number }>;
  buyerEmail?: string;
  locale?: string;
  idempotencyKey?: string;
  origin: string;
}

/**
 * Resolve items against the catalog and create the real Stripe Checkout
 * Session. The resulting Stripe session id doubles as the agentic session id
 * — Stripe is the state store, so GET/cancel/complete need no local table.
 * Requested line items are echoed into Stripe metadata (`acp_items`) so the
 * session can be reconstructed on retrieval.
 */
export async function createStripeCheckoutSession(input: CreateSessionInput) {
  const resolved = await resolveLineItems(input.items);

  const stripe = await getStripe();
  if (!stripe) return { stripe: null, session: null, resolved };

  const hasSubscription = resolved.some(({ product }) => product.recurring);
  const hasPhysical = resolved.some(
    ({ product }) => !product.recurring && product.category === "physical"
  );
  const locale = (input.locale ?? "en").split("-")[0];

  const session = await stripe.checkout.sessions.create(
    {
      mode: hasSubscription ? "subscription" : "payment",
      line_items: resolved.map(({ product, quantity }) => {
        const priceData: Record<string, unknown> = {
          currency: product.currency,
          product_data: { name: product.name },
          unit_amount: product.price,
        };
        if (product.recurring) {
          priceData.recurring = { interval: product.interval || "month" };
        }
        return { price_data: priceData as never, quantity };
      }) as never[],
      success_url: `${input.origin}/${locale}/store/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${input.origin}/${locale}/store`,
      billing_address_collection: "required",
      customer_email: input.buyerEmail || undefined,
      metadata: {
        source: "cloudless.gr",
        protocol: "agentic-commerce",
        acp_items: JSON.stringify(
          resolved.map(({ product, quantity }) => ({
            id: product.id,
            quantity,
          }))
        ),
      },
      shipping_address_collection: hasPhysical
        ? {
            allowed_countries: [
              "GR",
              "DE",
              "FR",
              "IT",
              "ES",
              "NL",
              "BE",
              "AT",
              "PT",
              "IE",
              "FI",
              "SE",
              "DK",
              "PL",
              "CZ",
              "RO",
              "BG",
              "HR",
              "SK",
              "SI",
              "LT",
              "LV",
              "EE",
              "LU",
              "MT",
              "CY",
              "US",
              "GB",
              "CA",
              "AU",
            ],
          }
        : undefined,
    },
    input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
  );

  return { stripe, session, resolved };
}

/** Rebuild the resolved line items for a previously created session. */
export async function resolvedItemsFromSession(
  session: Stripe.Checkout.Session
): Promise<ResolvedLineItem[]> {
  const raw = session.metadata?.acp_items;
  if (!raw) return [];
  try {
    const items = JSON.parse(raw) as Array<{ id: string; quantity: number }>;
    return await resolveLineItems(items);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// UCP wire shapes (spec 2026-04-08)
// ---------------------------------------------------------------------------

export const UCP_CAPABILITIES = {
  "dev.ucp.shopping.checkout": [
    {
      version: UCP_VERSION,
      spec: `https://ucp.dev/${UCP_VERSION}/specification/checkout`,
      schema: `https://ucp.dev/${UCP_VERSION}/schemas/shopping/checkout.json`,
    },
  ],
  "dev.ucp.shopping.catalog.search": [
    {
      version: UCP_VERSION,
      spec: `https://ucp.dev/${UCP_VERSION}/specification/catalog`,
      schema: `https://ucp.dev/${UCP_VERSION}/schemas/shopping/catalog_search.json`,
    },
  ],
  "dev.ucp.shopping.catalog.lookup": [
    {
      version: UCP_VERSION,
      spec: `https://ucp.dev/${UCP_VERSION}/specification/catalog`,
      schema: `https://ucp.dev/${UCP_VERSION}/schemas/shopping/catalog_lookup.json`,
    },
  ],
};

/** UCP response envelope — checkout responses require payment_handlers. */
export function ucpEnvelope(kind: "catalog" | "checkout") {
  return {
    version: UCP_VERSION,
    capabilities: UCP_CAPABILITIES,
    ...(kind === "checkout" ? { payment_handlers: {} } : {}),
  };
}

/** Catalog product → UCP product object (types/product.json). */
export function ucpProduct(product: StoreProduct) {
  const price = { amount: product.price, currency: product.currency.toUpperCase() };
  const image = product.image.startsWith("http") ? product.image : `${SITE_URL}${product.image}`;
  return {
    id: product.id,
    handle: product.id,
    title: product.name,
    description: { plain: product.description },
    url: `${SITE_URL}/en/store/${product.id}`,
    categories: [{ value: product.category, taxonomy: "merchant" }],
    price_range: { min: price, max: price },
    media: [{ type: "image", url: image, alt_text: product.name }],
    options: [],
    variants: [
      {
        id: product.id,
        title: product.name,
        price,
        availability: { available: true },
      },
    ],
    ...(product.recurring ? { metadata: { billing_interval: product.interval ?? "month" } } : {}),
  };
}

function ucpLineItem({ product, quantity }: ResolvedLineItem, index: number) {
  const lineTotal = product.price * quantity;
  return {
    id: `li_${index + 1}`,
    item: {
      id: product.id,
      title: product.name,
      price: product.price,
      image_url: product.image.startsWith("http") ? product.image : `${SITE_URL}${product.image}`,
    },
    quantity,
    totals: [{ type: "subtotal", display_text: "Item total", amount: lineTotal }],
  };
}

function ucpTotals(items: ResolvedLineItem[]) {
  const subtotal = items.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0);
  return [
    { type: "subtotal", display_text: "Subtotal", amount: subtotal },
    { type: "total", display_text: "Total", amount: subtotal },
  ];
}

type UcpCheckoutStatus =
  | "incomplete"
  | "requires_escalation"
  | "ready_for_complete"
  | "complete_in_progress"
  | "completed"
  | "canceled";

function ucpStatus(session: Stripe.Checkout.Session): UcpCheckoutStatus {
  if (session.status === "expired") return "canceled";
  if (session.status === "complete" || session.payment_status === "paid") return "completed";
  return "ready_for_complete";
}

/** Stripe Checkout Session → UCP checkout object (checkout.json). */
export function ucpCheckoutFromStripe(
  session: Stripe.Checkout.Session,
  resolved: ResolvedLineItem[]
) {
  const status = ucpStatus(session);
  return {
    ucp: ucpEnvelope("checkout"),
    id: session.id,
    status,
    currency: (session.currency ?? "eur").toUpperCase(),
    line_items: resolved.map(ucpLineItem),
    totals: ucpTotals(resolved),
    links: [
      {
        type: "terms_of_service",
        url: `${SITE_URL}/terms`,
        title: "Terms of Service",
      },
      {
        type: "privacy_policy",
        url: `${SITE_URL}/privacy`,
        title: "Privacy Policy",
      },
    ],
    messages:
      status === "ready_for_complete"
        ? [
            {
              type: "info",
              content_type: "plain",
              content:
                "Payment is completed by the buyer on the Stripe-hosted checkout page at continue_url.",
            },
          ]
        : [],
    continue_url: session.url ?? undefined,
    expires_at: toIso(session.expires_at),
  };
}
