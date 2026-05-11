/**
 * Notion Case Studies CMS adapter.
 *
 * Expected Notion database schema (NOTION_CASE_STUDIES_DB_ID):
 * ┌──────────────┬───────────────────────────────────────────────────┐
 * │ Column       │ Type                                              │
 * ├──────────────┼───────────────────────────────────────────────────┤
 * │ Title        │ Title                                             │
 * │ Slug         │ Rich text (URL-safe)                              │
 * │ Client       │ Rich text                                         │
 * │ Industry     │ Select                                            │
 * │ Services     │ Multi-select                                      │
 * │ Summary      │ Rich text (1–2 sentence teaser)                   │
 * │ Challenge    │ Rich text                                         │
 * │ Solution     │ Rich text                                         │
 * │ Results      │ Rich text (outcomes paragraph)                    │
 * │ Metric1Label │ Rich text (e.g. "Cost reduction")                 │
 * │ Metric1Value │ Rich text (e.g. "55%")                            │
 * │ Metric2Label │ Rich text                                         │
 * │ Metric2Value │ Rich text                                         │
 * │ Metric3Label │ Rich text                                         │
 * │ Metric3Value │ Rich text                                         │
 * │ CoverImage   │ URL (absolute)                                    │
 * │ Tags         │ Multi-select                                      │
 * │ Published    │ Checkbox                                          │
 * │ Featured     │ Checkbox                                          │
 * │ Date         │ Date                                              │
 * └──────────────┴───────────────────────────────────────────────────┘
 */

import {
  notionFetchAll,
  fetchBlocksDeep,
  blocksToHtml,
  extractText,
  notionImageProxyUrl,
} from "@/lib/notion";
import {
  getIntegrationsAsync,
  requireIntegrationAsync,
} from "@/lib/integrations";
import { cached } from "@/lib/notion-cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CaseStudyMetric {
  label: string;
  value: string;
}

export interface CaseStudy {
  id: string;
  slug: string;
  title: string;
  client: string;
  industry: string;
  services: string[];
  summary: string;
  challenge: string;
  solution: string;
  results: string;
  metrics: CaseStudyMetric[];
  coverImage?: string;
  tags: string[];
  featured: boolean;
  date: string;
}

export interface CaseStudyWithContent extends CaseStudy {
  html: string;
}

// ---------------------------------------------------------------------------
// Static fallback
// ---------------------------------------------------------------------------

