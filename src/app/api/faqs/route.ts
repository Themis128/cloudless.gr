import { NextResponse } from "next/server";
import {
  getFaqs as getAppFlowyFaqs,
  getFaqsByCategory as getAppFlowyFaqsByCategory,
  staticFaqs,
  type FaqCategory,
} from "@/lib/appflowy-faqs";
import { isAppFlowyCmsConfigured, cmsSourceHeaders } from "@/lib/cms-provider";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("locale") ?? undefined;
  const category = searchParams.get("category") ?? undefined;

  const appFlowyConfigured = await isAppFlowyCmsConfigured();

  if (!appFlowyConfigured) {
    let data = locale
      ? staticFaqs.filter((f) => f.locales.length === 0 || f.locales.includes(locale))
      : staticFaqs;
    if (category) data = data.filter((f) => f.category === category);
    return NextResponse.json(data, { headers: cmsSourceHeaders("static") });
  }

  try {
    const faqs = category
      ? await getAppFlowyFaqsByCategory(category as FaqCategory, locale)
      : await getAppFlowyFaqs(locale);
    if (faqs.length > 0) {
      return NextResponse.json(faqs, {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
          ...cmsSourceHeaders("appflowy"),
        },
      });
    }
    let data = locale
      ? staticFaqs.filter((f) => f.locales.length === 0 || f.locales.includes(locale))
      : staticFaqs;
    if (category) data = data.filter((f) => f.category === category);
    return NextResponse.json(data, { headers: cmsSourceHeaders("static") });
  } catch (err) {
    console.error("[API /faqs] Fetch error:", err);
    return NextResponse.json(staticFaqs, { headers: cmsSourceHeaders("static") });
  }
}
