/**
 * Sliding-window rate limiter for public API routes.
 *
 * Tracks requests per IP using an in-memory sliding window.
 * Returns { ok: true } when allowed, { ok: false, response } when rate-limited.
 *
 * Note: In-memory state resets on Lambda cold starts, which means limits
 * are per-instance. This is intentional — it provides basic abuse protection
 * without requiring Redis, and is sufficient for low-traffic contact/subscribe
 * forms where the primary concern is accidental or casual abuse.
 */

interface RateLimitStore {
  timestamps: number[];
}

const store = new Map<string, RateLimitStore>();

// Prune expired entries periodically to avoid memory growth.
// Only runs when rate limiter is actually called.
let lastPrune = Date.now();
function maybePrune(windowMs: number) {
  const now = Date.now();
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [key, entry] of store.entries()) {
    const valid = entry.timestamps.filter((t) => now - t < windowMs);
    if (valid.length === 0) {
      store.delete(key);
    } else {
      entry.timestamps = valid;
    }
  }
}

export interface RateLimitResult {
  ok: true;
  remaining: number;
}

export interface RateLimitExceeded {
  ok: false;
  response: Response;
}

/**
 * Check rate limit for the given key (typically an IP address).
 *
 * @param key      Unique identifier (IP, userId, etc.)
 * @param limit    Max requests allowed in the window
 * @param windowMs Window size in milliseconds (default: 60 000 = 1 min)
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): RateLimitResult | RateLimitExceeded {
  maybePrune(windowMs);
  const now = Date.now();
  const entry = store.get(key) ?? { timestamps: [] };
  const valid = entry.timestamps.filter((t) => now - t < windowMs);

  if (valid.length >= limit) {
    store.set(key, { timestamps: valid });
    return {
      ok: false,
      response: Response.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(windowMs / 1000)),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": "0",
          },
        },
      ),
    };
  }

  valid.push(now);
  store.set(key, { timestamps: valid });
  return { ok: true, remaining: limit - valid.length };
}

/**
 * Extract the best-guess IP from a Next.js request.
 * Prefers X-Forwarded-For (set by CloudFront/ALB), falls back to a constant
 * so rate limiting still works locally even without a real IP.
 */
export function getClientIp(request: Request): string {
  const xff = (request.headers as Headers).get("x-forwarded-for");
  if (xff) {
    // X-Forwarded-For can be "client, proxy1, proxy2" — take the first
    return xff.split(",")[0].trim();
  }
  return "unknown";
}

/** Reset the store — used in tests. */
export function resetRateLimitStore(): void {
  store.clear();
}