export const staticCaseStudies: CaseStudy[] = [
  {
    id: "cs1",
    slug: "techflow-aws-cost-reduction",
    title: "55% AWS Cost Reduction for a SaaS Startup",
    client: "TechFlow Athens",
    industry: "SaaS",
    services: ["Cloud Audit", "Cost Optimization"],
    summary:
      "Cloudless identified over-provisioned resources and redesigned the data pipeline architecture, cutting AWS spend by 55% in 30 days.",
    challenge:
      "TechFlow was spending €8,000/month on AWS with no clear understanding of where the money was going. Engineers had accumulated EC2 instances, over-sized RDS databases, and unused Elastic IPs over two years.",
    solution:
      "A full infrastructure audit mapped every resource to its cost. Right-sizing EC2 instances, migrating batch jobs to Lambda, and switching to Aurora Serverless v2 eliminated idle spend immediately.",
    results:
      "Monthly AWS bill dropped from €8,000 to €3,600 within 30 days. The team now has a cost dashboard and automated alerts for anomalies.",
    metrics: [
      { label: "Cost reduction", value: "55%" },
      { label: "Time to results", value: "30 days" },
      { label: "Monthly savings", value: "€4,400" },
    ],
    tags: ["AWS", "Cost optimization", "SaaS"],
    featured: true,
    date: "2026-03-01",
  },
  {
    id: "cs2",
    slug: "retail-plus-serverless-migration",
    title: "Monolith to Serverless in 6 Weeks",
    client: "Retail Plus",
    industry: "E-commerce",
    services: ["Architecture Migration", "DevOps"],
    summary:
      "A 4-year-old Django monolith was decomposed into serverless microservices with zero downtime, enabling 10× faster deployments.",
    challenge:
      "Retail Plus had outgrown their monolithic application. Each deployment took 45 minutes, required manual database migrations, and caused brief downtime during peak trading hours.",
    solution:
      "Critical business domains (orders, inventory, notifications) were extracted into Lambda functions behind API Gateway. A strangler-fig migration allowed the old and new systems to run in parallel during the transition.",
    results:
      "Deployment time fell from 45 minutes to under 4 minutes. Infrastructure cost dropped 40% due to pay-per-use Lambda pricing. Zero downtime migrations are now standard.",
    metrics: [
      { label: "Deploy time", value: "−90%" },
      { label: "Infrastructure cost", value: "−40%" },
      { label: "Migration duration", value: "6 weeks" },
    ],
    tags: ["Serverless", "Lambda", "Migration", "E-commerce"],
    featured: true,
    date: "2026-01-15",
  },
];

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapPage(page: any): CaseStudy {
  const p = page.properties ?? {};

  const metrics: CaseStudyMetric[] = [];
  for (let i = 1; i <= 3; i++) {
    const label = extractText(p[`Metric${i}Label`]?.rich_text);
    const value = extractText(p[`Metric${i}Value`]?.rich_text);
    if (label && value) metrics.push({ label, value });
  }

  return {
    id: page.id,
    slug: extractText(p.Slug?.rich_text) || page.id,
    title: extractText((p.Title ?? p.Name)?.title) || "",
    client: extractText(p.Client?.rich_text) || "",
    industry: p.Industry?.select?.name ?? "Technology",
    services: (p.Services?.multi_select ?? []).map((s: any) => s.name),
    summary: extractText(p.Summary?.rich_text) || "",
    challenge: extractText(p.Challenge?.rich_text) || "",
    solution: extractText(p.Solution?.rich_text) || "",
    results: extractText(p.Results?.rich_text) || "",
    metrics,
    coverImage:
      p.CoverImage?.url ??
      page.cover?.external?.url ??
      (page.cover?.type === "file"
        ? notionImageProxyUrl(page.id, "cover")
        : undefined),
    tags: (p.Tags?.multi_select ?? []).map((t: any) => t.name),
    featured: p.Featured?.checkbox ?? false,
    date: p.Date?.date?.start ?? page.created_time ?? "",
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all published case studies, sorted by date descending.
 */
export async function getCaseStudies(): Promise<CaseStudy[]> {
  await requireIntegrationAsync("NOTION_API_KEY", "NOTION_CASE_STUDIES_DB_ID");

  return cached("case-studies:all", async () => {
    const { NOTION_CASE_STUDIES_DB_ID } = await getIntegrationsAsync();
    try {
      const pages = await notionFetchAll(
        `/databases/${NOTION_CASE_STUDIES_DB_ID}/query`,
        {
          filter: { property: "Published", checkbox: { equals: true } },
          sorts: [{ property: "Date", direction: "descending" }],
        },
      );
      return pages.map(mapPage);
    } catch (err) {
      console.error("[Notion Case Studies] Failed to fetch:", err);
      return [];
    }
  });
}

/**
 * Fetch featured case studies (for homepage).
 */
export async function getFeaturedCaseStudies(): Promise<CaseStudy[]> {
  const all = await getCaseStudies();
  return all.filter((c) => c.featured);
}

/**
 * Fetch a single case study by slug, with full rendered HTML content.
 */
export async function getCaseStudyBySlug(
  slug: string,
): Promise<CaseStudyWithContent | null> {
  await requireIntegrationAsync("NOTION_API_KEY", "NOTION_CASE_STUDIES_DB_ID");

  const { NOTION_CASE_STUDIES_DB_ID } = await getIntegrationsAsync();
  try {
    const pages = await notionFetchAll(
      `/databases/${NOTION_CASE_STUDIES_DB_ID}/query`,
      {
        filter: {
          and: [
            { property: "Slug", rich_text: { equals: slug } },
            { property: "Published", checkbox: { equals: true } },
          ],
        },
      },
    );
    const page = pages[0];
    if (!page) return null;
    const cs = mapPage(page);
    const blocks = await fetchBlocksDeep(cs.id);
    const html = blocksToHtml(blocks);
    return { ...cs, html };
  } catch (err) {
    console.error("[Notion Case Studies] Failed to fetch by slug:", err);
    return null;
  }
}

/**
 * Get all published slugs (for sitemap / static generation).
 */
export async function getAllCaseStudySlugs(): Promise<string[]> {
  const all = await getCaseStudies();
  return all.map((c) => c.slug).filter(Boolean);
}
