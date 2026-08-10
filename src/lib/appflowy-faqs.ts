/**
 * AppFlowy FAQs CMS adapter.
 *
 * Page naming: `[FAQ] <question>`
 * Optional markdown body:
 *   **Answer**: ...
 *   **Category**: general|pricing|technical|process
 *   **Locale**: en, el, fr
 *   **Published**: true/false
 *   **Order**: number
 */

import {
  listAllWorkspaces,
  listAllViewsDeep,
  getDocument,
  extractDocText,
  isAppFlowyConfigured,
} from "./appflowy";
import type { Faq, FaqCategory, FaqInput } from "./notion-faqs";
import { staticFaqs } from "./notion-faqs";

// Re-export types from Notion adapter (single source of truth)
export { type Faq, type FaqCategory, type FaqInput } from "./notion-faqs";

function stripPrefix(name: string): string {
  return name.replace(/^\[FAQ\]\s*/i, "").trim();
}

function isFaqPage(name: string): boolean {
  return /^\[FAQ\]\s/i.test(name);
}

function parseField(markdown: string, key: string): string {
  const re = new RegExp(`\*\*${key}\*\*:\s*(.+)`, "i");
  const match = re.exec(markdown);
  return match?.[1]?.trim() ?? "";
}

async function getPrimaryWorkspaceId(): Promise<string | null> {
  try {
    const workspaces = await listAllWorkspaces();
    return workspaces[0]?.workspace_id ?? null;
  } catch {
    return null;
  }
}

function mapMarkdownToFaq(viewId: string, markdown: string, lastEdited: string): Faq & { published: boolean; order?: number } {
  const localesRaw = parseField(markdown, "Locale");
  const publishedRaw = parseField(markdown, "Published").toLowerCase();
  const orderRaw = parseField(markdown, "Order");
  const locales = localesRaw
    ? localesRaw
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean)
    : [];
  const published = publishedRaw === "true" || publishedRaw === "yes" || publishedRaw === "✅";
  const order = orderRaw ? parseInt(orderRaw, 10) : undefined;
  const faq: Faq & { published: boolean; order?: number } = {
    id: viewId,
    question: stripPrefix(view.name),
    answer: parseField(markdown, "Answer") || markdown || "",
    category: (parseField(markdown, "Category") || "general") as FaqCategory,
    locales,
    published,
    order,
  };
  return faq;
}

export async function getFaqs(locale?: string): Promise<Faq[]> {
  if (!(await isAppFlowyConfigured())) return [];

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return [];

  try {
    const views = await listAllViewsDeep(workspaceId);
    const faqViews = views.filter((v) => isFaqPage(v.name));
    const faqs: Faq[] = [];

    for (const view of faqViews) {
      let markdown = "";
      try {
        const doc = await getDocument(workspaceId, view.view_id);
        markdown = await extractDocText(doc);
      } catch {
        markdown = "";
      }

      const mapped = mapMarkdownToFaq(view.view_id, markdown, view.last_edited_time);
      
      // Filter by published status for public API
      if (!mapped.published) continue;
      
      if (locale && mapped.locales.length > 0 && !mapped.locales.includes(locale)) {
        continue;
      }
      faqs.push(mapped);
    }

    // Sort by order, then by last edited time
    return faqs.sort((a, b) => {
      const orderA = (a as any).order ?? 999999;
      const orderB = (b as any).order ?? 999999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
    });
  } catch {
    return [];
  }
}

export async function getFaqsByCategory(category: FaqCategory, locale?: string): Promise<Faq[]> {
  const faqs = await getFaqs(locale);
  return faqs.filter((f) => f.category === category);
}

/**
 * List ALL FAQs for the admin panel (published + unpublished, no locale filtering).
 * Mirrors the Notion getAllFaqsAdmin function.
 */
export async function getAllFaqsAdmin(): Promise<Faq[]> {
  if (!(await isAppFlowyConfigured())) return staticFaqs;

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return [];

  try {
    const views = await listAllViewsDeep(workspaceId);
    const faqViews = views.filter((v) => isFaqPage(v.name));
    const faqs: Faq[] = [];

    for (const view of faqViews) {
      let markdown = "";
      try {
        const doc = await getDocument(workspaceId, view.view_id);
        markdown = await extractDocText(doc);
      } catch {
        markdown = "";
      }

      const mapped = mapMarkdownToFaq(view.view_id, markdown, view.last_edited_time);
      // Admin version: no filtering by published or locale
      faqs.push(mapped);
    }

    // Sort by order, then by last edited time
    return faqs.sort((a, b) => {
      const orderA = (a as any).order ?? 999999;
      const orderB = (b as any).order ?? 999999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
    });
  } catch {
    return staticFaqs;
  }
}

export { staticFaqs };