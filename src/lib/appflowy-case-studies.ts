/**
 * AppFlowy Case Studies CMS adapter (stub for testing).
 * This is a stub implementation to allow the Next.js dev server to start
 * when the real AppFlowy integration is not configured.
 */

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

// Static fallback data (reusing the same as notion for now)
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
// Public API (stub implementations)
// ---------------------------------------------------------------------------

/**
 * List ALL case studies (published + unpublished) for the admin panel.
 * @returns Promise resolving to an array of case studies (empty array in stub)
 */
export async function getAllCaseStudiesAdmin(): Promise<CaseStudy[]> {
  // In a real implementation, this would fetch from AppFlowy
  return [];
}

/**
 * Create a new case study.
 * @param input - Case study input
 * @returns Promise resolving to the created case study ID (null in stub)
 */
export async function createCaseStudy(input: Partial<CaseStudyInput>): Promise<string | null> {
  // In a real implementation, this would create a case study in AppFlowy
  return null;
}

/**
 * Update an existing case study.
 * @param pageId - The ID of the case study to update
 * @param input - Partial case study input
 * @returns Promise resolving to true if successful
 */
export async function updateCaseStudy(
  pageId: string,
  input: Partial<CaseStudyInput>
): Promise<boolean> {
  // In a real implementation, this would update the case study in AppFlowy
  return false;
}

/**
 * Archive (soft-delete) a case study.
 * @param pageId - The ID of the case study to archive
 * @returns Promise resolving to true if successful
 */
export async function deleteCaseStudy(pageId: string): Promise<boolean> {
  // In a real implementation, this would archive the case study in AppFlowy
  return false;
}

/**
 * Fetch all published case studies, sorted by date descending.
 * @returns Promise resolving to an array of published case studies (empty array in stub)
 */
export async function getCaseStudies(): Promise<CaseStudy[]> {
  // In a real implementation, this would fetch published case studies from AppFlowy
  return [];
}

/**
 * Fetch featured case studies (for homepage).
 * @returns Promise resolving to an array of featured case studies (empty array in stub)
 */
export async function getFeaturedCaseStudies(): Promise<CaseStudy[]> {
  // In a real implementation, this would filter getCaseStudies() by featured flag
  return (await getCaseStudies()).filter((c) => c.featured);
}

/**
 * Fetch a single case study by slug, with full rendered HTML content.
 * @param slug - The slug of the case study
 * @returns Promise resolving to the case study with content or null if not found
 */
export async function getCaseStudyBySlug(slug: string): Promise<CaseStudyWithContent | null> {
  // In a real implementation, this would fetch the case study by slug from AppFlowy
  return null;
}

/**
 * Get all published slugs (for sitemap / static generation).
 * @returns Promise resolving to an array of slugs (empty array in stub)
 */
export async function getAllCaseStudySlugs(): Promise<string[]> {
  // In a real implementation, this would get all published slugs from AppFlowy
  return [];
}