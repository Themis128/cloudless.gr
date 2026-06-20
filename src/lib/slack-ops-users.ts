/**
 * Slack ops-user allowlist resolver.
 *
 * The list of Slack user IDs allowed to trigger destructive actions
 * (workflow re-runs, newsletter sends, deploys) is read at request time —
 * not at module load. In Lambda, environment variables are baked at cold
 * start, so a fresh value in SSM only takes effect through this resolver.
 *
 * Resolution order:
 *   1. `process.env.SLACK_OPS_USERS` (when set + non-empty)
 *   2. `SSM SLACK_OPS_USERS` parameter
 *   3. Empty list → "anyone in the workspace" semantics
 *
 * Format: comma-separated Slack user IDs, e.g. "U01ABCDEF,U02GHIJKL".
 *
 * Cached for the lifetime of the Lambda container — the list rotates rarely
 * (admin churn is annual at most), and an immediate refresh is unnecessary.
 */

let cached: { value: string[]; at: number } | null = null;
const TTL_MS = 5 * 60 * 1_000; // 5 minutes — long enough to absorb a burst,
// short enough to pick up an SSM update without a redeploy.

function parse(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function getSlackOpsUsers(): Promise<string[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const envList = parse(process.env.SLACK_OPS_USERS);
  if (envList.length > 0) {
    cached = { value: envList, at: Date.now() };
    return envList;
  }

  // SSM fallback — keeps the Lambda working when the operator forgot to set
  // SLACK_OPS_USERS as an env var but added it to SSM the normal way.
  try {
    const { getConfig } = await import("@/lib/ssm-config");
    const cfg = (await getConfig()) as unknown as Record<string, string>;
    const ssmList = parse(cfg.SLACK_OPS_USERS);
    cached = { value: ssmList, at: Date.now() };
    return ssmList;
  } catch (err) {
    console.warn("[slack-ops-users] SSM lookup failed:", err);
    cached = { value: [], at: Date.now() };
    return [];
  }
}

/**
 * Sync version for code paths that can't await (e.g. synchronous Slack
 * command handlers that already block on env vars). Returns env-only and
 * does NOT consult SSM. Prefer the async variant when possible.
 */
export function getSlackOpsUsersSync(): string[] {
  return parse(process.env.SLACK_OPS_USERS);
}

/** Test hook — reset the cache so the next call re-reads env + SSM. */
export function resetSlackOpsUsersCache(): void {
  cached = null;
}

/** Pure helper for handlers that already have a userId in hand. */
export async function isSlackOpsUser(userId: string): Promise<boolean> {
  const list = await getSlackOpsUsers();
  if (list.length === 0) return true; // empty = open
  return list.includes(userId);
}
