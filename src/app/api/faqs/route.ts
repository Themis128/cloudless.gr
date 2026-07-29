import { NextResponse } from "next/server";
import {
  getFaqs as getAppFlowyFaqs,
  getFaqsByCategory as getAppFlowyFaqsByCategory,
  staticFaqs,
} from "@/lib/appflowy-faqs";
import {
  getFaqs as getNotionFaqs,
  getFaqsByCategory as getNotionFaqsByCategory,
} from "@/lib/notion-faqs";
import type { FaqCategory } from "@/lib/notion-faqs";
import { isAppFlowyCmsConfigured, isNotionCmsConfigured, cmsSourceHeaders } from "@/lib/cms-provider";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("locale") ?? undefined;
  const category = searchParams.get("category") ?? undefined;

  const appFlowyConfigured = await isAppFlowyCmsConfigured();
  const notionConfigured = await isNotionCmsConfigured("NOTION_API_KEY", "NOTION_FAQS_DB_ID");

  if (!appFlowyConfigured && !notionConfigured) {
    let data = locale
      ? staticFaqs.filter((f) => f.locales.length === 0 || f.locales.includes(locale))
      : staticFaqs;
    if (category) data = data.filter((f) => f.category === category);
    return NextResponse.json(data, { headers: cmsSourceHeaders("static") });
  }

  try {
    if (appFlowyConfigured) {
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
    }

    const faqs = category
      ? await getNotionFaqsByCategory(category as FaqCategory, locale)
      : await getNotionFaqs(locale);
    return NextResponse.json(faqs, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60",
        ...cmsSourceHeaders("notion"),
      },
    });
  } catch (err) {
    console.error("[API /faqs] Fetch error:", err);
    return NextResponse.json(staticFaqs, { headers: cmsSourceHeaders("static") });
  }
}
