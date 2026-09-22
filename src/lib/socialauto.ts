import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getConfig } from "@/lib/ssm-config";
import type {
  CreatePostBody,
  PostizAnalyticsMetric,
  PostizIntegration,
  PostizPost,
  UploadedFile,
} from "@/lib/postiz";

/**
 * SocialAuto — the live social-publishing backend (social.cloudless.gr).
 *
 * The /admin/postiz page used to proxy a self-hosted Postiz instance; the
 * real channels, schedule, queue, and analytics now live in SocialAuto, so
 * this module exposes the same shapes the admin UI already renders
 * (PostizIntegration / PostizPost / PostizAnalyticsMetric) backed by the
 * SocialAuto `/api/v1` surface. Routes keep their `/api/admin/postiz/*`
 * paths — only the upstream changes.
 *
 * Auth: the site logs in as the SocialAuto admin user (email + password in
 * config) and caches the returned JWT. Optional Cloudflare Access service
 * token headers are added when configured — same convention as Postiz.
 *
 * Config (SSM / env):
 *   SOCIALAUTO_API_URL            — default https://social.cloudless.gr
 *   SOCIALAUTO_ADMIN_EMAIL        — SocialAuto admin login
 *   SOCIALAUTO_ADMIN_PASSWORD     — SocialAuto admin password
 *   SOCIALAUTO_SERVICE_TOKEN      — CF Access secret, or "client_id:client_secret"
 *   SOCIALAUTO_CF_ACCESS_CLIENT_ID — explicit CF Access client id (optional)
 */

const DEFAULT_BASE_URL = "https://social.cloudless.gr";
const API_PREFIX = "/api/v1";
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const FALLBACK_TOKEN_TTL_MS = 50 * 60_000;

export class SocialAutoNotConfiguredError extends Error {
  constructor() {
    super("SocialAuto admin credentials not configured");
    this.name = "SocialAutoNotConfiguredError";
  }
}

export class SocialAutoApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`SocialAuto API error ${status}: ${body.slice(0, 200)}`);
    this.name = "SocialAutoApiError";
  }
}

interface SaConfig {
  baseUrl: string;
  email: string;
  password: string;
}

async function getSaConfig(): Promise<SaConfig> {
  const cfg = await getConfig();
  if (!cfg.SOCIALAUTO_ADMIN_EMAIL || !cfg.SOCIALAUTO_ADMIN_PASSWORD) {
    throw new SocialAutoNotConfiguredError();
  }
  return {
    baseUrl: (cfg.SOCIALAUTO_API_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
    email: cfg.SOCIALAUTO_ADMIN_EMAIL,
    password: cfg.SOCIALAUTO_ADMIN_PASSWORD,
  };
}

/** CF Access service-token creds — same (id, secret) pair convention as
 *  POSTIZ_SERVICE_TOKEN: either SOCIALAUTO_CF_ACCESS_CLIENT_ID +
 *  SOCIALAUTO_SERVICE_TOKEN, or a single "id:secret" token. */
async function readCfAccessCreds(): Promise<{ clientId: string; clientSecret: string } | null> {
  const cfg = await getConfig();
  const raw = cfg.SOCIALAUTO_SERVICE_TOKEN;
  if (!raw) return null;
  const explicitId = cfg.SOCIALAUTO_CF_ACCESS_CLIENT_ID;
  if (explicitId) return { clientId: explicitId, clientSecret: raw };
  const colon = raw.indexOf(":");
  if (colon > 0) return { clientId: raw.slice(0, colon), clientSecret: raw.slice(colon + 1) };
  return null;
}

// ── JWT cache ──────────────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;
let loginInFlight: Promise<string> | null = null;

function jwtExpiryMs(token: string): number {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")
    ) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : Date.now() + FALLBACK_TOKEN_TTL_MS;
  } catch {
    return Date.now() + FALLBACK_TOKEN_TTL_MS;
  }
}

