/**
 * AppFlowy Blog admin helpers — used by the Slack ops surface to list
 * drafts and flip the editorial status from Slack without opening AppFlowy.
 *
 * Kept separate from src/lib/appflowy-blog.ts (which serves the public
 * `/blog` frontend) so admin functionality cannot accidentally leak
 * through the public render path.
 *
 * All functions read AppFlowy config from SSM. They return [] / null on
 * any failure and log the error — never throw — so a transient AppFlowy
 * outage cannot 500 a Slack interaction handler.
 */

import {
  listAllWorkspaces,
  listAllViewsDeep,
  getDocument,
  extractDocText,
  isAppFlowyConfigured,
} from "./appflowy";

/** The four select values that exist on the AppFlowy Blog Document Status field. */
export type AppFlowyBlogStatus = "Draft" | "In Review" | "Published" | "Archived";

export interface AppFlowyBlogDraft {
  id: string;
  title: string;
  slug: string;
  status: AppFlowyBlogStatus | "";
  category: string;
  readTime: string;
  createdAt: string;
  /** Direct AppFlowy app URL — opens the page in the user's AppFlowy workspace. */
  url: string;
}

async function getPrimaryWorkspaceId(): Promise<string | null> {
  try {
    const workspaces = await listAllWorkspaces();
    return workspaces[0]?.workspace_id ?? null;
  } catch {
    return null;
  }
}

function parseBlogFields(text: string): AppFlowyBlogDraft {
  const fields: Record<string, string> = {};
  const lines = text.split("\n");
  for (const line of lines) {
    const match = line.match(/^\*\*([A-Za-z]+)\*\*:\s*(.+)$/);
    if (match) {
      fields[match[1]] = match[2];
    }
  }
  return {
    id: "",
    title: fields["Name"] || "",
    slug: fields["Slug"] || "",
    status: (fields["Status"] || "") as AppFlowyBlogStatus | "",
    category: fields["Category"] || "Cloud",
    readTime: fields["ReadTime"] || "5 min read",
    createdAt: fields["Date"] || new Date().toISOString(),
    url: "",
  };
}

function isEditorialPage(name: string): boolean {
  return /^\[Review\]\s/i.test(name) || /^\[Draft\]\s/i.test(name);
}

function getStatusFromName(name: string): AppFlowyBlogStatus | "" {
  if (/^\[Review\]\s/i.test(name)) return "In Review";
  if (/^\[Draft\]\s/i.test(name)) return "Draft";
  return "";
}

export async function listEditorialPosts(): Promise<AppFlowyBlogDraft[]> {
  try {
    if (!(await isAppFlowyConfigured())) {
      console.error("[appflowy-blog-admin] AppFlowy is not configured");
      return [];
    }

    const workspaceId = await getPrimaryWorkspaceId();
    if (!workspaceId) return [];

    const views = await listAllViewsDeep(workspaceId);
    const editorialViews = views.filter((v) => isEditorialPage(v.name));

    const drafts: AppFlowyBlogDraft[] = [];
    for (const view of editorialViews) {
      try {
        const doc = await getDocument(workspaceId, view.view_id);
        const text = await extractDocText(doc);
        const fields = parseBlogFields(text);
        const status = getStatusFromName(view.name) || (fields.status || "");
        drafts.push({
          id: view.view_id,
          title: fields.title || stripPrefix(view.name),
          slug: fields.slug || slugify(stripPrefix(view.name)),
          status,
          category: fields.category,
          readTime: fields.readTime,
          createdAt: fields.createdAt || view.last_edited_time,
          url: "", // AppFlowy doesn't have public URLs like Notion
        });
      } catch (err) {
        console.warn("[appflowy-blog-admin] Failed to parse editorial post:", err);
      }
    }

    // Sort newest first
    return drafts.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err) {
    console.error("[appflowy-blog-admin] listEditorialPosts error:", err);
    return [];
  }
}

function stripPrefix(name: string): string {
  return name
    .replace(/^\[Blog\]\s*/i, "")
    .replace(/^\[Review\]\s*/i, "")
    .replace(/^\[Draft\]\s*/i, "")
    .trim();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Resolve an AppFlowy page either by its view_id or by its blog Slug.
 * Returns null when nothing matches.
 */
export async function findEditorialPost(idOrSlug: string): Promise<AppFlowyBlogDraft | null> {
  const trimmed = idOrSlug.trim();
  if (!trimmed) return null;

  try {
    if (!(await isAppFlowyConfigured())) return null;

    const workspaceId = await getPrimaryWorkspaceId();
    if (!workspaceId) return null;

    const views = await listAllViewsDeep(workspaceId);

    // Try to find by view_id first
    let view = views.find((v) => v.view_id === trimmed);
    if (view && isEditorialPage(view.name)) {
      const doc = await getDocument(workspaceId, view.view_id);
      const text = await extractDocText(doc);
      const fields = parseBlogFields(text);
      return {
        id: view.view_id,
        title: fields.title || stripPrefix(view.name),
        slug: fields.slug || slugify(stripPrefix(view.name)),
        status: getStatusFromName(view.name) || (fields.status || ""),
        category: fields.category,
        readTime: fields.readTime,
        createdAt: fields.createdAt || view.last_edited_time,
        url: "",
      };
    }

    // Slug lookup
    view = views.find(
      (v) => isEditorialPage(v.name) && slugify(stripPrefix(v.name)) === trimmed
    );
    if (view) {
      const doc = await getDocument(workspaceId, view.view_id);
      const text = await extractDocText(doc);
      const fields = parseBlogFields(text);
      return {
        id: view.view_id,
        title: fields.title || stripPrefix(view.name),
        slug: fields.slug || slugify(stripPrefix(view.name)),
        status: getStatusFromName(view.name) || (fields.status || ""),
        category: fields.category,
        readTime: fields.readTime,
        createdAt: fields.createdAt || view.last_edited_time,
        url: "",
      };
    }

    return null;
  } catch (err) {
    console.error("[appflowy-blog-admin] findEditorialPost error:", err);
    return null;
  }
}

/**
 * Flip the Status on an AppFlowy Blog Document.
 * Used by the Slack /cloudless-newsletter send flow to move a Draft into In Review
 * before triggering the publisher workflow.
 *
 * Returns true on success, false on failure (logged).
 * Note: Requires AppFlowy write API support.
 */
export async function setEditorialStatus(
  pageId: string,
  status: AppFlowyBlogStatus
): Promise<boolean> {
  try {
    if (!(await isAppFlowyConfigured())) return false;

    // AppFlowy write API not yet implemented in appflowy.ts
    // This would update the document's Status field
    console.log("[appflowy-blog-admin] Would update status for", pageId, "to", status);
    return false;
  } catch (err) {
    console.error("[appflowy-blog-admin] setEditorialStatus error:", err);
    return false;
  }
}