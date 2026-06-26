/**
 * postiz-blog — auto-post a blog post to connected social channels when its
 * Status flips to `Published`. Wired from `src/app/api/webhooks/content/route.ts`
 * on the `database=blog`, `type=page.updated` event.
 *
 * Opt-in: only fires when the env flag `AUTO_POST_BLOG_TO_SOCIAL=1` is set
 * (per the operator's preference — they want to vet copy before each
 * publish). When unset (default) this is a logged no-op so a blog edit
 * never accidentally fans out to social.
 *
 * Idempotency: builds a Postiz tag `blog-<pageId>` and checks the last 60
 * days of Postiz posts for that tag. If one exists, we skip (avoids
 * double-posting on a Status touch). Tag-based idempotency is preferable
 * to a DB column on the blog page since it survives blog-row deletes +
 * leaves a clean audit trail visible in Postiz UI.
 */
import {
  isPostizConfigured,
  listPosts,
  listPostizIntegrations,
  matchIntegrationsForPlatform,
  schedulePost,
} from "@/lib/postiz";

const TAG_PREFIX = "blog-";

export interface BlogShareInput {
  /** Notion page id of the blog row. Used as the idempotency tag. */
  pageId: string;
  title: string;
  excerpt: string;
  /** Canonical public URL of the published post. Used in the body. */
  url: string;
  /** Optional override of which platforms to publish on. Defaults to
   *  every connected platform across LinkedIn, X, Meta, TikTok. */
  platforms?: Array<"linkedin" | "x" | "meta" | "tiktok">;
}

export interface BlogShareResult {
  ok: boolean;
  /** Reason for a no-op so the caller can log it. */
  skipped?: "feature_off" | "postiz_unconfigured" | "no_channels" | "already_posted";
  postIds: string[];
  error?: string;
}

export async function scheduleBlogShare(input: BlogShareInput): Promise<BlogShareResult> {
  if (process.env.AUTO_POST_BLOG_TO_SOCIAL !== "1") {
    return { ok: true, skipped: "feature_off", postIds: [] };
  }
  if (!(await isPostizConfigured())) {
    return { ok: false, skipped: "postiz_unconfigured", postIds: [] };
  }

  // Idempotency — has this pageId already been posted in the last 60 days?
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const tag = `${TAG_PREFIX}${input.pageId}`;
  try {
    const existing = await listPosts(since, until);
    if (existing.some((p) => p.content?.includes(tag))) {
      return { ok: true, skipped: "already_posted", postIds: [] };
    }
  } catch {
    // Postiz list failed; better to risk a duplicate than to skip posting
    // when the operator opted in. Continue.
  }

  const integrations = await listPostizIntegrations();
  const platforms = input.platforms ?? ["linkedin", "x", "meta", "tiktok"];
  const integrationIds = new Set<string>();
  for (const p of platforms) {
    for (const i of matchIntegrationsForPlatform(integrations, p)) {
      integrationIds.add(i.id);
    }
  }
  if (integrationIds.size === 0) {
    return { ok: false, skipped: "no_channels", postIds: [] };
  }

  // The tag is invisible to most platforms (collapsed by Postiz's URL
  // shortener) but visible enough that `listPosts` filtering picks it up.
  const body = `${input.title}\n\n${input.excerpt}\n\n${input.url}\n\n${tag}`;
  const result = await schedulePost({
    content: body,
    integrationIds: Array.from(integrationIds),
    // Post immediately. If the operator wants a delay, they can switch this
    // to `scheduleAt: new Date(Date.now() + 30*60*1000).toISOString()`.
  });
  return { ok: result.ok, postIds: result.postIds, error: result.error };
}
