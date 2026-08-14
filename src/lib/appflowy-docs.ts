/**
 * AppFlowy Docs CMS adapter.
 *
 * Reads docs from AppFlowy workspace Document pages.
 * Falls back to an empty result when AppFlowy is not configured.
 */

import {
  listAllWorkspaces,
  listAllViewsDeep,
  getDocument,
  extractDocText,
  markdownToHtml,
} from "./appflowy";
import { isAppFlowyConfigured } from "./appflowy";

export interface AppFlowyDocTocEntry {
  blockId: string;
  text: string;
  level: number;
}

export interface AppFlowyDocContentWithToc {
  html: string;
  toc: AppFlowyDocTocEntry[];
}

export interface AppFlowyDoc {
  verificationStatus: "Verified" | "Needs re-verification" | "Unverified";
  owner?: string;
  lastVerified?: string;
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  order: number;
  published: boolean;
  url: string;
  html?: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripDocPrefix(name: string): string {
  return name.replace(/^\[Docs\]\s*/i, "").trim();
}

function isDocPage(name: string): boolean {
  return /^\[Docs\]\s/i.test(name);
}

/**
 * Category from AppFlowy page name:
 * - `[Docs][Contracts] MSA` → Contracts / MSA
 * - `[Docs] Contracts / MSA` → Contracts / MSA
 * - `[Docs] Getting started` → General
 */
export function parseAppFlowyDocCategory(name: string): { title: string; category: string } {
  const stripped = stripDocPrefix(name);
  const bracket = stripped.match(/^\[([^\]]{1,80})\]\s+(.+)$/);
  if (bracket) {
    return { category: bracket[1].trim() || "General", title: bracket[2].trim() };
  }
  const slash = stripped.match(/^([^/]{1,80})\s*\/\s*(.+)$/);
  if (slash) {
    return { category: slash[1].trim() || "General", title: slash[2].trim() };
  }
  return { category: "General", title: stripped || name };
}

async function getPrimaryWorkspaceId(): Promise<string | null> {
  try {
    const workspaces = await listAllWorkspaces();
    return workspaces[0]?.workspace_id ?? null;
  } catch {
    return null;
  }
}

function mapViewToDoc(view: {
  view_id: string;
  name: string;
  last_edited_time: string;
}): Omit<AppFlowyDoc, "html"> {
  const { title, category } = parseAppFlowyDocCategory(view.name);
  return {
    id: view.view_id,
    slug: slugify(title),
    title,
    description: "",
    category,
    order: 0,
    published: isDocPage(view.name),
    verificationStatus: "Unverified",
    url: `/appflowy/view/${view.view_id}`,
  };
}

export async function getDocs(): Promise<AppFlowyDoc[]> {
  if (!(await isAppFlowyConfigured())) return [];

  const workspaceId = await getPrimaryWorkspaceId();
  if (!workspaceId) return [];

  try {
    const views = await listAllViewsDeep(workspaceId);
    const docViews = views.filter((v) => isDocPage(v.name));
    const docs: AppFlowyDoc[] = docViews.map(mapViewToDoc);
    return docs.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  } catch {
    return [];
  }
}

export async function getDocBySlug(slug: string): Promise<AppFlowyDoc | null> {
  const docs = await getDocs();
  return docs.find((d) => d.slug === slug) ?? null;
}

export async function searchDocs(query: string): Promise<AppFlowyDoc[]> {
  if (!query.trim()) return [];
  const docs = await getDocs();
  const q = query.toLowerCase();
  return docs.filter(
    (d) => d.title.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)
  );
}

export async function groupDocsByCategory(
  docs?: AppFlowyDoc[]
): Promise<Record<string, AppFlowyDoc[]>> {
  const all = docs ?? (await getDocs());
  return all.reduce<Record<string, AppFlowyDoc[]>>((acc, doc) => {
    const key = doc.category || "General";
    (acc[key] ??= []).push(doc);
    return acc;
  }, {});
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractTocFromMarkdown(markdown: string): AppFlowyDocTocEntry[] {
  const seen = new Map<string, number>();
  const toc: AppFlowyDocTocEntry[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;

    const level = match[1].length;
    const text = match[2]
      .replace(/[*_`~]/g, "")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .trim();

    if (!text) continue;

    const baseId = slugifyHeading(text) || "section";
    const count = seen.get(baseId) ?? 0;
    seen.set(baseId, count + 1);

    const blockId = count === 0 ? baseId : `${baseId}-${count + 1}`;

    toc.push({
      blockId,
      text,
      level,
    });
  }

  return toc;
}

export async function getDocContentWithToc(docId: string): Promise<AppFlowyDocContentWithToc> {
  const workspaceId = await getPrimaryWorkspaceId();

  if (!workspaceId) {
    return {
      html: "",
      toc: [],
    };
  }

  const document = await getDocument(workspaceId, docId);
  const markdown = await extractDocText(document);
  const html = await markdownToHtml(markdown);
  const toc = extractTocFromMarkdown(markdown);

  return {
    html,
    toc,
  };
}
