import type { APIRequestContext, APIResponse } from "@playwright/test";

/**
 * Turbopack under parallel e2e load can return a transient 404 for routes that
 * have not finished compiling. Retry until we get a real status (or attempts
 * are exhausted). Never treat 404 as an acceptable auth outcome by itself —
 * callers still assert 401/403 after a stable response.
 */
export async function requestUntilCompiled(
  request: APIRequestContext,
  method: "get" | "post" | "patch" | "put" | "delete",
  url: string,
  options: Parameters<APIRequestContext["get"]>[1] = {},
  attempts = 16
): Promise<APIResponse> {
  let last: APIResponse | undefined;
  for (let i = 0; i < attempts; i++) {
    last = await request[method](url, { ...options, failOnStatusCode: false });
    if (last.status() !== 404) return last;
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return last!;
}
