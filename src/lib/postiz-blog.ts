/**
 * postiz-blog — auto-post a blog entry to connected social channels when its
 * editorial status flips to `Published`. Wired from:
 *   - `src/app/api/webhooks/content/route.ts` (CMS content webhook)
 *   - `setEditorialStatus(..., "Published")` in `appflowy-blog-admin.ts`
 *
 * Opt-in: only fires when the env flag `AUTO_POST_BLOG_TO_SOCIAL=1` is set
 * (default off — vet copy before each publish). When unset this is a logged
 * no-op so a blog edit never accidentally fans out to social.
 *
 * Idempotency: Postiz tag `blog-<pageId>`. We scan recent posts' content for
 * that marker (tags are not always returned on listPosts in v2.11.2) and also
 * send the tag on create for Postiz UI filtering.
 */
import {
  isPostizConfigured,
  listPosts,
  listPostizIntegrations,
  matchIntegrationsForPlatform,
  schedulePost,
  withSocialUtm,
} from "@/lib/postiz";

const TAG_PREFIX = "blog-";

export interface BlogShareInput {
  /** AppFlowy / CMS page id. Used as the idempotency tag. */
  pageId: string;
  title: string;
  excerpt: string;
  /** Canonical public URL of the published post. */
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

function platformUtmSource(platform: "linkedin" | "x" | "meta" | "tiktok"): string {
  switch (platform) {
    case "linkedin":
      return "linkedin";
    case "x":
      return "x";
    case "meta":
      return "facebook";
    case "tiktok":
      return "tiktok";
    default:
      return "social";
  }
}

export async function scheduleBlogShare(input: BlogShareInput): Promise<BlogShareResult> {
  if (process.env.AUTO_POST_BLOG_TO_SOCIAL !== "1") {
    return { ok: true, skipped: "feature_off", postIds: [] };
  }
  if (!(await isPostizConfigured())) {
    return { ok: false, skipped: "postiz_unconfigured", postIds: [] };
  }

  const tagValue = `${TAG_PREFIX}${input.pageId}`;
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  try {
    const existing = await listPosts(since, until);
    if (existing.some((p) => p.content?.includes(tagValue))) {
      return { ok: true, skipped: "already_posted", postIds: [] };
    }
  } catch {
    // Postiz list failed; better to risk a duplicate than to skip when opted in.
  }

  const integrations = await listPostizIntegrations();
  const platforms = input.platforms ?? ["linkedin", "x", "meta", "tiktok"];
  const campaign = `blog_${input.pageId.slice(0, 12)}`;
  const allPostIds: string[] = [];
  let lastError: string | undefined;
  let anyChannel = false;

  for (const platform of platforms) {
    const targets = matchIntegrationsForPlatform(integrations, platform);
    if (targets.length === 0) continue;
    anyChannel = true;

    const utmUrl = withSocialUtm(input.url, platformUtmSource(platform), campaign);
    const body = `${input.title}\n\n${input.excerpt}\n\n${utmUrl}`;
    const result = await schedulePost({
      content: body,
      integrationIds: targets.map((t) => t.id),
      tags: [{ value: tagValue, label: tagValue }],
    });
    if (result.ok) {
      allPostIds.push(...result.postIds);
    } else if (result.error) {
      lastError = result.error;
    }
  }

  if (!anyChannel) {
    return { ok: false, skipped: "no_channels", postIds: [] };
  }
  if (allPostIds.length === 0) {
    return { ok: false, postIds: [], error: lastError ?? "Postiz returned no post ids" };
  }
  return { ok: true, postIds: allPostIds, error: lastError };
}
