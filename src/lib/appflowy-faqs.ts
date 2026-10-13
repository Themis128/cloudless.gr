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
  fetchViewMarkdownMap,
  isAppFlowyConfigured,
} from "./appflowy";
import { staticFaqs, type Faq, type FaqCategory } from "./cms-static";

export type { Faq, FaqCategory, FaqInput } from "./cms-static";
export { staticFaqs } from "./cms-static";

/** AppFlowy FAQ entry — Notion `Faq` plus AppFlowy-specific editorial fields. */
interface AppFlowyFaq extends Faq {
  published: boolean;
  order?: number;
  /** ISO timestamp of the AppFlowy view's last edit — used for stable ordering. */
  date: string;
}

function stripPrefix(name: string): string {
  return name.replace(/^\[FAQ\]\s*/i, "").trim();
}

function isFaqPage(name: string): boolean {
  return /^\[FAQ\]\s/i.test(name);
}

function parseField(markdown: string, key: string): string {
  // Template literals are not regex literals — escapes must be doubled (\\*, \\s).
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\*\\*${escapedKey}\\*\\*:\\s*(.+)`, "i");
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

function mapMarkdownToFaq(
  viewId: string,
  viewName: string,
  markdown: string,
  lastEdited: string
): AppFlowyFaq {
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
  return {
    id: viewId,
    question: stripPrefix(viewName),
    answer: parseField(markdown, "Answer") || markdown || "",
    category: (parseField(markdown, "Category") || "general") as FaqCategory,
    locales,
    published,
    order,
    date: lastEdited,
  };
}

function sortFaqs(faqs: AppFlowyFaq[]): AppFlowyFaq[] {
  // Sort by order, then by last edited time
  return faqs.sort((a, b) => {
    const orderA = a.order ?? 999999;
    const orderB = b.order ?? 999999;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
  });
}

export async function getFaqs(locale?: string): Promise<AppFlowyFaq[]> {
  if (!(await isAppFlowyConfigured())) return [];

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return [];

  try {
    const views = await listAllViewsDeep(workspaceId);
    const faqViews = views.filter((v) => isFaqPage(v.name));
    const docs = await fetchViewMarkdownMap(workspaceId, faqViews);
    const faqs: AppFlowyFaq[] = faqViews
      .map((view) => {
        const mapped = mapMarkdownToFaq(
          view.view_id,
          view.name,
          docs.get(view.view_id) ?? "",
          view.last_edited_time
        );
        // Filter by published status for public API
        if (!mapped.published) return null;
        if (locale && mapped.locales.length > 0 && !mapped.locales.includes(locale)) {
          return null;
        }
        return mapped;
      })
      .filter((f): f is AppFlowyFaq => f !== null);

    return sortFaqs(faqs);
  } catch {
    return [];
  }
}

export async function getFaqsByCategory(
  category: FaqCategory,
  locale?: string
): Promise<AppFlowyFaq[]> {
  const faqs = await getFaqs(locale);
  return faqs.filter((f) => f.category === category);
}

/**
 * List ALL FAQs for the admin panel (published + unpublished, no locale filtering).
 * Mirrors the Notion getAllFaqsAdmin function.
 */
export async function getAllFaqsAdmin(): Promise<AppFlowyFaq[]> {
  if (!(await isAppFlowyConfigured())) {
    // Convert staticFaqs to AppFlowyFaq format with required fields
    return staticFaqs.map((f) => ({
      ...f,
      published: true,
      date: new Date().toISOString(),
    }));
  }

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return [];

  try {
    const views = await listAllViewsDeep(workspaceId);
    const faqViews = views.filter((v) => isFaqPage(v.name));
    const docs = await fetchViewMarkdownMap(workspaceId, faqViews);
    // Admin version: no filtering by published or locale
    const faqs: AppFlowyFaq[] = faqViews.map((view) =>
      mapMarkdownToFaq(view.view_id, view.name, docs.get(view.view_id) ?? "", view.last_edited_time)
    );

    return sortFaqs(faqs);
  } catch {
    // Convert staticFaqs to AppFlowyFaq format with required fields
    return staticFaqs.map((f) => ({
      ...f,
      published: true,
      date: new Date().toISOString(),
    }));
  }
}
