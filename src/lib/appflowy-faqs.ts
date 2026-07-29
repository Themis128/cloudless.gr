/**
 * AppFlowy FAQs CMS adapter.
 *
 * Page naming: `[FAQ] <question>`
 * Optional markdown body:
 *   **Answer**: ...
 *   **Category**: general|pricing|technical|process
 *   **Locale**: en, el, fr
 */

import {
  listAllWorkspaces,
  listAllViewsDeep,
  getDocument,
  extractDocText,
  isAppFlowyConfigured,
} from "./appflowy";
import type { Faq, FaqCategory } from "./notion-faqs";
import { staticFaqs } from "./notion-faqs";

function stripPrefix(name: string): string {
  return name.replace(/^\[FAQ\]\s*/i, "").trim();
}

function isFaqPage(name: string): boolean {
  return /^\[FAQ\]\s/i.test(name);
}

function parseField(markdown: string, key: string): string {
  const re = new RegExp(`\\*\\*${key}\\*\\*:\\s*(.+)`, "i");
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

      const localesRaw = parseField(markdown, "Locale");
      const locales = localesRaw
        ? localesRaw
            .split(",")
            .map((l) => l.trim())
            .filter(Boolean)
        : [];
      const faq: Faq = {
        id: view.view_id,
        question: stripPrefix(view.name),
        answer: parseField(markdown, "Answer") || markdown || "",
        category: (parseField(markdown, "Category") || "general") as FaqCategory,
        locales,
      };

      if (locale && faq.locales.length > 0 && !faq.locales.includes(locale)) {
        continue;
      }
      faqs.push(faq);
    }

    return faqs;
  } catch {
    return [];
  }
}

export async function getFaqsByCategory(category: FaqCategory, locale?: string): Promise<Faq[]> {
  const faqs = await getFaqs(locale);
  return faqs.filter((f) => f.category === category);
}

export { staticFaqs };
