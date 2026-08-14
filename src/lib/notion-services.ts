/**
 * Notion Services CMS adapter.
 *
 * Allows service descriptions, pricing, and features to be managed from Notion
 * without a code deploy. Falls back to staticServices when Notion is not configured.
 *
 * Expected Notion database schema (NOTION_SERVICES_DB_ID):
 * ┌──────────────┬───────────────────────────────────────────────────┐
 * │ Column       │ Type                                              │
 * ├──────────────┼───────────────────────────────────────────────────┤
 * │ Name         │ Title                                             │
 * │ Slug         │ Rich text (URL-safe identifier)                   │
 * │ Description  │ Rich text (short paragraph)                       │
 * │ Price        │ Rich text (e.g. "From €2,000" or "€299/mo")       │
 * │ Category     │ Select (audit | devops | consulting | training)   │
 * │ Features     │ Rich text (newline-separated bullet points)       │
 * │ CTA          │ Rich text (button label, e.g. "Book a call")      │
 * │ Icon         │ Rich text (emoji, e.g. "🔍")                      │
 * │ StripePriceId│ Rich text (optional Stripe price ID)              │
 * │ Published    │ Checkbox                                          │
 * │ Order        │ Number (ascending display order)                  │
 * └──────────────┴───────────────────────────────────────────────────┘
 */

import { notionFetchAll, extractText, createPage, updatePage, archivePage } from "@/lib/notion";
import {
  getIntegrationsAsync,
  isConfiguredAsync,
  requireIntegrationAsync,
} from "@/lib/integrations";
import { cached, invalidateCache } from "@/lib/notion-cache";
import {
  staticServices,
  type CloudlessService,
  type ServiceCategory,
  type ServiceInput,
} from "@/lib/cms-static";

