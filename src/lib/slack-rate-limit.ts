/**
 * Sliding-window rate limiter for Slack API routes.
 *
 * Tracks requests per key (typically team_id) using an in-memory
 * sliding window. Returns false when the limit is exceeded.
 */

const store = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

export function checkSlackRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = store.get(key) ?? [];
  const valid = timestamps.filter((t) => now - t < WINDOW_MS);
  if (valid.length >= MAX_REQUESTS) {
    store.set(key, valid);
    return false;
  }
  valid.push(now);
  store.set(key, valid);
  return true;
}

export function resetRateLimiter(): void {
  store.clear();
}
