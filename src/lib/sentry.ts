/**
 * Sentry error tracking integration — cloudless.gr
 *
 * Two concerns:
 *  1. REST API client — reads/manages issues in the admin dashboard.
 *  2. SDK helpers — thin wrappers around @sentry/nextjs for manual capture.
 *
 * Configuration:
 *   SENTRY_AUTH_TOKEN     — Sentry auth token (scopes: project:read, project:write)
 *   SENTRY_ORG            — Sentry org slug (default: "baltzakisthemiscom")
 *   SENTRY_PROJECT        — Sentry project slug (default: "cloudless-gr")
 *   NEXT_PUBLIC_SENTRY_DSN — DSN for the SDK (set in .env.local + SSM)
 *
 * All REST functions return null on config/API errors (graceful degradation).
 */

import { getIntegrations, isConfigured } from "@/lib/integrations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SentryIssue {
  id: string;
  title: string;
  culprit: string;
  level: "fatal" | "error" | "warning" | "info" | "debug";
  /** Total event count as string (Sentry returns strings for large numbers) */
  count: string;
  userCount: number;
  firstSeen: string; // ISO 8601
  lastSeen: string; // ISO 8601
  status: "unresolved" | "resolved" | "ignored";
  /** Direct link to the issue on sentry.io */
  permalink: string;
  /** Human-readable short ID, e.g. "CLOUDLESS-GR-1A2B" */
  shortId: string;
  metadata: {
    type?: string; // Error class name
    value?: string; // Error message
    filename?: string;
    function?: string;
  };
  tags?: Array<{ key: string; value: string }>;
}

export interface SentryIssueList {
  issues: SentryIssue[];
  total: number;
  fetchedAt: string;
}

export type SortField = "date" | "new" | "freq" | "users";
export type IssueLevel = "fatal" | "error" | "warning" | "info" | "debug";
export type IssueStatus = "resolved" | "ignored" | "unresolved";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const SENTRY_API = "https://sentry.io/api/0";

function getSentryConfig(): {
  token: string;
  org: string;
  project: string;
} | null {
  if (!isConfigured("SENTRY_AUTH_TOKEN")) return null;
  const { SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT } = getIntegrations();
  return {
    token: SENTRY_AUTH_TOKEN!,
    org: SENTRY_ORG ?? "baltzakisthemiscom",
    project: SENTRY_PROJECT ?? "cloudless-gr",
  };
}

async function sentryFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T | null> {
  const cfg = getSentryConfig();
  if (!cfg) return null;

  try {
    const res = await fetch(`${SENTRY_API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (res.status === 401 || res.status === 403) {
      console.error(
        `[Sentry] Auth error ${res.status} — check SENTRY_AUTH_TOKEN scopes.`,
      );
      return null;
    }

    if (!res.ok) {
      console.error(`[Sentry] API error ${res.status}: ${path}`);
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.error("[Sentry] Fetch error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// REST API — Issue queries
// ---------------------------------------------------------------------------

/**
 * Fetch unresolved issues for the project, sorted by most recently seen.
 *
 * @param options.limit  Max issues to return (default 20, max 100)
 * @param options.sort   Sort order: date | new | freq | users (default "date")
 * @param options.query  Sentry search query (default "is:unresolved")
 * @param options.level  Filter by level: fatal | error | warning | info | debug
 */
export async function getUnresolvedIssues(
  options: {
    limit?: number;
    sort?: SortField;
    query?: string;
    level?: IssueLevel;
  } = {},
): Promise<SentryIssueList | null> {
  const cfg = getSentryConfig();
  if (!cfg) return null;

  const { limit = 20, sort = "date", level } = options;
  let { query = "is:unresolved" } = options;

  if (level) query = `${query} level:${level}`;

  const params = new URLSearchParams({ query, sort, limit: String(limit) });
  const issues = await sentryFetch<SentryIssue[]>(
    `/projects/${cfg.org}/${cfg.project}/issues/?${params}`,
  );

  if (!issues) return null;

  return {
    issues,
    total: issues.length,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch top errors sorted by event frequency (most impactful first).
 * Useful for the admin dashboard summary card.
 */
export async function getTopErrors(limit = 5): Promise<SentryIssue[]> {
  const result = await getUnresolvedIssues({
    limit,
    sort: "freq",
    level: "error",
  });
  return result?.issues ?? [];
}

/**
 * Fetch a single issue by ID with full details.
 */
export async function getIssue(issueId: string): Promise<SentryIssue | null> {
  return sentryFetch<SentryIssue>(`/issues/${issueId}/`);
}

/**
 * Count unresolved issues by severity level.
 * Returns an object with counts for each level present.
 */
export async function getErrorCounts(): Promise<{
  fatal: number;
  error: number;
  warning: number;
  total: number;
} | null> {
  const result = await getUnresolvedIssues({ limit: 100, sort: "date" });
  if (!result) return null;

  const counts = {
    fatal: 0,
    error: 0,
    warning: 0,
    total: result.issues.length,
  };
  for (const issue of result.issues) {
    if (issue.level === "fatal") counts.fatal++;
    else if (issue.level === "error") counts.error++;
    else if (issue.level === "warning") counts.warning++;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// REST API — Issue actions
// ---------------------------------------------------------------------------

/**
 * Update issue status (resolve, ignore, or reopen).
 * Returns true on success, false on failure.
 */
export async function updateIssueStatus(
  issueId: string,
  status: IssueStatus,
): Promise<boolean> {
  const result = await sentryFetch<{ status: string }>(`/issues/${issueId}/`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
  return result?.status === status;
}

/**
 * Resolve an issue — shorthand for updateIssueStatus(id, "resolved").
 */
export async function resolveIssue(issueId: string): Promise<boolean> {
  return updateIssueStatus(issueId, "resolved");
}

/**
 * Ignore an issue — shorthand for updateIssueStatus(id, "ignored").
 */
export async function ignoreIssue(issueId: string): Promise<boolean> {
  return updateIssueStatus(issueId, "ignored");
}

/**
 * Resolve an issue and mark it as fixed in a specific release.
 * Useful when deploying a fix — links the resolution to the release version.
 */
export async function resolveInRelease(
  issueId: string,
  version: string,
): Promise<boolean> {
  const result = await sentryFetch<{ status: string }>(`/issues/${issueId}/`, {
    method: "PUT",
    body: JSON.stringify({
      status: "resolved",
      statusDetails: { inRelease: version },
    }),
  });
  return result?.status === "resolved";
}

// ---------------------------------------------------------------------------
// Configuration check
// ---------------------------------------------------------------------------

/**
 * Returns true if SENTRY_AUTH_TOKEN is set.
 * Use before rendering Sentry-dependent admin UI.
 */
export function isSentryConfigured(): boolean {
  return isConfigured("SENTRY_AUTH_TOKEN");
}
