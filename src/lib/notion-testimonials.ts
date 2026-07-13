/**
 * Notion Testimonials CMS adapter.
 *
 * Expected Notion database schema (NOTION_TESTIMONIALS_DB_ID):
 * ┌──────────┬──────────────────────────────────────────────────────┐
 * │ Column   │ Type                                                 │
 * ├──────────┼──────────────────────────────────────────────────────┤
 * │ Name     │ Title                                                │
 * │ Company  │ Rich text                                            │
 * │ Role     │ Rich text                                            │
 * │ Quote    │ Rich text                                            │
 * │ Avatar   │ URL (optional — absolute URL to head shot)           │
 * │ Service  │ Select (which Cloudless service they used)           │
 * │ Rating   │ Number (1–5, optional)                               │
 * │ Featured │ Checkbox                                             │
 * │ Published│ Checkbox                                             │
 * │ Order    │ Number (ascending display order)                     │
 * └──────────┴──────────────────────────────────────────────────────┘
 */

import { notionFetchAll, extractText, createPage, updatePage, archivePage } from "@/lib/notion";
import {
  getIntegrationsAsync,
  requireIntegrationAsync,
  isConfiguredAsync,
} from "@/lib/integrations";
import { cached, invalidateCache } from "@/lib/notion-cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Testimonial {
  id: string;
  name: string;
  company: string;
  role: string;
  quote: string;
  avatar?: string;
  service?: string;
  rating?: number;
  featured: boolean;
}

// ---------------------------------------------------------------------------
// Static fallback — shown before any Notion database is created
// ---------------------------------------------------------------------------

export const staticTestimonials: Testimonial[] = [
  {
    id: "t1",
    name: "Alexandros Papadopoulos",
    company: "TechFlow Athens",
    role: "CTO",
    quote:
      "Cloudless cut our AWS bill by 55% in the first month. Themis understood our architecture immediately and had a plan within 24 hours.",
    service: "Cloud Audit",
    rating: 5,
    featured: true,
  },
  {
    id: "t2",
    name: "Maria Stavridou",
    company: "Retail Plus",
    role: "Head of Engineering",
    quote:
      "We migrated a monolith to serverless in 6 weeks with zero downtime. The result is 10× faster deployments and half the infrastructure cost.",
    service: "Architecture Migration",
    rating: 5,
    featured: true,
  },
  {
    id: "t3",
    name: "Nikos Theodorakis",
    company: "FinStart GR",
    role: "Founder & CEO",
    quote:
      "The monthly retainer gives us a senior cloud architect on call without the full-time hire cost. Invaluable for a startup.",
    service: "Monthly Retainer",
    rating: 5,
    featured: false,
  },
];

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

 
function mapPage(page: any): Testimonial {
  const p = page.properties ?? {};
  const rating = p.Rating?.number;
  return {
    id: page.id,
    name: extractText((p.Name ?? p.Title)?.title) || "Anonymous",
    company: extractText(p.Company?.rich_text) || "",
    role: extractText(p.Role?.rich_text) || "",
    quote: extractText(p.Quote?.rich_text) || "",
    avatar: p.Avatar?.url ?? undefined,
    service: p.Service?.select?.name ?? undefined,
    rating: typeof rating === "number" ? Math.min(5, Math.max(1, rating)) : undefined,
    featured: p.Featured?.checkbox ?? false,
  };
}
 

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Admin write API
// ---------------------------------------------------------------------------

export interface TestimonialInput {
  name: string;
  company?: string;
  role?: string;
  quote: string;
  avatar?: string;
  service?: string;
  rating?: number;
  featured?: boolean;
  published?: boolean;
  order?: number;
}

/**
 * List ALL testimonials (published + unpublished) for the admin panel.
 */
