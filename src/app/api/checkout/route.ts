import { NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getProductById } from "@/lib/store-products";

interface CheckoutItem {
  id: string;
  quantity: number;
}

export async function POST(request: NextRequest) {
  try {
    const { items } = (await request.json()) as { items: CheckoutItem[] };

    if (!items || items.length === 0) {
      return Response.json({ error: "No items in cart" }, { status: 400 });
    }

    const origin = request.headers.get("origin") || "https://cloudless.gr";

    const resolvedProducts = items.map((item) => {
      const product = getProductById(item.id);
      if (!product) {
        throw new Error(`Unknown product: ${item.id}`);
      }
      return { product, quantity: Math.max(1, Math.min(item.quantity || 1, 99)) };
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

    const hasSubscription = resolvedProducts.some(({ product }) => product.recurring);
    const mode = hasSubscription ? "subscription" : "payment";

    const stripe = await getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: mode as "payment" | "subscription",
      line_items: lineItems as never[],
      success_url: `${origin}/store/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/store`,
      billing_address_collection: "required",
      shipping_address_collection: resolvedProducts.some(
        ({ product }) => !product.recurring && product.category === "physical",
      )
        ? {
            allowed_countries: [
              "GR","DE","FR","IT","ES","NL","BE","AT","PT","IE","FI","SE","DK",
              "PL","CZ","RO","BG","HR","SK","SI","LT","LV","EE","LU","MT","CY",
              "US","GB","CA","AU",
            ],
          }
        : undefined,
    });

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
    return Response.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
