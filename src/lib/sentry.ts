/**
 * Sentry error tracking integration.
 *
 * Provides a typed client for fetching unresolved issues, issue details,
 * and resolving/ignoring issues via the Sentry API.
 *
 * Configuration:
 *   SENTRY_AUTH_TOKEN — Sentry internal integration or user auth token
 *   SENTRY_ORG       — Sentry organization slug (default: "cloudless")
 *   SENTRY_PROJECT   — Sentry project slug (default: "cloudless-gr")
 *
 * All functions return null on configuration or API errors (graceful degradation).
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
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  status: "unresolved" | "resolved" | "ignored";
  permalink: string;
  shortId: string;
  metadata: {
    type?: string;
    value?: string;
    filename?: string;
    function?: string;
  };
}

export interface SentryIssueList {
  issues: SentryIssue[];
  total: number;
  fetchedAt: string;
}

type SortField = "date" | "new" | "freq" | "users";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const SENTRY_API = "https://sentry.io/api/0";

function getSentryConfig(): { token: string; org: string; project: string } | null {
  if (!isConfigured("SENTRY_AUTH_TOKEN")) return null;
  const { SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT } = getIntegrations();
  return {
    token: SENTRY_AUTH_TOKEN!,
    org: SENTRY_ORG ?? "cloudless",
    project: SENTRY_PROJECT ?? "cloudless-gr",
  };
}

async function sentryFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch unresolved issues for the project.
 */
export async function getUnresolvedIssues(
  options: { limit?: number; sort?: SortField; query?: string } = {},
): Promise<SentryIssueList | null> {
  const cfg = getSentryConfig();
  if (!cfg) return null;

  const { limit = 20, sort = "date", query = "is:unresolved" } = options;
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
 * Fetch a single issue by ID with full details.
 */
export async function getIssue(issueId: string): Promise<SentryIssue | null> {
  return sentryFetch<SentryIssue>(`/issues/${issueId}/`);
}

/**
 * Update issue status (resolve, ignore, or reopen).
 */
export async function updateIssueStatus(
  issueId: string,
  status: "resolved" | "ignored" | "unresolved",
): Promise<boolean> {
  const result = await sentryFetch<{ status: string }>(`/issues/${issueId}/`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
  return result?.status === status;
}

/**
 * Check if Sentry is configured and reachable.
 */
export function isSentryConfigured(): boolean {
  return isConfigured("SENTRY_AUTH_TOKEN");
}