export type { CloudlessService, ServiceCategory, ServiceInput } from "@/lib/cms-static";
export { staticServices } from "@/lib/cms-static";

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapPage(page: any): CloudlessService {
  const p = page.properties ?? {};
  const featuresRaw = extractText(p.Features?.rich_text) || "";
  const features = featuresRaw
    .split("\n")
    .map((f: string) => f.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  return {
    id: page.id,
    slug: extractText(p.Slug?.rich_text) || page.id,
    name: extractText((p.Name ?? p.Title)?.title) || "",
    description: extractText(p.Description?.rich_text) || "",
    price: extractText(p.Price?.rich_text) || "",
    category: (p.Category?.select?.name as ServiceCategory) ?? "consulting",
    features,
    cta: extractText(p.CTA?.rich_text) || "Learn more",
    icon: extractText(p.Icon?.rich_text) || "☁️",
    stripePriceId: extractText(p.StripePriceId?.rich_text) || undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Admin write API
// ---------------------------------------------------------------------------

/**
 * List ALL services (published + unpublished) for the admin panel.
 */
export async function getAllServicesAdmin(): Promise<CloudlessService[]> {
  const configured = await isConfiguredAsync("NOTION_API_KEY", "NOTION_SERVICES_DB_ID");
  if (!configured) return staticServices;

  const { NOTION_SERVICES_DB_ID } = await getIntegrationsAsync();
  try {
    const pages = await notionFetchAll(`/databases/${NOTION_SERVICES_DB_ID}/query`, {
      sorts: [{ property: "Order", direction: "ascending" }],
    });
    return pages.map(mapPage);
  } catch (err) {
    console.error("[Notion Services] Admin list failed:", err);
    return [];
  }
}

/**
 * Create a new service page in Notion.
 */
export async function createService(input: ServiceInput): Promise<string | null> {
  await requireIntegrationAsync("NOTION_API_KEY", "NOTION_SERVICES_DB_ID");
  const { NOTION_SERVICES_DB_ID } = await getIntegrationsAsync();

  const featuresText = (input.features ?? []).join("\n");
  const id = await createPage(NOTION_SERVICES_DB_ID!, {
    Name: { title: [{ text: { content: input.name } }] },
    Slug: { rich_text: [{ text: { content: input.slug ?? "" } }] },
    Description: { rich_text: [{ text: { content: input.description ?? "" } }] },
    Price: { rich_text: [{ text: { content: input.price ?? "" } }] },
    ...(input.category ? { Category: { select: { name: input.category } } } : {}),
    Features: { rich_text: [{ text: { content: featuresText } }] },
    CTA: { rich_text: [{ text: { content: input.cta ?? "Learn more" } }] },
    Icon: { rich_text: [{ text: { content: input.icon ?? "☁️" } }] },
    ...(input.stripePriceId
      ? { StripePriceId: { rich_text: [{ text: { content: input.stripePriceId } }] } }
      : {}),
    Published: { checkbox: input.published ?? false },
    ...(input.order != null ? { Order: { number: input.order } } : {}),
  });

  if (id) invalidateCache("services");
  return id;
}

/**
 * Update an existing service's properties.
 */
export async function updateService(
  pageId: string,
  input: Partial<ServiceInput>
): Promise<boolean> {
  const props: Record<string, unknown> = {};
  if (input.name != null) props.Name = { title: [{ text: { content: input.name } }] };
  if (input.slug != null) props.Slug = { rich_text: [{ text: { content: input.slug } }] };
  if (input.description != null)
    props.Description = { rich_text: [{ text: { content: input.description } }] };
  if (input.price != null) props.Price = { rich_text: [{ text: { content: input.price } }] };
  if (input.category != null) props.Category = { select: { name: input.category } };
  if (input.features != null)
    props.Features = { rich_text: [{ text: { content: input.features.join("\n") } }] };
  if (input.cta != null) props.CTA = { rich_text: [{ text: { content: input.cta } }] };
  if (input.icon != null) props.Icon = { rich_text: [{ text: { content: input.icon } }] };
  if (input.stripePriceId !== undefined)
    props.StripePriceId = { rich_text: [{ text: { content: input.stripePriceId ?? "" } }] };
  if (input.published != null) props.Published = { checkbox: input.published };
  if (input.order != null) props.Order = { number: input.order };

  const ok = await updatePage(pageId, props);
  if (ok) invalidateCache("services");
  return ok;
}

/**
 * Archive (soft-delete) a service.
 */
export async function deleteService(pageId: string): Promise<boolean> {
  const ok = await archivePage(pageId);
  if (ok) invalidateCache("services");
  return ok;
}

// ---------------------------------------------------------------------------
// Public read API
// ---------------------------------------------------------------------------

/**
 * Fetch all published services, sorted by display order ascending.
 * Falls back to staticServices when Notion is not configured.
 */
export async function getServices(): Promise<CloudlessService[]> {
  const configured = await isConfiguredAsync("NOTION_API_KEY", "NOTION_SERVICES_DB_ID");
  if (!configured) return staticServices;

  return cached("services:all", async () => {
    const { NOTION_SERVICES_DB_ID } = await getIntegrationsAsync();
    try {
      const pages = await notionFetchAll(`/databases/${NOTION_SERVICES_DB_ID}/query`, {
        filter: { property: "Published", checkbox: { equals: true } },
        sorts: [{ property: "Order", direction: "ascending" }],
      });
      const results = pages.map(mapPage);
      return results.length > 0 ? results : staticServices;
    } catch (err) {
      console.error("[Notion Services] Failed to fetch:", err);
      return staticServices;
    }
  });
}

/**
 * Fetch a single service by slug.
 */
export async function getServiceBySlug(slug: string): Promise<CloudlessService | null> {
  const services = await getServices();
  return services.find((s) => s.slug === slug) ?? null;
}

/**
 * Fetch services filtered by category.
 */
export async function getServicesByCategory(
  category: ServiceCategory
): Promise<CloudlessService[]> {
  const services = await getServices();
  return services.filter((s) => s.category === category);
}
