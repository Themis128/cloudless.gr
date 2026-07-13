/**
 * Notion FAQs CMS adapter.
 *
 * Allows FAQ content to be managed from Notion without editing translation files.
 * Falls back to staticFaqs when Notion is not configured.
 *
 * Expected Notion database schema (NOTION_FAQS_DB_ID):
 * ┌──────────┬──────────────────────────────────────────────────────┐
 * │ Column   │ Type                                                 │
 * ├──────────┼──────────────────────────────────────────────────────┤
 * │ Question │ Title                                                │
 * │ Answer   │ Rich text                                            │
 * │ Category │ Select (general | pricing | technical | process)     │
 * │ Locale   │ Multi-select (en, el, fr, de — blank = all locales)  │
 * │ Published│ Checkbox                                             │
 * │ Order    │ Number (ascending display order)                     │
 * └──────────┴──────────────────────────────────────────────────────┘
 */

import { notionFetchAll, extractText, createPage, updatePage, archivePage } from "@/lib/notion";
import {
  getIntegrationsAsync,
  isConfiguredAsync,
  requireIntegrationAsync,
} from "@/lib/integrations";
import { cached, invalidateCache } from "@/lib/notion-cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FaqCategory = "general" | "pricing" | "technical" | "process";

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: FaqCategory;
  locales: string[]; // empty = all locales
}

// ---------------------------------------------------------------------------
// Static fallback
// ---------------------------------------------------------------------------

export const staticFaqs: Faq[] = [
  {
    id: "f1",
    question: "How long does a cloud audit take?",
    answer:
      "A standard cloud audit is delivered within 5 business days. Complex multi-account organisations may require 7–10 days. You'll receive a full written report plus a 60-minute debrief call.",
    category: "process",
    locales: [],
  },
  {
    id: "f2",
    question: "Do you work with other cloud providers besides AWS?",
    answer:
      "Our core expertise is AWS, but we can advise on GCP and Azure architectures. Most engagements involve AWS as the primary cloud, often alongside Cloudflare for edge and CDN.",
    category: "technical",
    locales: [],
  },
  {
    id: "f3",
    question: "What is the minimum engagement size?",
    answer:
      "The smallest engagement is the Cloud Audit at €1,500. There's no minimum contract length for the monthly retainer — you can cancel at any time.",
    category: "pricing",
    locales: [],
  },
  {
    id: "f4",
    question: "Can you help us pass a SOC 2 or ISO 27001 audit?",
    answer:
      "Yes. Cloud Audits cover security misconfigurations and produce evidence artefacts. We can work alongside your compliance team to close gaps before a formal certification audit.",
    category: "technical",
    locales: [],
  },
  {
    id: "f5",
    question: "Do you sign NDAs?",
    answer:
      "Yes, we sign mutual NDAs before any engagement. Your architecture diagrams, cost data, and business context stay strictly confidential.",
    category: "general",
    locales: [],
  },
  {
    id: "f6",
    question: "How does the monthly retainer work?",
    answer:
      "You get up to 20 hours of senior cloud architecture support per month, a monthly infrastructure review call, unlimited async questions via email or Slack, and on-call incident support. Unused hours do not roll over.",
    category: "pricing",
    locales: [],
  },
];

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

 
function mapPage(page: any): Faq {
  const p = page.properties ?? {};
  return {
    id: page.id,
    question: extractText((p.Question ?? p.Title)?.title) || "",
    answer: extractText(p.Answer?.rich_text) || "",
    category: (p.Category?.select?.name as FaqCategory) ?? "general",
    locales: (p.Locale?.multi_select ?? []).map((l: any) => l.name),
  };
}
 

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Admin write API
// ---------------------------------------------------------------------------

export interface FaqInput {
  question: string;
  answer?: string;
  category?: FaqCategory;
  locales?: string[];
  published?: boolean;
  order?: number;
}

/**
 * List ALL FAQs (published + unpublished) for the admin panel.
 */