export async function getAllTestimonialsAdmin(): Promise<Testimonial[]> {
  const configured = await isConfiguredAsync("NOTION_API_KEY", "NOTION_TESTIMONIALS_DB_ID");
  if (!configured) return staticTestimonials;

  const { NOTION_TESTIMONIALS_DB_ID } = await getIntegrationsAsync();
  try {
    const pages = await notionFetchAll(`/databases/${NOTION_TESTIMONIALS_DB_ID}/query`, {
      sorts: [{ property: "Order", direction: "ascending" }],
    });
    return pages.map(mapPage);
  } catch (err) {
    console.error("[Notion Testimonials] Admin list failed:", err);
    return [];
  }
}

/**
 * Create a new testimonial page in Notion.
 */
export async function createTestimonial(input: TestimonialInput): Promise<string | null> {
  await requireIntegrationAsync("NOTION_API_KEY", "NOTION_TESTIMONIALS_DB_ID");
  const { NOTION_TESTIMONIALS_DB_ID } = await getIntegrationsAsync();

  const id = await createPage(NOTION_TESTIMONIALS_DB_ID!, {
    Name: { title: [{ text: { content: input.name } }] },
    Company: { rich_text: [{ text: { content: input.company ?? "" } }] },
    Role: { rich_text: [{ text: { content: input.role ?? "" } }] },
    Quote: { rich_text: [{ text: { content: input.quote } }] },
    ...(input.avatar ? { Avatar: { url: input.avatar } } : {}),
    ...(input.service ? { Service: { select: { name: input.service } } } : {}),
    ...(input.rating != null ? { Rating: { number: input.rating } } : {}),
    Featured: { checkbox: input.featured ?? false },
    Published: { checkbox: input.published ?? false },
    ...(input.order != null ? { Order: { number: input.order } } : {}),
  });

  if (id) invalidateCache("testimonials");
  return id;
}

/**
 * Update an existing testimonial's properties.
 */
export async function updateTestimonial(
  pageId: string,
  input: Partial<TestimonialInput>
): Promise<boolean> {
  const props: Record<string, unknown> = {};
  if (input.name != null) props.Name = { title: [{ text: { content: input.name } }] };
  if (input.company != null) props.Company = { rich_text: [{ text: { content: input.company } }] };
  if (input.role != null) props.Role = { rich_text: [{ text: { content: input.role } }] };
  if (input.quote != null) props.Quote = { rich_text: [{ text: { content: input.quote } }] };
  if (input.avatar !== undefined)
    props.Avatar = input.avatar ? { url: input.avatar } : { url: null };
  if (input.service !== undefined)
    props.Service = input.service ? { select: { name: input.service } } : { select: null };
  if (input.rating != null) props.Rating = { number: input.rating };
  if (input.featured != null) props.Featured = { checkbox: input.featured };
  if (input.published != null) props.Published = { checkbox: input.published };
  if (input.order != null) props.Order = { number: input.order };

  const ok = await updatePage(pageId, props);
  if (ok) invalidateCache("testimonials");
  return ok;
}

/**
 * Archive (soft-delete) a testimonial.
 */
export async function deleteTestimonial(pageId: string): Promise<boolean> {
  const ok = await archivePage(pageId);
  if (ok) invalidateCache("testimonials");
  return ok;
}

// ---------------------------------------------------------------------------
// Public read API
// ---------------------------------------------------------------------------

/**
 * Fetch all published testimonials, sorted by display order ascending.
 */
export async function getTestimonials(): Promise<Testimonial[]> {
  await requireIntegrationAsync("NOTION_API_KEY", "NOTION_TESTIMONIALS_DB_ID");

  return cached("testimonials:all", async () => {
    const { NOTION_TESTIMONIALS_DB_ID } = await getIntegrationsAsync();
    try {
      const pages = await notionFetchAll(`/databases/${NOTION_TESTIMONIALS_DB_ID}/query`, {
        filter: { property: "Published", checkbox: { equals: true } },
        sorts: [{ property: "Order", direction: "ascending" }],
      });
      return pages.map(mapPage);
    } catch (err) {
      console.error("[Notion Testimonials] Failed to fetch:", err);
      return [];
    }
  });
}

/**
 * Fetch featured testimonials only (for homepage / services page).
 */
export async function getFeaturedTestimonials(): Promise<Testimonial[]> {
  const all = await getTestimonials();
  return all.filter((t) => t.featured);
}
