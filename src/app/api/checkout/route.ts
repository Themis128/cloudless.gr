import { NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getProductById } from "@/lib/store-products";
import { getTokenFromHeader, verifyToken } from "@/lib/api-auth";

interface CheckoutItem {
  id: string;
  quantity: number;
}

function getIdempotencyKey(request: NextRequest): string | undefined {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key) return undefined;

  // Stripe allows up to 255 chars. Keep format strict to avoid log/header abuse.
  if (!/^[A-Za-z0-9:_-]{8,255}$/.test(key)) return undefined;
  return key;
}

export async function POST(request: NextRequest) {
  try {
    const { items } = (await request.json()) as { items: CheckoutItem[] };

    if (!items || items.length === 0) {
      return Response.json({ error: "No items in cart" }, { status: 400 });
    }

    // Validate origin against allowlist to prevent open redirect
    const rawOrigin = request.headers.get("origin") ?? "";
    const allowedOrigins = ["https://cloudless.gr", "https://www.cloudless.gr"];
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
    const idempotencyKey = getIdempotencyKey(request);
    const session = await stripe.checkout.sessions.create({
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
        ({ product }) => !product.recurring && product.category === "physical",
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
    }, idempotencyKey ? { idempotencyKey } : undefined);

    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
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
