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

// Platform identifier constants — used in PLATFORM_TO_POSTIZ_IDENTIFIERS and
// defaultSettingsForIdentifier so the same literal isn't repeated 3+ times.
const POSTIZ_ID_LINKEDIN = "linkedin";
const POSTIZ_ID_LINKEDIN_PAGE = "linkedin-page";
const POSTIZ_ID_INSTAGRAM = "instagram";
const POSTIZ_ID_INSTAGRAM_STANDALONE = "instagram-standalone";
const POSTIZ_ID_TIKTOK = "tiktok";

// Cloudflare Access service tokens are an opaque (id, secret) pair — not JWTs.
// The pair can be provided one of two ways:
//   - two env vars (POSTIZ_CF_ACCESS_CLIENT_ID + POSTIZ_SERVICE_TOKEN)
//   - a single POSTIZ_SERVICE_TOKEN of the form "<client_id>:<client_secret>"
// Returns null when neither is set — callers then skip the Access headers.
function readCfAccessCreds(): { clientId: string; clientSecret: string } | null {
  const raw = process.env.POSTIZ_SERVICE_TOKEN;
  if (!raw) return null;
  const explicitId = process.env.POSTIZ_CF_ACCESS_CLIENT_ID;
  if (explicitId) return { clientId: explicitId, clientSecret: raw };
  const colon = raw.indexOf(":");
  if (colon > 0) return { clientId: raw.slice(0, colon), clientSecret: raw.slice(colon + 1) };
  return null;
}

async function getPostizConfig(): Promise<{ baseUrl: string; apiKey: string }> {
  const cfg = await getConfig();
  if (!cfg.POSTIZ_API_URL || !cfg.POSTIZ_API_KEY) throw new PostizNotConfiguredError();
  return {
    baseUrl: cfg.POSTIZ_API_URL.replace(/\/$/, ""),
    apiKey: cfg.POSTIZ_API_KEY,
  };
}

