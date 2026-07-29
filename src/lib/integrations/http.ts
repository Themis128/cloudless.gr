/**
 * Shared HTTP wrapper for outbound integration calls.
 *
 * Goal: stop every integration module from rolling its own fetch wrapper.
 *
 * Provides:
 *   - configurable per-call timeout (default 10s; Lambda hard limit is 30s)
 *   - exponential-backoff retry on 429 (honors Retry-After) and 5xx
 *   - typed `IntegrationError` with status, integration name, response body
 *   - Sentry breadcrumb per call (when configured) + latency metric
 *   - opt-out flags for callers that need to handle 4xx themselves
 *
 * Usage:
 *
 *   import { integrationFetch } from "@/lib/integrations/http";
 *
 *   const data = await integrationFetch<MyResponse>("espocrm", url, {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify(payload),
 *   });
 *
 * This is phase 1 of the Integration Improvement Plan. Subsequent phases
 * migrate existing clients (notion.ts, espocrm.ts, sentry.ts, gsc.ts, …)
 * to use this wrapper.
 */

// --- Types ------------------------------------------------------------------

export interface IntegrationFetchOptions {
  /** Timeout in milliseconds. Default: 10_000. */
  timeoutMs?: number;
  /** Max retries on 429 / 5xx. Default: 3. Set to 0 to disable. */
  maxRetries?: number;
  /** Initial backoff in milliseconds (doubled each attempt). Default: 500. */
  backoffMs?: number;
  /**
   * If true, do NOT throw on non-ok responses — return the Response object
   * unchanged. Useful for callers that need to read 4xx error bodies in a
   * domain-specific way (e.g. EspoCRM's 409 conflict on upsert).
   */
  passthroughErrors?: boolean;
}

export interface IntegrationFetchResult<T> {
  data: T;
  status: number;
  /** Wall-clock latency from first request to final response, ms. */
  latencyMs: number;
  /** Number of retry attempts (0 means succeeded first try). */
  retries: number;
}

export class IntegrationError extends Error {
  constructor(
    public readonly integration: string,
    public readonly status: number,
    public readonly body: string,
    message?: string
  ) {
    super(message ?? `${integration} HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = "IntegrationError";
  }
}

// --- Internal helpers -------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse a Retry-After header. Server may send seconds (numeric) or an HTTP
 * date. Returns delay in ms, or null if unparseable.
 */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return Math.max(0, seconds) * 1000;
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - Date.now());
}

/**
 * Emit a Sentry breadcrumb if @sentry/nextjs is available at runtime. Safe
 * no-op when Sentry isn't loaded — we lazy-import so this module stays
 * lightweight in non-instrumented contexts (build-time scripts, tests).
 */
async function breadcrumb(
  integration: string,
  url: string,
  status: number,
  latencyMs: number,
  retries: number
): Promise<void> {
  try {
    const Sentry = await import("@sentry/nextjs").catch(() => null);
    if (!Sentry?.addBreadcrumb) return;
    Sentry.addBreadcrumb({
      category: `integration.${integration}`,
      type: "http",
      level: status >= 400 ? "error" : "info",
      data: {
        url,
        status,
        latencyMs,
        retries,
      },
    });
  } catch {
    // never throw from the breadcrumb path
  }
}

// Handles a non-retried response: error passthrough, 204, JSON, plain text.
// Extracted to keep integrationFetchWithMeta under the cognitive-complexity limit.
async function handleFinalResponse<T>(
  res: Response,
  integration: string,
  latencyMs: number,
  retries: number,
  passthroughErrors: boolean
): Promise<IntegrationFetchResult<T>> {
  if (!res.ok) {
    if (passthroughErrors) {
      return {
        data: (await res.json().catch(() => null)) as T,
        status: res.status,
        latencyMs,
        retries,
      };
    }
    const body = await res.text().catch(() => "");
    throw new IntegrationError(integration, res.status, body);
  }
  if (res.status === 204) {
    return { data: undefined as unknown as T, status: 204, latencyMs, retries };
  }
  const contentType = res.headers.get("content-type") ?? "";
  const data: T = contentType.includes("application/json")
    ? ((await res.json()) as T)
    : ((await res.text()) as unknown as T);
  return { data, status: res.status, latencyMs, retries };
}

// --- Public API -------------------------------------------------------------

/**
 * Fetch a JSON response from an integration with retry, timeout, and
 * structured error handling.
 *
 * @throws {IntegrationError} on non-ok responses (unless passthroughErrors).
 * @throws {Error} on timeout, network failures, or invalid JSON.
 */
export async function integrationFetch<T = unknown>(
  integration: string,
  url: string,
  init?: RequestInit,
  opts?: IntegrationFetchOptions
): Promise<T> {
  const result = await integrationFetchWithMeta<T>(integration, url, init, opts);
  return result.data;
}

/**
 * Same as integrationFetch but returns latency, retry count, and final
 * status alongside the parsed body. Useful when the caller wants to log
 * or branch on metadata.
 */
export async function integrationFetchWithMeta<T = unknown>(
  integration: string,
  url: string,
  init?: RequestInit,
  opts?: IntegrationFetchOptions
): Promise<IntegrationFetchResult<T>> {
  const timeoutMs = opts?.timeoutMs ?? 10_000;
  const maxRetries = opts?.maxRetries ?? 3;
  const backoffMs = opts?.backoffMs ?? 500;
  const passthroughErrors = opts?.passthroughErrors ?? false;

  const started = Date.now();
  let retries = 0;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const reqInit: RequestInit = {
      ...init,
      // Always create a fresh timeout signal per attempt. Reusing a
      // caller-supplied signal that already aborted would cause every
      // retry to fail immediately without any network attempt.
      signal: AbortSignal.timeout(timeoutMs),
    };

    let res: Response;
    try {
      res = await fetch(url, reqInit);
    } catch (err) {
      lastError = err;
      // Network error or abort — backoff and retry unless we're at the limit
      if (attempt < maxRetries) {
        retries++;
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
      const latencyMs = Date.now() - started;
      await breadcrumb(integration, url, 0, latencyMs, retries);
      throw err;
    }

    // 429 / 5xx: retry with exponential backoff (429 honors Retry-After)
    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
      const ra = res.status === 429 ? parseRetryAfter(res.headers.get("Retry-After")) : null;
      retries++;
      await sleep(ra ?? backoffMs * 2 ** attempt);
      continue;
    }

    const latencyMs = Date.now() - started;
    await breadcrumb(integration, url, res.status, latencyMs, retries);
    return handleFinalResponse<T>(res, integration, latencyMs, retries, passthroughErrors);
  }

  // Exhausted retries on 429/5xx — fall through to throw
  const latencyMs = Date.now() - started;
  await breadcrumb(integration, url, 0, latencyMs, retries);
  if (lastError) throw lastError;
  throw new Error(`${integration}: max retries (${maxRetries}) exceeded on ${url}`);
}

/**
 * Convenience: returns true if an error is an IntegrationError with a
 * specific status code. Type-narrows.
 */
export function isIntegrationError(err: unknown, status?: number): err is IntegrationError {
  if (!(err instanceof IntegrationError)) return false;
  if (status === undefined) return true;
  return err.status === status;
}
