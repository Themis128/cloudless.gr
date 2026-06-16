import { getConfig } from "@/lib/ssm-config";
import type { CalendarPlatform } from "@/lib/content-calendar";

/**
 * Postiz — self-hosted social publishing engine (Public API v1).
 *
 * Postiz owns the platform OAuth connections (Facebook, Instagram, LinkedIn,
 * X, TikTok, …); this module is the bridge that turns content-calendar
 * `social_post` items into scheduled posts on the connected channels, and
 * powers the /admin/postiz console.
 *
 * Config (SSM or env):
 *   POSTIZ_API_URL — base URL of the Postiz instance, e.g. https://postiz.cloudless.gr
 *   POSTIZ_API_KEY — API key from Postiz Settings → Public API
 *
 * Two flavours of helpers live here:
 *
 * 1. Calendar-side (existing): `isPostizConfigured`, `listPostizIntegrations`,
 *    `schedulePost` — silent no-ops / `{ ok: false }` when unconfigured so the
 *    calendar UI stays usable.
 *
 * 2. Admin-console (added 2026-06-15): `PostizApiError`,
 *    `PostizNotConfiguredError`, `createPost`, `listPosts`, `deletePost`,
 *    `uploadFromUrl`, `findSlot` — throw typed errors so the /admin/postiz
 *    route handlers can distinguish "not configured" (503) from "upstream
 *    failure" (502) from real bugs.
 *
 * Both share the same `postizFetch` / `getPostizConfig` plumbing.
 */

async function getPostizConfig(): Promise<{ baseUrl: string; apiKey: string }> {
  const cfg = await getConfig();
  if (!cfg.POSTIZ_API_URL || !cfg.POSTIZ_API_KEY) throw new PostizNotConfiguredError();
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

// --- Typed errors used by the admin console -------------------------------

export class PostizNotConfiguredError extends Error {
  constructor() {
    super("Postiz API key not configured");
    this.name = "PostizNotConfiguredError";
  }
}

export class PostizApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`Postiz API error ${status}: ${body.slice(0, 200)}`);
    this.name = "PostizApiError";
  }
}

async function callThrowing<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await postizFetch(path, init);
  if (!res.ok) throw new PostizApiError(res.status, await res.text().catch(() => ""));
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return undefined as T;
  return (await res.json()) as T;
}

// --- Calendar-side surface (preserved) -----------------------------------

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
          // `image` must always be present as an array — the live Postiz
          // v2.11.2 validator rejects value items without it
          // ("posts.0.value.0.image must be an array", verified 2026-06-12).
          value: [{ content: input.content, image: [] }],
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

// --- Admin-console surface (added 2026-06-15) ----------------------------

export interface PostizPost {
  id: string;
  content: string;
  publishDate: string;
  releaseURL?: string | null;
  releaseId?: string | null;
  state: "QUEUE" | "PUBLISHED" | "ERROR" | "DRAFT";
  integration: { id: string; name: string; identifier: string };
}

export interface CreatePostBody {
  type: "now" | "schedule" | "draft";
  date: string; // ISO 8601
  shortLink: boolean;
  tags: Array<{ value: string; label: string }>;
  posts: Array<{
    integration: { id: string };
    value: Array<{ content: string; image?: Array<{ id: string; path: string }> }>;
    settings: { __type: string } & Record<string, unknown>;
  }>;
}

export interface UploadedFile {
  id: string;
  path: string;
}

/** Throwing variant of `listPostizIntegrations` for /admin/postiz routes. */
export function listIntegrations(): Promise<PostizIntegration[]> {
  return callThrowing<PostizIntegration[]>("/integrations");
}

/** List posts in a window (ISO 8601 dates). */
export function listPosts(startDate: string, endDate: string): Promise<PostizPost[]> {
  const qs = new URLSearchParams({ startDate, endDate });
  return callThrowing<PostizPost[]>(`/posts?${qs.toString()}`);
}

/** Full create-post — exposes the entire Postiz schema. Throws on non-OK. */
export function createPost(
  body: CreatePostBody
): Promise<Array<{ postId: string; integration: string }>> {
  return callThrowing<Array<{ postId: string; integration: string }>>("/posts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Delete a post. Swallows 404 ("already deleted") per Postiz docs. */
export async function deletePost(id: string): Promise<void> {
  try {
    await callThrowing<void>(`/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (err) {
    if (err instanceof PostizApiError && err.status === 404) return;
    throw err;
  }
}

/** Upload media to Postiz by URL — returns an `{id,path}` usable in posts. */
export function uploadFromUrl(url: string): Promise<UploadedFile> {
  return callThrowing<UploadedFile>("/upload-from-url", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

/** Ask Postiz for the next available time slot on a channel. */
export function findSlot(integrationId: string): Promise<{ date: string }> {
  const qs = new URLSearchParams({ id: integrationId });
  return callThrowing<{ date: string }>(`/integrations/find-slot?${qs.toString()}`);
}
