/**
 * Sliding-window rate limiter for inbound Slack requests.
 *
 * Tracks per-key request counts within a 60-second rolling window.
 * Callers pass a workspace team_id as the key so each Slack workspace
 * gets its own independent limit.
 */

const WINDOW_MS = 60 * 1000; // 60 seconds
const MAX_REQUESTS = 60; // 60 requests per window

/** key -> sorted array of timestamps (milliseconds) within the current window */
const buckets = new Map<string, number[]>();

/**
 * Checks whether the given key is within the rate limit.
 * Returns true if the request is allowed, false if it is rate-limited.
 * Prunes expired timestamps on every call.
 */
export function checkSlackRateLimit(key: string): boolean {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const existing = buckets.get(key) ?? [];
  // Discard timestamps older than the sliding window
  const valid = existing.filter((ts) => ts > windowStart);

  if (valid.length >= MAX_REQUESTS) {
    buckets.set(key, valid);
    return false; // rate limited
  }

  valid.push(now);
  buckets.set(key, valid);
  return true; // allowed
}

/** Clears all rate-limit state. Use in tests to reset between cases. */
export function resetRateLimiter(): void {
  buckets.clear();
}
