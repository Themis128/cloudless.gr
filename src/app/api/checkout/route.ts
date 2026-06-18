import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getProductById } from "@/lib/store-products";
import { getTokenFromHeader, verifyToken } from "@/lib/api-auth";
import { getCampaign } from "@/data/campaigns";
import { routing } from "@/i18n/routing";

interface CheckoutItem {
  id: string;
  quantity: number;
}

/**
 * GET /api/checkout?campaign=<slug>&tier=<id>
 *
 * Campaign landing-page CTAs (`data/campaigns.ts` → `checkoutHref`) hit this
 * endpoint. When Stripe is configured this should create a Checkout Session
 * with `success_url` set to the per-campaign thanks page so the LinkedIn
 * conversion fires. While Stripe is unconfigured (e.g. local dev, preview
 * envs) the handler 302-redirects straight to the thanks page with a
 * synthetic `order=stub-<ts>` so the rest of the flow can be exercised.
 *
 * Wiring this to a real Stripe session is the work referenced in the
 * project README under "Integration in 5 minutes" step 4 — replace the
 * `STUB BRANCH` block with a `stripe.checkout.sessions.create({...})` call
 * whose `success_url` matches the same `/campaigns/<slug>/thanks` shape.
 */
function pickLocale(request: NextRequest): string {
  // Honor x-pathname (set by `src/proxy.ts`) so we keep the visitor on the
  // locale they arrived on. Falls back to defaultLocale.
  const pathname = request.headers.get("x-pathname") ?? request.nextUrl.pathname;
  const seg = pathname.split("/").filter(Boolean)[0];
  if ((routing.locales as readonly string[]).includes(seg)) return seg;
  return routing.defaultLocale;
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("campaign");
  const tier = request.nextUrl.searchParams.get("tier");
  if (!slug || !tier) {
    return NextResponse.json({ error: "Missing campaign or tier" }, { status: 400 });
  }
  const campaign = getCampaign(slug);
  if (!campaign || campaign.status === "archived") {
    return NextResponse.json({ error: "Unknown campaign" }, { status: 400 });
  }
  // `fit-call` is a valid "tier" even though it's not in `campaign.tiers` — it's
  // the lead-form conversion path used by the campaign's secondary CTA.
  const knownTier =
    tier === "fit-call" || campaign.tiers.some((t) => t.id === tier);
  if (!knownTier) {
    return NextResponse.json({ error: "Unknown tier" }, { status: 400 });
  }

  const locale = pickLocale(request);
  const origin = request.nextUrl.origin;

  // fit-call is the lead-form path — redirect to contact, not checkout.
  if (tier === "fit-call") {
    return NextResponse.redirect(
      new URL(`/${locale}/campaigns/${campaign.slug}/thanks?tier=fit-call`, origin),
      302
    );
  }

  const tierData = campaign.tiers.find((t) => t.id === tier)!;

  // Parse price from "€890" / "€1.800" / "€2.900" → cents
  const priceMatch = tierData.oneOff?.replace(/[^0-9]/g, "");
  if (!priceMatch) {
    return NextResponse.json({ error: "Tier has no one-off price" }, { status: 400 });
  }
  const amountCents = parseInt(priceMatch, 10) * 100;

  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: amountCents,
          product_data: {
            name: tierData.name.en,
            description: `${campaign.headline.en} — ${tierData.name.en}`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/${locale}/campaigns/${campaign.slug}/thanks?tier=${encodeURIComponent(tier)}&order={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${locale}/campaigns/${campaign.slug}`,
    billing_address_collection: "required",
    metadata: {
      source: "cloudless.gr",
      campaign: campaign.slug,
      tier: tier,
    },
  });

  return NextResponse.redirect(session.url!, { status: 303 });
}

function getIdempotencyKey(request: NextRequest): string | undefined {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key) return undefined;

  // Stripe allows up to 255 chars. Keep format strict to avoid log/header abuse.
  if (!/^[A-Za-z0-9:_-]{8,255}$/.test(key)) return undefined;
  return key;
}

export async function POST(request: NextRequest) {
  // Parse the body in its own guard: a malformed JSON payload is a client
  // error (400), not a 500.
  let parsed: { items?: CheckoutItem[] };
  try {
    parsed = (await request.json()) as { items?: CheckoutItem[] };
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const { items } = parsed;

    if (!items || items.length === 0) {
      return Response.json({ error: "No items in cart" }, { status: 400 });
    }

    // Validate origin against allowlist to prevent open redirect
    const rawOrigin = request.headers.get("origin") ?? "";
    const allowedOrigins = [
      "https://cloudless.gr",
      "https://www.cloudless.gr",
    ];
    if (
      process.env.NODE_ENV === "development" &&
      rawOrigin.startsWith("http://localhost")
    ) {
      allowedOrigins.push(rawOrigin);
    }
    const origin = allowedOrigins.includes(rawOrigin)
      ? rawOrigin
      : "https://cloudless.gr";

    const resolvedProducts = items.map((item) => {
      const product = getProductById(item.id);
      if (!product) {
        throw new Error(`Unknown product: ${item.id}`);
      }
      return {
        product,
        quantity: Math.max(1, Math.min(item.quantity || 1, 99)),
      };
    });

    const lineItems = resolvedProducts.map(({ product, quantity }) => {
      const priceData: Record<string, unknown> = {
        currency: product.currency,
        product_data: { name: product.name },
        unit_amount: product.price,
      };

      if (product.recurring) {
        priceData.recurring = { interval: product.interval || "month" };
      }

      return { price_data: priceData, quantity };
    });

    const hasSubscription = resolvedProducts.some(
      ({ product }) => product.recurring,
    );
    const mode = hasSubscription ? "subscription" : "payment";

    // Optional: extract authenticated user to pre-fill email and link order
    const rawToken = getTokenFromHeader(request);
    const authUser = rawToken
      ? await verifyToken(rawToken).catch(() => null)
      : null;

    const stripe = await getStripe();
    if (!stripe) return Response.json({ error: "Stripe not configured" }, { status: 503 });
    const idempotencyKey = getIdempotencyKey(request);
    const session = await stripe.checkout.sessions.create(
      {
        mode: mode as "payment" | "subscription",
        line_items: lineItems as never[],
        success_url: `${origin}/store/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/store`,
        ...(authUser?.email ? { customer_email: authUser.email } : {}),
        billing_address_collection: "required",
        metadata: {
          source: "cloudless.gr",
          ...(authUser?.sub ? { userId: authUser.sub } : {}),
        },
        shipping_address_collection: resolvedProducts.some(
          ({ product }) =>
            !product.recurring && product.category === "physical",
        )
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
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    return Response.json({ url: session.url });
  } catch (error) {
    // CodeQL js/log-injection — JSON.stringify is the canonical sanitizer
    // for tainted values flowing into console.error (#1753 / #1769).
    const rawMsg = (error as Error)?.message ?? "unknown error";
    const msg = String(rawMsg).replace(/[\x00-\x1f\x7f]/g, " ").slice(0, 200);
    console.error("Checkout error: " + JSON.stringify(msg));

    // Client errors: malformed body or unknown product → 400. Return a fixed,
    // non-reflective message — never echo the raw exception text (which may
    // carry internal product IDs / SDK internals) back to the caller.
    if (/unknown product/i.test(msg)) {
      return Response.json({ error: "Unknown product in cart." }, { status: 400 });
    }
    if (/json/i.test(msg)) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      await import("@sentry/nextjs")
        .then(({ captureException, withScope }) =>
          withScope((scope) => {
            scope.setTag("route", "checkout");
            captureException(error);
          }),
        )
        .catch(() => {});
    }
    return Response.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