async function saLogin(): Promise<string> {
  if (loginInFlight) return loginInFlight;
  loginInFlight = (async () => {
    const { baseUrl, email, password } = await getSaConfig();
    const headers = new Headers({ "Content-Type": "application/x-www-form-urlencoded" });
    const cf = await readCfAccessCreds();
    if (cf) {
      headers.set("Cf-Access-Client-Id", cf.clientId);
      headers.set("Cf-Access-Client-Secret", cf.clientSecret);
    }
    const res = await fetch(`${baseUrl}${API_PREFIX}/auth/login`, {
      method: "POST",
      headers,
      body: new URLSearchParams({ username: email, password }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new SocialAutoApiError(res.status, await res.text().catch(() => ""));
    }
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) {
      throw new SocialAutoApiError(res.status, "login response missing access_token");
    }
    cachedToken = {
      token: data.access_token,
      expiresAt: jwtExpiryMs(data.access_token) - TOKEN_REFRESH_MARGIN_MS,
    };
    return data.access_token;
  })().finally(() => {
    loginInFlight = null;
  });
  return loginInFlight;
}

async function saToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;
  return saLogin();
}

async function saFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
  retried = false
): Promise<Response> {
  const { baseUrl } = await getSaConfig();
  const { timeoutMs, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("Authorization", `Bearer ${await saToken()}`);
  const cf = await readCfAccessCreds();
  if (cf) {
    headers.set("Cf-Access-Client-Id", cf.clientId);
    headers.set("Cf-Access-Client-Secret", cf.clientSecret);
  }
  if (rest.body && !headers.has("Content-Type") && typeof rest.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${baseUrl}${API_PREFIX}${path}`, {
    ...rest,
    headers,
    signal: AbortSignal.timeout(timeoutMs ?? 15_000),
  });

  // Token revoked/expired upstream — drop the cache and retry once.
  if (res.status === 401 && !retried) {
    cachedToken = null;
    return saFetch(path, init, true);
  }
  return res;
}

async function callThrowing<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const res = await saFetch(path, init);
  if (!res.ok) throw new SocialAutoApiError(res.status, await res.text().catch(() => ""));
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new SocialAutoApiError(res.status, `invalid JSON (${reason}; len=${text.length})`);
  }
}

// ── SocialAuto entity shapes (subset of the API models) ────────────────────

export interface SaAccount {
  id: string;
  platform: string;
  account_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  account_type?: string;
}

interface SaPostTarget {
  social_account_id: string;
  platform: string;
  username: string | null;
  status: string;
  platform_url?: string | null;
}

interface SaPost {
  id: string;
  status: string;
  content_text: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  media_ids: string[];
  targets: SaPostTarget[];
}

interface SaPostList {
  posts: SaPost[];
  total: number;
}

interface SaAccountMetrics {
  account_id: string;
  platform: string;
  username: string;
  followers: number;
  posts_count: number;
  total_impressions: number;
  total_engagement: number;
  avg_engagement_rate: number;
}

interface SaMediaAsset {
  id: string;
  filename: string | null;
  storage_path: string;
  public_url: string | null;
}

// ── Accounts → PostizIntegration ────────────────────────────────────────────

export async function listAccounts(): Promise<SaAccount[]> {
  return callThrowing<SaAccount[]>("/accounts");
}

function accountToIntegration(a: SaAccount): PostizIntegration {
  return {
    id: a.id,
    name: a.display_name || a.username || `${a.platform} account`,
    identifier: a.platform,
    picture: a.avatar_url ?? undefined,
    disabled: a.status !== "active",
  };
}

export async function listAccountsAsIntegrations(): Promise<PostizIntegration[]> {
  const accounts = await listAccounts();
  return accounts.map(accountToIntegration);
}

// ── Posts → PostizPost ──────────────────────────────────────────────────────

const SA_STATUS_TO_POSTIZ_STATE: Record<string, PostizPost["state"]> = {
  draft: "DRAFT",
  scheduled: "QUEUE",
  approved: "QUEUE",
  review: "QUEUE",
  publishing: "QUEUE",
  published: "PUBLISHED",
  failed: "ERROR",
};

function effectiveDate(p: SaPost): string {
  return p.scheduled_at ?? p.published_at ?? p.created_at;
}

/** Fetch every post the admin window can contain: one request per status,
 *  page_size=100 (the admin window is ±30d — bounded). */
async function listAllPosts(): Promise<SaPost[]> {
  const statuses = [
    "scheduled",
    "published",
    "failed",
    "draft",
    "approved",
    "review",
    "publishing",
  ];
  const lists = await Promise.all(
    statuses.map((s) =>
      callThrowing<SaPostList>(`/content/posts?status=${s}&page_size=100`).catch(() => ({
        posts: [] as SaPost[],
        total: 0,
        page: 1,
        page_size: 100,
      }))
    )
  );
  return lists.flatMap((l) => l.posts);
}

/** Posts in a window — exploded per target so each channel shows its own row,
 *  matching the per-integration shape Postiz returned. */
export async function listPostsInWindow(startISO: string, endISO: string): Promise<PostizPost[]> {
  const startMs = new Date(startISO).getTime();
  const endMs = new Date(endISO).getTime();
  const posts = await listAllPosts();
  const out: PostizPost[] = [];
  for (const p of posts) {
    const date = effectiveDate(p);
    const ms = new Date(date).getTime();
    if (ms < startMs || ms > endMs) continue;
    const state = SA_STATUS_TO_POSTIZ_STATE[p.status] ?? "DRAFT";
    if (p.targets.length === 0) {
      out.push({
        id: p.id,
        content: p.content_text ?? "",
        publishDate: date,
        state,
        integration: { id: "", name: "(no channel)", providerIdentifier: "" },
      });
      continue;
    }
    for (const t of p.targets) {
      out.push({
        id: p.id,
        content: p.content_text ?? "",
        publishDate: date,
        state,
        releaseURL: t.platform_url ?? null,
        integration: {
          id: t.social_account_id,
          name: t.username || t.platform,
          providerIdentifier: t.platform,
        },
      });
    }
  }
  out.sort((a, b) => a.publishDate.localeCompare(b.publishDate));
  return out;
}

/** Translate the Postiz create-post body into a SocialAuto post.
 *  `type: now` → create then publish-now; `schedule` → scheduled_at;
 *  `draft` → no scheduled_at. Returns one {postId, integration} entry per
 *  channel to match the Postiz response shape the UI renders. */
export async function createPostFromBody(
  body: CreatePostBody
): Promise<Array<{ postId: string; integration: string }>> {
  const first = body.posts[0];
  const content = first?.value?.[0]?.content ?? "";
  const mediaIds = first?.value?.[0]?.image?.map((i) => i.id).filter(Boolean) ?? [];
  const targetIds = body.posts.map((p) => p.integration.id).filter(Boolean);
  const scheduledAt = body.type === "draft" ? null : body.date;

  const post = await callThrowing<SaPost>("/content/posts", {
    method: "POST",
    body: JSON.stringify({
      content_text: content,
      media_ids: mediaIds,
      scheduled_at: scheduledAt,
      target_account_ids: targetIds,
    }),
  });

  if (body.type === "now") {
    await callThrowing<SaPost>(`/content/posts/${encodeURIComponent(post.id)}/publish-now`, {
      method: "POST",
    }).catch((err) => {
      // Post exists but immediate publish failed — surface the upstream error.
      throw err;
    });
  }

  return targetIds.map((integration) => ({ postId: post.id, integration }));
}

export async function updatePostFromBody(
  id: string,
  body: CreatePostBody
): Promise<Array<{ postId: string; integration: string }>> {
  const first = body.posts[0];
  const content = first?.value?.[0]?.content;
  const mediaIds = first?.value?.[0]?.image?.map((i) => i.id).filter(Boolean);
  const targetIds = body.posts.map((p) => p.integration.id).filter(Boolean);
  const scheduledAt = body.type === "draft" ? null : body.date;

  await callThrowing<SaPost>(`/content/posts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      content_text: content,
      media_ids: mediaIds,
      scheduled_at: scheduledAt,
      target_account_ids: targetIds,
    }),
  });
  return targetIds.map((integration) => ({ postId: id, integration }));
}

