import { NextResponse } from "next/server";
import { getFaqs, getFaqsByCategory, staticFaqs } from "@/lib/notion-faqs";
import { isConfiguredAsync } from "@/lib/integrations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("locale") ?? undefined;
  const category = searchParams.get("category") ?? undefined;

  const configured = await isConfiguredAsync("NOTION_API_KEY", "NOTION_FAQS_DB_ID");

  if (!configured) {
    let data = locale
      ? staticFaqs.filter((f) => f.locales.length === 0 || f.locales.includes(locale))
      : staticFaqs;
    if (category) data = data.filter((f) => f.category === category);
    return NextResponse.json(data, { headers: { "x-cms-source": "static" } });
  }

  try {
    const faqs = category
      ? await getFaqsByCategory(category as Parameters<typeof getFaqsByCategory>[0], locale)
      : await getFaqs(locale);
    return NextResponse.json(faqs, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
        "x-cms-source": "notion",
      },
    });
  } catch (err) {
    console.error("[API /faqs] Fetch error:", err);
    return NextResponse.json(staticFaqs, { headers: { "x-cms-source": "static" } });
  }
}