export async function getAllFaqsAdmin(): Promise<Faq[]> {
  const configured = await isConfiguredAsync("NOTION_API_KEY", "NOTION_FAQS_DB_ID");
  if (!configured) return staticFaqs;

  const { NOTION_FAQS_DB_ID } = await getIntegrationsAsync();
  try {
    const pages = await notionFetchAll(`/databases/${NOTION_FAQS_DB_ID}/query`, {
      sorts: [{ property: "Order", direction: "ascending" }],
    });
    return pages.map(mapPage);
  } catch (err) {
    console.error("[Notion FAQs] Admin list failed:", err);
    return [];
  }
}

/**
 * Create a new FAQ page in Notion.
 */
export async function createFaq(input: FaqInput): Promise<string | null> {
  await requireIntegrationAsync("NOTION_API_KEY", "NOTION_FAQS_DB_ID");
  const { NOTION_FAQS_DB_ID } = await getIntegrationsAsync();

  const id = await createPage(NOTION_FAQS_DB_ID!, {
    Question: { title: [{ text: { content: input.question } }] },
    Answer: { rich_text: [{ text: { content: input.answer ?? "" } }] },
    ...(input.category ? { Category: { select: { name: input.category } } } : {}),
    ...(input.locales?.length
      ? { Locale: { multi_select: input.locales.map((l) => ({ name: l })) } }
      : {}),
    Published: { checkbox: input.published ?? false },
    ...(input.order != null ? { Order: { number: input.order } } : {}),
  });

  if (id) invalidateCache("faqs");
  return id;
}

/**
 * Update an existing FAQ's properties.
 */
export async function updateFaq(pageId: string, input: Partial<FaqInput>): Promise<boolean> {
  const props: Record<string, unknown> = {};
  if (input.question != null) props.Question = { title: [{ text: { content: input.question } }] };
  if (input.answer != null) props.Answer = { rich_text: [{ text: { content: input.answer } }] };
  if (input.category != null) props.Category = { select: { name: input.category } };
  if (input.locales != null)
    props.Locale = { multi_select: input.locales.map((l) => ({ name: l })) };
  if (input.published != null) props.Published = { checkbox: input.published };
  if (input.order != null) props.Order = { number: input.order };

  const ok = await updatePage(pageId, props);
  if (ok) invalidateCache("faqs");
  return ok;
}

/**
 * Archive (soft-delete) a FAQ.
 */
export async function deleteFaq(pageId: string): Promise<boolean> {
  const ok = await archivePage(pageId);
  if (ok) invalidateCache("faqs");
  return ok;
}

// ---------------------------------------------------------------------------
// Public read API
// ---------------------------------------------------------------------------

/**
 * Fetch all published FAQs, sorted by display order ascending.
 * Falls back to staticFaqs when Notion is not configured.
 */
export async function getFaqs(locale?: string): Promise<Faq[]> {
  const configured = await isConfiguredAsync("NOTION_API_KEY", "NOTION_FAQS_DB_ID");
  if (!configured) {
    return locale
      ? staticFaqs.filter((f) => f.locales.length === 0 || f.locales.includes(locale))
      : staticFaqs;
  }

  const cacheKey = `faqs:${locale ?? "all"}`;
  return cached(cacheKey, async () => {
    const { NOTION_FAQS_DB_ID } = await getIntegrationsAsync();
    try {
      const pages = await notionFetchAll(`/databases/${NOTION_FAQS_DB_ID}/query`, {
        filter: { property: "Published", checkbox: { equals: true } },
        sorts: [{ property: "Order", direction: "ascending" }],
      });
      const all = pages.map(mapPage);
      const filtered = locale
        ? all.filter((f) => f.locales.length === 0 || f.locales.includes(locale))
        : all;
      return filtered.length > 0 ? filtered : staticFaqs;
    } catch (err) {
      console.error("[Notion FAQs] Failed to fetch:", err);
      return staticFaqs;
    }
  });
}

/**
 * Fetch FAQs filtered by category.
 */
export async function getFaqsByCategory(category: FaqCategory, locale?: string): Promise<Faq[]> {
  const faqs = await getFaqs(locale);
  return faqs.filter((f) => f.category === category);
}
