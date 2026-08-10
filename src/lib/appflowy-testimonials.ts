/**
 * AppFlowy Testimonials CMS adapter.
 *
 * Page naming: `[Testimonial] <name>`
 * Optional markdown body:
 *   **Company**: ...
 *   **Role**: ...
 *   **Quote**: ...
 *   **Service**: ...
 *   **Rating**: 5
 *   **Featured**: true
 *   **Avatar**: https://...
 */

import {
  listAllWorkspaces,
  listAllViewsDeep,
  getDocument,
  extractDocText,
  isAppFlowyConfigured,
} from "./appflowy";
import type { Testimonial, TestimonialInput } from "./notion-testimonials";
import { staticTestimonials } from "./notion-testimonials";

// Re-export types from Notion adapter (single source of truth)
export { type Testimonial, type TestimonialInput } from "./notion-testimonials";

function stripPrefix(name: string): string {
  return name.replace(/^\[Testimonial\]\s*/i, "").trim();
}

function isTestimonialPage(name: string): boolean {
  return /^\[Testimonial\]\s/i.test(name);
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

export async function getTestimonials(): Promise<Testimonial[]> {
  if (!(await isAppFlowyConfigured())) return [];

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return [];

  try {
    const views = await listAllViewsDeep(workspaceId);
    const testimonialViews = views.filter((v) => isTestimonialPage(v.name));
    const testimonials: Testimonial[] = [];

    for (const view of testimonialViews) {
      let markdown = "";
      try {
        const doc = await getDocument(workspaceId, view.view_id);
        markdown = await extractDocText(doc);
      } catch {
        markdown = "";
      }

      const ratingRaw = Number(parseField(markdown, "Rating"));
      const featuredRaw = parseField(markdown, "Featured").toLowerCase();
      testimonials.push({
        id: view.view_id,
        name: stripPrefix(view.name),
        company: parseField(markdown, "Company") || "",
        role: parseField(markdown, "Role") || "",
        quote: parseField(markdown, "Quote") || markdown || "",
        avatar: parseField(markdown, "Avatar") || undefined,
        service: parseField(markdown, "Service") || undefined,
        rating: Number.isFinite(ratingRaw) && ratingRaw > 0 ? Math.min(5, ratingRaw) : undefined,
        featured: featuredRaw === "true" || featuredRaw === "yes" || featuredRaw === "✅",
      });
    }

    return testimonials;
  } catch {
    return [];
  }
}

export async function getFeaturedTestimonials(): Promise<Testimonial[]> {
  const all = await getTestimonials();
  return all.filter((t) => t.featured);
}

/**
 * List ALL testimonials for the admin panel (published + unpublished).
 * Mirrors the Notion getAllTestimonialsAdmin function.
 */
export async function getAllTestimonialsAdmin(): Promise<Testimonial[]> {
  if (!(await isAppFlowyConfigured())) return staticTestimonials;

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return [];

  try {
    const views = await listAllViewsDeep(workspaceId);
    const testimonialViews = views.filter((v) => isTestimonialPage(v.name));
    const testimonials: Testimonial[] = [];

    for (const view of testimonialViews) {
      let markdown = "";
      try {
        const doc = await getDocument(workspaceId, view.view_id);
        markdown = await extractDocText(doc);
      } catch {
        markdown = "";
      }

      const ratingRaw = Number(parseField(markdown, "Rating"));
      const featuredRaw = parseField(markdown, "Featured").toLowerCase();
      testimonials.push({
        id: view.view_id,
        name: stripPrefix(view.name),
        company: parseField(markdown, "Company") || "",
        role: parseField(markdown, "Role") || "",
        quote: parseField(markdown, "Quote") || markdown || "",
        avatar: parseField(markdown, "Avatar") || undefined,
        service: parseField(markdown, "Service") || undefined,
        rating: Number.isFinite(ratingRaw) && ratingRaw > 0 ? Math.min(5, ratingRaw) : undefined,
        featured: featuredRaw === "true" || featuredRaw === "yes" || featuredRaw === "✅",
      });
    }

    return testimonials;
  } catch {
    return staticTestimonials;
  }
}

export { staticTestimonials };