import { NextRequest, NextResponse } from "next/server";
import { getProductById } from "@/lib/store-products";
import { getCampaign } from "@/data/campaigns";
import { routing } from "@/i18n/routing";
import { canonicalOrigin } from "@/lib/canonical-origin";

interface CheckoutItem {
  id: string;
  quantity: number;
}

function pickLocale(request: NextRequest): string {
  // Honor x-pathname (set by `src/proxy.ts`) so we keep the visitor on the
  // locale they arrived on. Falls back to defaultLocale.
  const pathname = request.headers.get("x-pathname") ?? request.nextUrl.pathname;
  const seg = pathname.split("/").filter(Boolean)[0];
  if ((routing.locales as readonly string[]).includes(seg)) return seg;
  return routing.defaultLocale;
}

export async function POST(request: NextRequest) {
  let parsed: { items?: CheckoutItem[] };
  try {
    parsed = (await request.json()) as { items?: CheckoutItem[] };
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { items } = parsed;
  if (!items || items.length === 0) {
    return Response.json({ error: "No items in cart" }, { status: 400 });
  }

  const productNames: string[] = [];
  for (const item of items) {
    const product = getProductById(item.id);
    if (!product) {
      return Response.json({ error: "Unknown product in cart." }, { status: 400 });
    }
    const qty = Math.max(1, Math.min(item.quantity || 1, 99));
    productNames.push(qty > 1 ? `${product.name} (x${qty})` : product.name);
  }

  // Redirect to contact page with product context
  const rawOrigin = request.headers.get("origin") ?? "https://cloudless.gr";
  const allowedOrigins = ["https://cloudless.gr", "https://www.cloudless.gr"];
  if (process.env.NODE_ENV === "development" && rawOrigin.startsWith("http://localhost")) {
    allowedOrigins.push(rawOrigin);
  }
  const origin = allowedOrigins.includes(rawOrigin) ? rawOrigin : "https://cloudless.gr";

  const locale = pickLocale(request);
  const contactUrl = new URL(`/${locale}/contact`, origin);
  contactUrl.searchParams.set("topic", "purchase");
  contactUrl.searchParams.set("products", productNames.join(", "));

  return Response.json({ url: contactUrl.toString() });
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
  const knownTier =
    tier === "fit-call" || campaign.tiers.some((t) => t.id === tier);
  if (!knownTier) {
    return NextResponse.json({ error: "Unknown tier" }, { status: 400 });
  }

  const locale = pickLocale(request);
  const origin = canonicalOrigin(request);

  const utm = {
    utm_source: request.nextUrl.searchParams.get("utm_source")?.slice(0, 100) ?? "",
    utm_medium: request.nextUrl.searchParams.get("utm_medium")?.slice(0, 100) ?? "",
    utm_campaign: request.nextUrl.searchParams.get("utm_campaign")?.slice(0, 100) ?? "",
    utm_term: request.nextUrl.searchParams.get("utm_term")?.slice(0, 100) ?? "",
    utm_content: request.nextUrl.searchParams.get("utm_content")?.slice(0, 100) ?? "",
  };

  // fit-call is the lead-form path — redirect to contact form to capture email.
  if (tier === "fit-call") {
    const contactUrl = new URL(`/${locale}/contact`, origin);
    contactUrl.searchParams.set("topic", "fit-call");
    contactUrl.searchParams.set("campaign", campaign.slug);
    for (const [k, v] of Object.entries(utm)) {
      if (v) contactUrl.searchParams.set(k, v);
    }
    return NextResponse.redirect(contactUrl, 302);
  }

  const tierData = campaign.tiers.find((t) => t.id === tier)!;

  // Redirect to contact page with context instead of Stripe Checkout
  const contactUrl = new URL(`/${locale}/contact`, origin);
  contactUrl.searchParams.set("topic", "purchase");
  contactUrl.searchParams.set("campaign", campaign.slug);
  contactUrl.searchParams.set("tier", tierData.name.en);
  if (tierData.oneOff) contactUrl.searchParams.set("price", tierData.oneOff);
  for (const [k, v] of Object.entries(utm)) {
    if (v) contactUrl.searchParams.set(k, v);
  }

  return NextResponse.redirect(contactUrl, 302);
}
