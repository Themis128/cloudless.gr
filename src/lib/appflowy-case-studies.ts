/**
 * AppFlowy Case Studies CMS adapter.
 *
 * Page naming: [CaseStudy] <title>
 * Optional markdown body key/value lines + freeform sections.
 */

import {
  listAllWorkspaces,
  listAllViewsDeep,
  getDocument,
  extractDocText,
  markdownToHtml,
  isAppFlowyConfigured,
} from "./appflowy";
import {
  staticCaseStudies,
  type CaseStudy,
  type CaseStudyMetric,
  type CaseStudyWithContent,
  type CaseStudyInput,
} from "./notion-case-studies";

// Re-export types from Notion adapter (single source of truth)
export type {
  CaseStudy,
  CaseStudyWithContent,
  CaseStudyMetric,
  CaseStudyInput,
} from "./notion-case-studies";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripPrefix(name: string): string {
  return name.replace(/^\[CaseStudy\]\s*/i, "").trim();
}

function isCaseStudyPage(name: string): boolean {
  return /^\[CaseStudy\]\s/i.test(name);
}

function parseField(markdown: string, key: string): string {
  const re = new RegExp("\\*\\*" + key + "\\*\\*:\\s*(.+)", "i");
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

function mapMarkdownToCaseStudy(
  viewId: string,
  title: string,
  markdown: string,
  lastEdited: string
): CaseStudy {
  const servicesRaw = parseField(markdown, "Services");
  const tagsRaw = parseField(markdown, "Tags");
  const featuredRaw = parseField(markdown, "Featured").toLowerCase();
  const metrics: CaseStudyMetric[] = [];
  for (let i = 1; i <= 3; i++) {
    const label = parseField(markdown, "Metric" + i + "Label");
    const value = parseField(markdown, "Metric" + i + "Value");
    if (label && value) metrics.push({ label, value });
  }

  return {
    id: viewId,
    slug: parseField(markdown, "Slug") || slugify(title),
    title,
    client: parseField(markdown, "Client") || "",
    industry: parseField(markdown, "Industry") || "General",
    services: servicesRaw
      ? servicesRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    summary: parseField(markdown, "Summary") || "",
    challenge: parseField(markdown, "Challenge") || "",
    solution: parseField(markdown, "Solution") || "",
    results: parseField(markdown, "Results") || "",
    metrics,
    coverImage: parseField(markdown, "CoverImage") || undefined,
    tags: tagsRaw
      ? tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    featured: featuredRaw === "true" || featuredRaw === "yes" || featuredRaw === "✅",
    date: parseField(markdown, "Date") || lastEdited,
  };
}

export async function getCaseStudies(): Promise<CaseStudy[]> {
  if (!(await isAppFlowyConfigured())) return [];

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return [];

  try {
    const views = await listAllViewsDeep(workspaceId);
    const caseViews = views.filter((v) => isCaseStudyPage(v.name));
    const caseStudies: CaseStudy[] = [];

    for (const view of caseViews) {
      let markdown = "";
      try {
        const doc = await getDocument(workspaceId, view.view_id);
        markdown = await extractDocText(doc);
      } catch {
        markdown = "";
      }
      caseStudies.push(
        mapMarkdownToCaseStudy(
          view.view_id,
          stripPrefix(view.name),
          markdown,
          view.last_edited_time
        )
      );
    }

    return caseStudies.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
}

export async function getFeaturedCaseStudies(): Promise<CaseStudy[]> {
  const all = await getCaseStudies();
  return all.filter((c) => c.featured);
}

export async function getCaseStudyBySlug(slug: string): Promise<CaseStudyWithContent | null> {
  if (!(await isAppFlowyConfigured())) return null;

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return null;

  try {
    const views = await listAllViewsDeep(workspaceId);
    for (const view of views.filter((v) => isCaseStudyPage(v.name))) {
      let markdown = "";
      try {
        const doc = await getDocument(workspaceId, view.view_id);
        markdown = await extractDocText(doc);
      } catch {
        markdown = "";
      }
      const mapped = mapMarkdownToCaseStudy(
        view.view_id,
        stripPrefix(view.name),
        markdown,
        view.last_edited_time
      );
      if (mapped.slug === slug) {
        return { ...mapped, html: await markdownToHtml(markdown) };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * List ALL case studies for the admin panel (published + unpublished).
 * Mirrors the Notion getAllCaseStudiesAdmin function.
 */
export async function getAllCaseStudiesAdmin(): Promise<CaseStudy[]> {
  if (!(await isAppFlowyConfigured())) return staticCaseStudies;

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return [];

  try {
    const views = await listAllViewsDeep(workspaceId);
    const caseViews = views.filter((v) => isCaseStudyPage(v.name));
    const caseStudies: CaseStudy[] = [];

    for (const view of caseViews) {
      let markdown = "";
      try {
        const doc = await getDocument(workspaceId, view.view_id);
        markdown = await extractDocText(doc);
      } catch {
        markdown = "";
      }
      caseStudies.push(
        mapMarkdownToCaseStudy(
          view.view_id,
          stripPrefix(view.name),
          markdown,
          view.last_edited_time
        )
      );
    }

    return caseStudies.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return staticCaseStudies;
  }
}

export { staticCaseStudies };
