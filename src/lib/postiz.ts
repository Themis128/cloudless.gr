import { getConfig } from "@/lib/ssm-config";
import type { CalendarPlatform } from "@/lib/content-calendar";

/**
 * Postiz — self-hosted social publishing engine (Public API v1).
 *
 * Postiz owns the platform OAuth connections (Facebook, Instagram, LinkedIn,
 * X, TikTok, …); this module is the bridge that turns content-calendar
 * `social_post` items into scheduled posts on the connected channels.
 *
 * Config (SSM or env):
 *   POSTIZ_API_URL — base URL of the Postiz instance, e.g. https://postiz.cloudless.gr
 *   POSTIZ_API_KEY — API key from Postiz Settings → API
 *
 * All functions are silent no-ops / empty results when unconfigured so the
 * calendar UI stays usable before Postiz is deployed (see docs/POSTIZ.md).
 */

async function getPostizConfig(): Promise<{ baseUrl: string; apiKey: string }> {
  const cfg = await getConfig();
  if (!cfg.POSTIZ_API_URL || !cfg.POSTIZ_API_KEY) throw new Error("Postiz not configured");
  return {
    baseUrl: cfg.POSTIZ_API_URL.replace(/\/$/, ""),
    apiKey: cfg.POSTIZ_API_KEY,
  };
}

async function postizFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { baseUrl, apiKey } = await getPostizConfig();
  return fetch(`${baseUrl}/api/public/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
      ...options.headers,
    },
    signal: AbortSignal.timeout(10_000),
  });
}

export async function isPostizConfigured(): Promise<boolean> {
  try {
    await getPostizConfig();
    return true;
  } catch {
    return false;
  }
}

export interface PostizIntegration {
  id: string;
  name: string;
  /** Platform identifier, e.g. "facebook", "instagram", "linkedin", "x", "tiktok". */
  identifier: string;
  picture?: string;
  disabled?: boolean;
}

/** Channels connected inside Postiz. Empty array when unreachable/unconfigured. */
export async function listPostizIntegrations(): Promise<PostizIntegration[]> {
  try {
    const res = await postizFetch("/integrations");
    if (!res.ok) {
      console.error("[Postiz] integrations request failed:", res.status);
      return [];
    }
    const data = (await res.json()) as PostizIntegration[] | { integrations?: PostizIntegration[] };
    return Array.isArray(data) ? data : (data.integrations ?? []);
  } catch (err) {
    console.error("[Postiz] integrations error:", err);
    return [];
  }
}

/** Calendar platform → Postiz integration identifiers it should publish to. */
export const PLATFORM_TO_POSTIZ_IDENTIFIERS: Partial<Record<CalendarPlatform, string[]>> = {
  meta: ["facebook", "instagram"],
  linkedin: ["linkedin", "linkedin-page"],
  tiktok: ["tiktok"],
  x: ["x"],
};

/** Resolve the connected Postiz channels matching a calendar platform. */
export function matchIntegrationsForPlatform(
  integrations: PostizIntegration[],
  platform: CalendarPlatform
): PostizIntegration[] {
  const identifiers = PLATFORM_TO_POSTIZ_IDENTIFIERS[platform];
  if (!identifiers) return [];
  return integrations.filter((i) => !i.disabled && identifiers.includes(i.identifier));
}

export interface SchedulePostInput {
  content: string;
  integrationIds: string[];
  /** ISO timestamp. Posts immediately when omitted or in the past. */
  scheduleAt?: string;
  asDraft?: boolean;
}

export interface SchedulePostResult {
  ok: boolean;
  /** Postiz post IDs, one per channel. */
  postIds: string[];
  error?: string;
}

/** Create a scheduled (or immediate/draft) post on the given Postiz channels. */
export async function schedulePost(input: SchedulePostInput): Promise<SchedulePostResult> {
  if (input.integrationIds.length === 0) {
    return { ok: false, postIds: [], error: "No matching Postiz channels connected." };
  }
  if (!input.content.trim()) {
    return { ok: false, postIds: [], error: "Post content is empty." };
  }

  const now = Date.now();
  const scheduleTime = input.scheduleAt ? new Date(input.scheduleAt).getTime() : now;
  let type: "draft" | "schedule" | "now";
  if (input.asDraft) {
    type = "draft";
  } else {
    type = Number.isNaN(scheduleTime) || scheduleTime <= now ? "now" : "schedule";
  }

  try {
    const res = await postizFetch("/posts", {
      method: "POST",
      body: JSON.stringify({
        type,
        date: new Date(Number.isNaN(scheduleTime) ? now : scheduleTime).toISOString(),
        shortLink: false,
        tags: [],
        posts: input.integrationIds.map((id) => ({
          integration: { id },
          value: [{ content: input.content }],
        })),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[Postiz] post create failed:", res.status, body.slice(0, 300));
      return { ok: false, postIds: [], error: `Postiz returned ${res.status}` };
    }
    const data = (await res.json()) as Array<{ id?: string; postId?: string }> | { id?: string };
    const postIds = Array.isArray(data)
      ? data.map((p) => p.id ?? p.postId ?? "").filter(Boolean)
      : [data.id ?? ""].filter(Boolean);
    return { ok: true, postIds };
  } catch (err) {
    console.error("[Postiz] post create error:", err);
    return { ok: false, postIds: [], error: "Postiz request failed." };
  }
}
