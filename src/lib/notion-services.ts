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

import { notionFetchAll, extractText } from "@/lib/notion";
import {
  getIntegrationsAsync,
  isConfiguredAsync,
} from "@/lib/integrations";
import { cached } from "@/lib/notion-cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ServiceCategory = "audit" | "devops" | "consulting" | "training";

export interface CloudlessService {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: string;
  category: ServiceCategory;
  features: string[];
  cta: string;
  icon: string;
  stripePriceId?: string;
}

// ---------------------------------------------------------------------------
// Static fallback — mirrors the hard-coded services page content
// ---------------------------------------------------------------------------

export const staticServices: CloudlessService[] = [
  {
    id: "cloud-audit",
    slug: "cloud-audit",
    name: "Cloud Audit",
    description:
      "A deep-dive into your AWS infrastructure to uncover hidden costs, security gaps, and performance bottlenecks. Delivered within 5 business days.",
    price: "From €1,500",
    category: "audit",
    icon: "🔍",
    features: [
      "Full cost breakdown by service and team",
      "Security misconfiguration report",
      "Performance & latency analysis",
      "Prioritised remediation roadmap",
      "90-day follow-up check",
    ],
    cta: "Book an audit",
  },
  {
    id: "architecture-review",
    slug: "architecture-review",
    name: "Architecture Review",
    description:
      "Expert evaluation of your system design against AWS Well-Architected Framework pillars: reliability, security, performance, and cost.",
    price: "From €2,000",
    category: "consulting",
    icon: "🏗️",
    features: [
      "Well-Architected Framework assessment",
      "Scalability & reliability analysis",
      "Disaster recovery evaluation",
      "Written recommendations report",
      "60-min debrief call",
    ],
    cta: "Request a review",
  },
  {
    id: "serverless-migration",
    slug: "serverless-migration",
    name: "Serverless Migration",
    description:
      "End-to-end migration from VMs or containers to serverless architecture, with zero-downtime cutover and full monitoring from day one.",
    price: "From €5,000",
    category: "devops",
    icon: "⚡",
    features: [
      "Strangler-fig or big-bang migration strategy",
      "Lambda + API Gateway + EventBridge wiring",
      "CI/CD pipeline setup (GitHub Actions / CodePipeline)",
      "Observability from day one (CloudWatch / Sentry)",
      "Knowledge transfer & runbook",
    ],
    cta: "Start a migration",
  },
  {
    id: "monthly-retainer",
    slug: "monthly-retainer",
    name: "Monthly Retainer",
    description:
      "A senior AWS-certified cloud architect on your team — available for design reviews, incident response, and ongoing cost optimisation.",
    price: "€1,500/mo",
    category: "consulting",
    icon: "🤝",
    features: [
      "Up to 20 hours/month cloud architecture support",
      "Unlimited async questions (email / Slack)",
      "Monthly infrastructure review",
      "On-call incident support",
      "Cancel any time",
    ],
    cta: "Start a retainer",
  },
];

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

/**
 * Fetch all published services, sorted by display order ascending.
 * Falls back to staticServices when Notion is not configured.
 */
export async function getServices(): Promise<CloudlessService[]> {
  const configured = await isConfiguredAsync(
    "NOTION_API_KEY",
    "NOTION_SERVICES_DB_ID",
  );
  if (!configured) return staticServices;

  return cached("services:all", async () => {
    const { NOTION_SERVICES_DB_ID } = await getIntegrationsAsync();
    try {
      const pages = await notionFetchAll(
        `/databases/${NOTION_SERVICES_DB_ID}/query`,
        {
          filter: { property: "Published", checkbox: { equals: true } },
          sorts: [{ property: "Order", direction: "ascending" }],
        },
      );
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
export async function getServiceBySlug(
  slug: string,
): Promise<CloudlessService | null> {
  const services = await getServices();
  return services.find((s) => s.slug === slug) ?? null;
}

/**
 * Fetch services filtered by category.
 */
export async function getServicesByCategory(
  category: ServiceCategory,
): Promise<CloudlessService[]> {
  const services = await getServices();
  return services.filter((s) => s.category === category);
}