export async function deletePostById(id: string): Promise<void> {
  try {
    await callThrowing<void>(`/content/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (err) {
    if (err instanceof SocialAutoApiError && err.status === 404) return;
    throw err;
  }
}

// ── Media upload → UploadedFile ─────────────────────────────────────────────

export async function uploadFileToSocialAuto(blob: Blob, filename: string): Promise<UploadedFile> {
  const form = new FormData();
  form.append("file", blob, filename);
  const asset = await callThrowing<SaMediaAsset>("/media/upload", {
    method: "POST",
    body: form,
    timeoutMs: 60_000,
  });
  return {
    id: asset.id,
    name: asset.filename ?? filename,
    path: asset.public_url ?? asset.storage_path,
  };
}

/** SocialAuto has no upload-from-url endpoint — fetch the bytes ourselves
 *  (the route layer already blocked private/loopback hosts) and push them
 *  through the same multipart path as a direct file upload. */
export async function uploadFromUrlToSocialAuto(url: string): Promise<UploadedFile> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new SocialAutoApiError(res.status, `source fetch failed ${res.status}`);
  const blob = await res.blob();
  const filename = url.split("/").pop()?.split("?")[0] || "upload";
  return uploadFileToSocialAuto(blob, filename);
}

/** No slot concept upstream — return the top of the next hour. */
export function nextSlot(_integrationId: string): { date: string } {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(0, 0, 0);
  return { date: d.toISOString() };
}

// ── Analytics → PostizAnalyticsMetric ───────────────────────────────────────

export async function getChannelAnalytics(
  accountId: string,
  _lookback: number
): Promise<PostizAnalyticsMetric[]> {
  const m = await callThrowing<SaAccountMetrics>(
    `/analytics/accounts/${encodeURIComponent(accountId)}/metrics?days=${_lookback}`
  );
  const today = new Date().toISOString().slice(0, 10);
  const point = (total: number) => [{ total: String(total), date: today }];
  return [
    { label: "Followers", data: point(m.followers), percentageChange: 0 },
    { label: "Impressions", data: point(m.total_impressions), percentageChange: 0 },
    { label: "Engagement", data: point(m.total_engagement), percentageChange: 0 },
    { label: "Published posts", data: point(m.posts_count), percentageChange: 0 },
    {
      label: "Engagement rate %",
      data: point(Number(m.avg_engagement_rate.toFixed(2))),
      percentageChange: 0,
    },
  ];
}

export async function isSocialAutoConfigured(): Promise<boolean> {
  try {
    await getSaConfig();
    return true;
  } catch {
    return false;
  }
}

/** Shared body validation for the create-post routes — returns a 400
 *  response when the Postiz-shaped body is malformed, null when valid. */
export function invalidCreateBodyResponse(
  body: CreatePostBody | null | undefined
): NextResponse | null {
  if (!body?.type || !Array.isArray(body.posts) || body.posts.length === 0) {
    return NextResponse.json(
      { error: "invalid_payload", detail: "type and posts[] are required" },
      { status: 400 }
    );
  }
  return null;
}

/** Shared error→response mapping for the /api/admin/postiz/* route handlers —
 *  keeps the SocialAuto upstream contract identical across every route
 *  (503 unconfigured / 429 rate-limit / 502 upstream) without duplicating
 *  the catch block per file. Re-throws anything unexpected. */
export function saErrorToResponse(err: unknown): NextResponse {
  if (err instanceof SocialAutoNotConfiguredError) {
    return NextResponse.json({ error: "socialauto_not_configured" }, { status: 503 });
  }
  if (err instanceof SocialAutoApiError) {
    return NextResponse.json(
      { error: "socialauto_upstream", status: err.status, body: err.body },
      { status: err.status === 429 ? 429 : 502 }
    );
  }
  throw err;
}

/** Entry-point wrapper for the /api/admin/postiz/* routes — admin auth plus
 *  SocialAuto error mapping, so each exported handler holds only its unique
 *  logic instead of repeating the requireAdmin/try-catch boilerplate. */
export function saAdminRoute<C extends { params: Promise<unknown> } = { params: Promise<unknown> }>(
  handler: (_req: NextRequest, _ctx: C) => Promise<NextResponse>
): (_req: NextRequest, _ctx: C) => Promise<NextResponse> {
  return async (req, ctx) => {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;
    try {
      return await handler(req, ctx);
    } catch (err) {
      return saErrorToResponse(err);
    }
  };
}

/** Parses the request's JSON body — returns the parsed value, or the 400
 *  `invalid_json` response the handler should return as-is. */
export async function readJsonBody<T>(req: NextRequest): Promise<T | NextResponse> {
  try {
    return (await req.json()) as T;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
}