async function postizFetch(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { baseUrl, apiKey } = await getPostizConfig();
  const { timeoutMs, ...init } = options;

  // Build headers
  const headers = new Headers({
    "Content-Type": "application/json",
    Authorization: apiKey,
    ...init.headers,
  });

  // Add Cloudflare Access service-token headers if the credentials are configured.
  const cfCreds = readCfAccessCreds();
  if (cfCreds) {
    headers.set("Cf-Access-Client-Id", cfCreds.clientId);
    headers.set("Cf-Access-Client-Secret", cfCreds.clientSecret);
  }

  return fetch(`${baseUrl}/api/public/v1${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(timeoutMs ?? 10_000),
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

async function callThrowing<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
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

/** Channels connected inside Postiz. Empty array when unreachable/unconfigured.
 *
 *  When `groupId` is supplied, filters to channels assigned to that Postiz
 *  group (customer) — used to partition workspaces by Postiz `group.id`.
 *  Pass-through to the documented `?group=<id>` query param. */
export async function listPostizIntegrations(groupId?: string): Promise<PostizIntegration[]> {
  try {
    const path = groupId ? `/integrations?group=${encodeURIComponent(groupId)}` : "/integrations";
    const res = await postizFetch(path);
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
  meta: ["facebook", POSTIZ_ID_INSTAGRAM],
  linkedin: [POSTIZ_ID_LINKEDIN, POSTIZ_ID_LINKEDIN_PAGE],
  tiktok: [POSTIZ_ID_TIKTOK],
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
  /** Postiz tags (value+label). Used for idempotency / filtering. */
  tags?: Array<{ value: string; label: string }>;
}

export interface SchedulePostResult {
  ok: boolean;
  /** Postiz post IDs, one per channel. */
  postIds: string[];
  error?: string;
}

/**
 * Append standard cloudless social UTMs to a URL (or leave non-URLs alone).
 * Campaign defaults to `social_hub`; pass a stable slug for attribution.
 */
export function withSocialUtm(url: string, platform: string, campaign = "social_hub"): string {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    if (!u.searchParams.has("utm_source")) {
      u.searchParams.set("utm_source", platform || "social");
    }
    if (!u.searchParams.has("utm_medium")) {
      u.searchParams.set("utm_medium", "social");
    }
    if (!u.searchParams.has("utm_campaign")) {
      u.searchParams.set("utm_campaign", campaign);
    }
    return u.toString();
  } catch {
    return trimmed;
  }
}

/** Minimal settings object so Postiz validators accept the create-post body. */
function defaultSettingsForIdentifier(
  identifier: string
): { __type: string } & Record<string, unknown> {
  switch (identifier) {
    case "x":
      return { __type: "x", who_can_reply_post: "everyone" };
    case POSTIZ_ID_LINKEDIN:
      return { __type: POSTIZ_ID_LINKEDIN, post_as_images_carousel: false };
    case POSTIZ_ID_LINKEDIN_PAGE:
      return { __type: POSTIZ_ID_LINKEDIN_PAGE, post_as_images_carousel: false };
    case POSTIZ_ID_INSTAGRAM:
      return { __type: POSTIZ_ID_INSTAGRAM, post_type: "post" };
    case POSTIZ_ID_INSTAGRAM_STANDALONE:
      return { __type: POSTIZ_ID_INSTAGRAM_STANDALONE, post_type: "post" };
    case POSTIZ_ID_TIKTOK:
      return {
        __type: POSTIZ_ID_TIKTOK,
        privacy_level: "PUBLIC_TO_EVERYONE",
        duet: true,
        stitch: true,
        comment: true,
        autoAddMusic: "no",
        brand_content_toggle: false,
        brand_organic_toggle: false,
        content_posting_method: "DIRECT_POST",
      };
    default:
      return { __type: identifier || "x" };
  }
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

  const integrations = await listPostizIntegrations();
  const byId = new Map(integrations.map((i) => [i.id, i]));

  try {
    const res = await postizFetch("/posts", {
      method: "POST",
      body: JSON.stringify({
        type,
        date: new Date(Number.isNaN(scheduleTime) ? now : scheduleTime).toISOString(),
        shortLink: false,
        tags: input.tags ?? [],
        posts: input.integrationIds.map((id) => {
          const identifier = byId.get(id)?.identifier ?? "x";
          return {
            integration: { id },
            // `image` must always be present as an array — the live Postiz
            // v2.11.2 validator rejects value items without it
            // ("posts.0.value.0.image must be an array", verified 2026-06-12).
            value: [{ content: input.content, image: [] }],
            settings: defaultSettingsForIdentifier(identifier),
          };
        }),
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
  /**
   * Per docs.postiz.com the embedded integration field on a post uses
   * `providerIdentifier`, not `identifier`. Both names are present here for
   * backward-compat — old call sites still read `identifier`, and we
   * normalise via {@link postIdentifier} so neither path silently goes
   * `undefined` if Postiz changes either label.
   */
  integration: {
    id: string;
    name: string;
    providerIdentifier?: string;
    identifier?: string;
    picture?: string;
  };
}

/** Resolve the platform identifier from a Postiz post's embedded integration,
 *  tolerating both `providerIdentifier` (docs shape) and `identifier`
 *  (older shape used by `/integrations` and our internal types). */
export function postIdentifier(post: Pick<PostizPost, "integration">): string {
  return post.integration.providerIdentifier ?? post.integration.identifier ?? "";
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

/**
 * Postiz `MediaFile` shape returned by both /upload and /upload-from-url.
 * The earlier `thumbnail` / `alt` fields were speculative and aren't part of
 * the documented response. Confirmed against docs.postiz.com on 2026-06-16. */
export interface UploadedFile {
  id: string;
  name: string;
  /** Full URL to the uploaded media. */
  path: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** MIME types the Postiz `/upload` endpoint will accept. The backend
 *  sniffs the actual content (not just the extension) and 4xxs anything
 *  outside this list — enforcing here lets us fail fast and surface a
 *  useful error before the round-trip to Postiz. */
export const POSTIZ_ALLOWED_UPLOAD_MIME = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
  "image/tiff",
  "video/mp4",
]);

/** Throwing variant of `listPostizIntegrations` for /admin/postiz routes.
 *
 * Postiz can return either a bare array or `{ integrations: PostizIntegration[] }`
 * depending on version — we defensively unwrap the same way `listPostizIntegrations`
 * and `listPosts` do. Verified against live API 2026-06-16. */
export async function listIntegrations(): Promise<PostizIntegration[]> {
  const data = await callThrowing<PostizIntegration[] | { integrations?: PostizIntegration[] }>(
    "/integrations"
  );
  return Array.isArray(data) ? data : (data.integrations ?? []);
}

/** List posts in a window (ISO 8601 dates).
 *
 * Postiz wraps the response as `{ posts: PostizPost[] }`. Unwrap so callers
 * get a flat array. Verified against live API 2026-06-16. */
export async function listPosts(startDate: string, endDate: string): Promise<PostizPost[]> {
  const qs = new URLSearchParams({ startDate, endDate });
  const wrapped = await callThrowing<{ posts: PostizPost[] }>(`/posts?${qs.toString()}`);
  return wrapped.posts ?? [];
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

/** One successful or failed entry from {@link createPostsBulk}. */
export type BulkCreatePostResult =
  | {
      index: number;
      ok: true;
      result: Array<{ postId: string; integration: string }>;
    }
  | {
      index: number;
      ok: false;
      error: string;
      status?: number;
    };

/**
 * Schedule / draft / publish many posts sequentially.
 *
 * Postiz's create-post endpoint takes a single top-level `date`, so multi-day
 * calendars need one request per date (or per content row). We keep going after
 * individual failures so a bad mid-list item doesn't abort the rest. Cap the
 * batch size in the route layer — create-post is rate-limited (~90/hr, tunable
 * via `API_LIMIT` on the Postiz pod).
 */
export async function createPostsBulk(bodies: CreatePostBody[]): Promise<BulkCreatePostResult[]> {
  const out: BulkCreatePostResult[] = [];
  for (let index = 0; index < bodies.length; index++) {
    try {
      const result = await createPost(bodies[index]!);
      out.push({ index, ok: true, result });
    } catch (err) {
      if (err instanceof PostizApiError) {
        out.push({
          index,
          ok: false,
          error: err.body.slice(0, 300) || err.message,
          status: err.status,
        });
        continue;
      }
      out.push({
        index,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return out;
}

/** Delete a post.
 *
 * Per docs.postiz.com / API Overview, `DELETE` on a missing post should
 * return 404 — but there's a documented known issue where a missing post id
 * surfaces as a 500 instead. We swallow 404 unconditionally, and we swallow
 * 500 only when the body text looks like a "not found" response (so we
 * don't accidentally hide a real upstream crash). Anything else propagates. */
export async function deletePost(id: string): Promise<void> {
  try {
    await callThrowing<void>(`/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (err) {
    if (err instanceof PostizApiError) {
      if (err.status === 404) return;
      if (err.status === 500 && /not\s*found|no\s*such|cannot find/i.test(err.body)) {
        return;
      }
    }
    throw err;
  }
}

/** Upload media to Postiz by URL — returns an `{id,path}` usable in posts.
 *
 * Postiz fetches the remote URL server-side, which can take longer than the
 * default 10s when the source is a large image or a slow CDN. Bump the
 * timeout to 30s so a 5 MB media URL doesn't trip an AbortError on the
 * upstream fetch. */
export function uploadFromUrl(url: string): Promise<UploadedFile> {
  return callThrowing<UploadedFile>("/upload-from-url", {
    method: "POST",
    body: JSON.stringify({ url }),
    timeoutMs: 30_000,
  });
}

/** Ask Postiz for the next available time slot on a channel. */
export function findSlot(integrationId: string): Promise<{ date: string }> {
  // Postiz v2.11.2 mounts find-slot at `/find-slot/:id` (path param, no query),
  // see apps/backend/src/public-api/routes/v1/public.integrations.controller.ts.
  // The old `/integrations/find-slot?id=` path returns 404.
  return callThrowing<{ date: string }>(`/find-slot/${encodeURIComponent(integrationId)}`);
}

/** Update an existing scheduled / draft post via PUT /posts/:id. */
export function updatePost(
  id: string,
  body: CreatePostBody
): Promise<Array<{ postId: string; integration: string }>> {
  return callThrowing<Array<{ postId: string; integration: string }>>(
    `/posts/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    }
  );
}

/** One metric in a Postiz post-analytics response (`/analytics/post/:id`). */
export interface PostizAnalyticsMetric {
  label: string;
  data: Array<{ total: string; date: string }>;
  percentageChange: number;
}

/** Per-post analytics. The documented endpoint is
 *  `GET /analytics/post/:postId?date=<lookback-days>` — NOT the
 *  `/posts/:id/statistics` shape that was previously guessed here. The lookback
 *  window must be supplied; common values are 7, 30, 90. Empty array is
 *  returned for providers that don't surface per-post analytics. */
export function getPostStats(
  id: string,
  lookbackDays: 7 | 14 | 30 | 60 | 90 = 7
): Promise<PostizAnalyticsMetric[]> {
  return callThrowing<PostizAnalyticsMetric[]>(
    `/analytics/post/${encodeURIComponent(id)}?date=${lookbackDays}`
  );
}

/** Multipart upload — for users uploading a local file rather than a URL.
 *
 *  Postiz v2.11.2 exposes POST /upload (multipart/form-data, field name
 *  "file"). Unlike `uploadFromUrl`, this path streams the bytes the
 *  browser sent us through to Postiz with no intermediate fetch. */
export async function uploadFile(file: Blob, filename: string): Promise<UploadedFile> {
  const { baseUrl, apiKey } = await getPostizConfig();
  const form = new FormData();
  form.append("file", file, filename);
  const res = await fetch(`${baseUrl}/api/public/v1/upload`, {
    method: "POST",
    // No Content-Type — let fetch set the multipart boundary itself.
    headers: { Authorization: apiKey },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new PostizApiError(res.status, await res.text().catch(() => ""));
  return (await res.json()) as UploadedFile;
}

// --- Full Public-API coverage per docs.postiz.com ------------------------

/** Delete every post in a group with a single call. */
export function deletePostsByGroup(group: string): Promise<{ id: string }> {
  return callThrowing<{ id: string }>(`/posts/group/${encodeURIComponent(group)}`, {
    method: "DELETE",
  });
}

/** Move a post between `draft` and `schedule` state. Date is preserved.
 *  `schedule` → state QUEUE (workflow restarted), `draft` → state DRAFT
 *  (workflow terminated). */
export function changePostStatus(
  id: string,
  status: "draft" | "schedule"
): Promise<{ id: string; state: "DRAFT" | "QUEUE" }> {
  return callThrowing<{ id: string; state: "DRAFT" | "QUEUE" }>(
    `/posts/${encodeURIComponent(id)}/status`,
    {
      method: "PUT",
      body: JSON.stringify({ status }),
    }
  );
}

/** When Postiz publishes but can't get a real post-id back from the platform
 *  (`releaseId === "missing"`), this lists recent content from the provider
 *  so you can match and connect the right one. */
export interface PostizMissingContentItem {
  id: string;
  url: string;
}
export function getPostMissingContent(id: string): Promise<PostizMissingContentItem[]> {
  return callThrowing<PostizMissingContentItem[]>(
    `/posts/${encodeURIComponent(id)}/missing-content`
  );
}

/** Connect a missing post to the real platform post-id, restoring
 *  analytics + statistics tracking. */
export function updatePostReleaseId(
  id: string,
  releaseId: string
): Promise<{ id: string; releaseId: string }> {
  return callThrowing<{ id: string; releaseId: string }>(
    `/posts/${encodeURIComponent(id)}/release-id`,
    {
      method: "PUT",
      body: JSON.stringify({ releaseId }),
    }
  );
}

/** A customer group — the API counterpart of the multi-tenancy UI.
 *
 *  Note (verified 2026-06-20 against postiz.cloudless.gr): the `/groups`
 *  endpoint is NOT exposed by every Postiz version. The deployed image
 *  responds with HTTP 404 `{"message":"Cannot GET /public/v1/groups"}`
 *  for installations that pre-date the multi-tenant rewrite. We return
 *  an empty list in that case so the workspaces UI falls back to its
 *  free-text picker instead of throwing a 502 the operator can't fix.
 *  Other upstream errors (5xx, 401/403) still bubble as PostizApiError. */
export interface PostizGroup {
  id: string;
  name: string;
}
export async function listGroups(): Promise<PostizGroup[]> {
  try {
    return await callThrowing<PostizGroup[]>("/groups");
  } catch (err) {
    if (err instanceof PostizApiError && err.status === 404) {
      return [];
    }
    throw err;
  }
}

/** Probe whether the configured Postiz API key is currently valid.
 *
 *  Same version caveat as `listGroups`: `/integrations/is-connected`
 *  doesn't exist on every Postiz build. Treat a 404 as "endpoint
 *  unavailable, can't probe" (we surface that as connected=false
 *  rather than throwing, so the integrations dashboard stays useful). */
export async function isApiKeyValid(): Promise<{ connected: boolean }> {
  try {
    return await callThrowing<{ connected: boolean }>("/integrations/is-connected");
  } catch (err) {
    if (err instanceof PostizApiError && err.status === 404) {
      return { connected: false };
    }
    throw err;
  }
}

/** Delete a connected channel by integration id. Any scheduled posts on the
 *  channel are also deleted (per docs). */
export function deleteIntegration(id: string): Promise<void> {
  return callThrowing<void>(`/integrations/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Generate an OAuth authorization URL for a brand-new channel. Only OAuth
 *  providers are supported (Mastodon and friends that need a URL return 4xx). */
export function getIntegrationConnectUrl(integrationName: string): Promise<{ url: string }> {
  return callThrowing<{ url: string }>(
    `/integrations/${encodeURIComponent(integrationName)}/connect`
  );
}

/** Provider posting rules + settings JSON schema + available tools.
 *  Shape varies per provider so we keep it open. */
export function getIntegrationSettings(id: string): Promise<Record<string, unknown>> {
  return callThrowing<Record<string, unknown>>(`/integrations/${encodeURIComponent(id)}/settings`);
}

/** Execute a provider-specific tool (e.g. listing Discord channels, fetching
 *  Reddit flairs). Tool names + body shape discovered via `getIntegrationSettings`. */
export function triggerIntegrationTool(
  id: string,
  body: { tool: string; data?: Record<string, unknown> }
): Promise<Record<string, unknown>> {
  return callThrowing<Record<string, unknown>>(`/integrations/${encodeURIComponent(id)}/trigger`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Org notifications, newest first. 100 per page. */
export interface PostizNotification {
  id: string;
  text: string;
  createdAt: string;
}
export function listNotifications(page = 1): Promise<PostizNotification[]> {
  return callThrowing<PostizNotification[]>(`/notifications?page=${page}`);
}

/** Per-integration analytics (followers, impressions, engagement, …). Same
 *  AnalyticsData[] shape as the per-post variant. */
export function getIntegrationAnalytics(
  id: string,
  lookbackDays: 7 | 14 | 30 | 60 | 90 = 7
): Promise<PostizAnalyticsMetric[]> {
  return callThrowing<PostizAnalyticsMetric[]>(
    `/analytics/integration/${encodeURIComponent(id)}?date=${lookbackDays}`
  );
}

/**
 * NOTE: `verifyPostizWebhookSignature` moved to `src/lib/postiz-webhook.ts`
 * (SERVER ONLY). It was removed from this module because `postiz.ts` is
 * imported by the `"use client"` admin page — the literal `import("node:crypto")`
 * wrapped in the old function made webpack fail the client bundle with
 * UnhandledSchemeError. Import it from `@/lib/postiz-webhook` instead.
 */
