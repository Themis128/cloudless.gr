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
  fetchViewMarkdownMap,
  isAppFlowyConfigured,
} from "./appflowy";
import type { Testimonial } from "./cms-static";
import { staticTestimonials } from "./cms-static";

export type { Testimonial, TestimonialInput } from "./cms-static";

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

function mapViewToTestimonial(
  view: { view_id: string; name: string },
  markdown: string
): Testimonial {
  const ratingRaw = Number(parseField(markdown, "Rating"));
  const featuredRaw = parseField(markdown, "Featured").toLowerCase();
  return {
    id: view.view_id,
    name: stripPrefix(view.name),
    company: parseField(markdown, "Company") || "",
    role: parseField(markdown, "Role") || "",
    quote: parseField(markdown, "Quote") || markdown || "",
    avatar: parseField(markdown, "Avatar") || undefined,
    service: parseField(markdown, "Service") || undefined,
    rating: Number.isFinite(ratingRaw) && ratingRaw > 0 ? Math.min(5, ratingRaw) : undefined,
    featured: featuredRaw === "true" || featuredRaw === "yes" || featuredRaw === "✅",
  };
}

export async function getTestimonials(): Promise<Testimonial[]> {
  if (!(await isAppFlowyConfigured())) return [];

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return [];

  try {
    const views = await listAllViewsDeep(workspaceId);
    const testimonialViews = views.filter((v) => isTestimonialPage(v.name));
    const docs = await fetchViewMarkdownMap(workspaceId, testimonialViews);
    const testimonials: Testimonial[] = testimonialViews.map((view) =>
      mapViewToTestimonial(view, docs.get(view.view_id) ?? "")
    );

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
    const docs = await fetchViewMarkdownMap(workspaceId, testimonialViews);
    const testimonials: Testimonial[] = testimonialViews.map((view) =>
      mapViewToTestimonial(view, docs.get(view.view_id) ?? "")
    );

    return testimonials;
  } catch {
    return staticTestimonials;
  }
}

export { staticTestimonials };
