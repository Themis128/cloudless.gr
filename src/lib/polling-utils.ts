/** 
 * Shared polling utilities with throttling, deduplication, and backoff. 
 * 
 * Fixes HTTP 429 "Too Many Requests" by: 
 * - Increasing polling intervals to reasonable defaults 
 * - Deduplicating concurrent requests across tabs 
 * - Implementing exponential backoff on errors 
 * - Respecting Retry-After headers 
 * - Skipping polls when tab is hidden 
 */

const POLLING_KEY = "cloudless:polling:lock";
const POLLING_STATE_KEY = "cloudless:polling:state";

interface PollingState {
  lastSuccess: number;
  consecutiveErrors: number;
  backoffUntil: number;
  retryAfter: number;
}

function getPollingState(): PollingState {
  if (typeof window === "undefined") return { lastSuccess: 0, consecutiveErrors: 0, backoffUntil: 0, retryAfter: 0 };
  try {
    const raw = localStorage.getItem(POLLING_STATE_KEY);
    if (!raw) return { lastSuccess: 0, consecutiveErrors: 0, backoffUntil: 0, retryAfter: 0 };
    return JSON.parse(raw) as PollingState;
  } catch {
    return { lastSuccess: 0, consecutiveErrors: 0, backoffUntil: 0, retryAfter: 0 };
  }
}

function setPollingState(state: PollingState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(POLLING_STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable
  }
}

/**
 * Acquire a cross-tab lock for polling. Returns true if this tab should proceed.
 */
export function acquirePollLock(ttlMs = 5000): boolean {
  if (typeof window === "undefined") return true;
  const now = Date.now();
  const existing = localStorage.getItem(POLLING_KEY);
  if (existing) {
    const expiry = Number.parseInt(existing, 10);
    if (now < expiry) return false; // Another tab is polling
  }
  // Set lock
  localStorage.setItem(POLLING_KEY, String(now + ttlMs));
  return true;
}

/**
 * Release the polling lock (called after fetch completes).
 */
export function releasePollLock(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(POLLING_KEY);
}

/**
 * Calculate the effective polling interval based on error history.
 */
export function getEffectiveInterval(
  baseInterval: number,
  maxBackoff = 300_000 // 5 minutes max
): number {
  const state = getPollingState();
  const now = Date.now();
  // Respect explicit Retry-After from server
  if (state.retryAfter > now) {
    return state.retryAfter - now;
  }
  // Respect backoff from consecutive errors
  if (state.backoffUntil > now) {
    return Math.min(baseInterval * Math.pow(2, state.consecutiveErrors), maxBackoff);
  }
  // If we had recent success, use base interval
  if (now - state.lastSuccess < baseInterval * 2) {
    return baseInterval;
  }
  // After errors, use exponential backoff
  return Math.min(baseInterval * Math.pow(2, state.consecutiveErrors), maxBackoff);
}

/**
 * Record a successful poll.
 */
export function recordPollSuccess(): void {
  setPollingState({ lastSuccess: Date.now(), consecutiveErrors: 0, backoffUntil: 0, retryAfter: 0 });
}

/**
 * Record a failed poll, extracting Retry-After if available.
 */
export function recordPollError(response: Response): void {
  const state = getPollingState();
  const retryAfterHeader = response.headers.get("Retry-After");
  let retryAfter = 0;
  if (retryAfterHeader) {
    const seconds = Number.parseInt(retryAfterHeader, 10);
    if (!Number.isNaN(seconds) && seconds > 0) {
      retryAfter = Date.now() + seconds * 1000;
    }
  }
  setPollingState({
    lastSuccess: state.lastSuccess,
    consecutiveErrors: state.consecutiveErrors + 1,
    backoffUntil: Date.now() + Math.min(
      1000 * Math.pow(2, state.consecutiveErrors),
      300_000
    ),
    retryAfter,
  });
}

/**
 * Reset polling state (e.g., on manual refresh).
 */
export function resetPollingState(): void {
  setPollingState({ lastSuccess: 0, consecutiveErrors: 0, backoffUntil: 0, retryAfter: 0 });
}

/**
 * Check if the page is visible.
 */
export function isPageVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

/**
 * Create a throttled fetch function that respects rate limits.
 */
export function createThrottledFetch(
  baseFetcher: () => Promise<Response>,
  baseInterval = 30_000,
): () => Promise<Response> {
  let inFlight = false;
  let pendingPromise: Promise<Response> | null = null;
  return async (): Promise<Response> => {
    // Skip if page is hidden
    if (!isPageVisible()) {
      return Promise.reject(new Error("Page is hidden, skipping poll"));
    }
    // If already in flight, return the same promise (dedup)
    if (inFlight && pendingPromise) {
      return pendingPromise;
    }
    // Check backoff
    const effectiveInterval = getEffectiveInterval(baseInterval);
    const state = getPollingState();
    const now = Date.now();
    if (state.backoffUntil > now || state.retryAfter > now) {
      const waitMs = Math.min(state.backoffUntil, state.retryAfter) - now;
      return Promise.reject(
        new Error(`Rate limited, retry in ${Math.ceil(waitMs / 1000)}s`),
      );
    }
    inFlight = true;
    pendingPromise = (async () => {
      try {
        const response = await baseFetcher();
        if (response.ok) {
          recordPollSuccess();
        } else if (response.status === 429) {
          recordPollError(response);
        }
        return response;
      } catch (err) {
        // Network errors also count as failures
        const state = getPollingState();
        setPollingState({
          ...state,
          consecutiveErrors: state.consecutiveErrors + 1,
          backoffUntil: Date.now() + Math.min(
            1000 * Math.pow(2, state.consecutiveErrors),
            300_000
          ),
        });
        throw err;
      } finally {
        inFlight = false;
        pendingPromise = null;
      }
    })();
    return pendingPromise;
  };
}