/**
 * AppFlowy Blog admin helpers — used by the Slack ops surface to list
 * drafts and flip the editorial status from Slack without opening AppFlowy.
 *
 * Kept separate from src/lib/appflowy-blog.ts (which serves the public
 * `/blog` frontend) so admin functionality cannot accidentally leak
 * through the public render path.
 *
 * Editorial state is encoded in the page name prefix:
 *   [Draft] / [Review] / [Archived] / bare title = Published
 *
 * All functions read AppFlowy config from SSM/env. They return [] / null on
 * any failure and log the error — never throw — so a transient AppFlowy
 * outage cannot 500 a Slack interaction handler.
 */

import {
  listAllWorkspaces,
  listAllViewsDeep,
  getDocument,
  extractDocText,
  isAppFlowyConfigured,
  updateViewName,
} from "./appflowy";

/** Editorial statuses used by the 3-layer newsletter Slack ops surface. */
export type AppFlowyBlogStatus = "Draft" | "In Review" | "Published" | "Archived";

export interface AppFlowyBlogDraft {
  id: string;
  title: string;
  slug: string;
  status: AppFlowyBlogStatus | "";
  category: string;
  readTime: string;
  createdAt: string;
  /** Public blog URL when slug is known; Slack Block Kit link target. */
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
  return /^\[(Review|Draft|Archived)\]\s/i.test(name);
}

function getStatusFromName(name: string): AppFlowyBlogStatus | "" {
  if (/^\[Review\]\s/i.test(name)) return "In Review";
  if (/^\[Draft\]\s/i.test(name)) return "Draft";
  if (/^\[Archived\]\s/i.test(name)) return "Archived";
  return "";
}

function publicBlogUrl(slug: string): string {
  return slug ? `https://cloudless.gr/en/blog/${slug}` : "";
}

function toDraft(
  viewId: string,
  viewName: string,
  fields: AppFlowyBlogDraft,
  lastEdited: string
): AppFlowyBlogDraft {
  const title = fields.title || stripPrefix(viewName);
  const slug = fields.slug || slugify(title);
  const status = getStatusFromName(viewName) || fields.status || "";
  return {
    id: viewId,
    title,
    slug,
    status,
    category: fields.category || "Cloud",
    readTime: fields.readTime || "5 min read",
    createdAt: fields.createdAt || lastEdited,
    url: publicBlogUrl(slug),
  };
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
        drafts.push(toDraft(view.view_id, view.name, fields, view.last_edited_time));
      } catch (err) {
        console.warn("[appflowy-blog-admin] Failed to parse editorial post:", err);
      }
    }

    return drafts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
    .replace(/^\[Archived\]\s*/i, "")
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

    let view = views.find((v) => v.view_id === trimmed);
    if (view && isEditorialPage(view.name)) {
      const doc = await getDocument(workspaceId, view.view_id);
      const text = await extractDocText(doc);
      return toDraft(view.view_id, view.name, parseBlogFields(text), view.last_edited_time);
    }

    for (const v of views.filter((x) => isEditorialPage(x.name))) {
      try {
        const doc = await getDocument(workspaceId, v.view_id);
        const text = await extractDocText(doc);
        const draft = toDraft(v.view_id, v.name, parseBlogFields(text), v.last_edited_time);
        if (
          draft.slug === trimmed ||
          slugify(draft.title) === trimmed ||
          slugify(stripPrefix(v.name)) === trimmed
        ) {
          return draft;
        }
      } catch {
        /* skip unreadable */
      }
    }

    return null;
  } catch (err) {
    console.error("[appflowy-blog-admin] findEditorialPost error:", err);
    return null;
  }
}

function statusToName(title: string, status: AppFlowyBlogStatus): string {
  const clean = stripPrefix(title);
  switch (status) {
    case "Draft":
      return `[Draft] ${clean}`;
    case "In Review":
      return `[Review] ${clean}`;
    case "Archived":
      return `[Archived] ${clean}`;
    case "Published":
      return clean;
    default:
      return clean;
  }
}

/**
 * Flip editorial status by renaming the AppFlowy page prefix
 * ([Draft] / [Review] / [Archived] / bare title = Published).
 */
export async function setEditorialStatus(
  pageId: string,
  status: AppFlowyBlogStatus
): Promise<boolean> {
  try {
    if (!(await isAppFlowyConfigured())) return false;

    const workspaceId = await getPrimaryWorkspaceId();
    if (!workspaceId) return false;

    const views = await listAllViewsDeep(workspaceId);
    const view = views.find((v) => v.view_id === pageId);
    if (!view) {
      console.error("[appflowy-blog-admin] setEditorialStatus: view not found", pageId);
      return false;
    }

    const newName = statusToName(view.name, status);
    const ok = await updateViewName(workspaceId, pageId, newName);
    if (!ok) {
      console.error("[appflowy-blog-admin] setEditorialStatus rename failed", pageId, status);
      return false;
    }

    // Mirror the content-webhook path: Published → optional Postiz share.
    // Fire-and-forget so Slack/admin status flips stay fast; gated by
    // AUTO_POST_BLOG_TO_SOCIAL inside scheduleBlogShare.
    if (status === "Published") {
      triggerBlogSocialShare(workspaceId, pageId, view.name).catch((err) =>
        console.error("[appflowy-blog-admin] postiz share threw:", err)
      );
    }
    return true;
  } catch (err) {
    console.error("[appflowy-blog-admin] setEditorialStatus error:", err);
    return false;
  }
}

/** Load title/excerpt/slug from the AppFlowy doc and queue a social share. */
async function triggerBlogSocialShare(
  workspaceId: string,
  pageId: string,
  viewName: string
): Promise<void> {
  let title = stripPrefix(viewName);
  let excerpt = "";
  let slug = "";
  try {
    const doc = await getDocument(workspaceId, pageId);
    const text = doc ? await extractDocText(doc) : "";
    const fields = parseBlogFields(text);
    title = fields.title || title;
    excerpt = fields.category ? `${fields.category} · ${fields.readTime}` : "";
    slug = fields.slug || slugify(title);
  } catch (err) {
    console.error("[appflowy-blog-admin] triggerBlogSocialShare doc read failed:", err);
  }

  const { scheduleBlogShare } = await import("@/lib/postiz-blog");
  const baseUrl = process.env.SITE_URL ?? "https://cloudless.gr";
  const url = slug ? `${baseUrl}/en/blog/${slug}` : `${baseUrl}/en/blog`;
  const result = await scheduleBlogShare({ pageId, title, excerpt, url });
  if (result.skipped) {
    console.warn(`[appflowy-blog-admin → postiz] skipped: ${result.skipped}`);
  } else if (result.ok) {
    console.warn(`[appflowy-blog-admin → postiz] posted ${result.postIds.length} channel(s)`);
  } else {
    console.error(`[appflowy-blog-admin → postiz] failed: ${result.error}`);
  }

  const n8nBase = process.env.N8N_INTERNAL_URL ?? "http://n8n.n8n.svc.cluster.local:5678";
  globalThis.fetch(`${n8nBase}/webhook/postiz-ai-multicaption`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, url, locale: "en" }),
    signal: AbortSignal.timeout(10_000),
  }).catch((err) => console.error("[appflowy-blog-admin → n8n ai-multicaption]", err));
}
