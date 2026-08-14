import { test as base, expect, type APIRequestContext } from "@playwright/test";
import { requestUntilCompiled } from "./request-until-compiled";

export const ADMIN_TOKEN = "e2e-admin-token-do-not-use-in-prod";

/** Returns request context that always sends the E2E admin Bearer token. */
export async function adminRequest(request: APIRequestContext) {
  const authHeaders = { authorization: `Bearer ${ADMIN_TOKEN}` };
  return {
    get: (url: string) =>
      requestUntilCompiled(request, "get", url, { headers: authHeaders }),
    post: (url: string, data?: unknown) =>
      requestUntilCompiled(request, "post", url, {
        headers: authHeaders,
        data: data ?? {},
      }),
    put: (url: string, body?: unknown) => {
      // Some specs pass `{ data: {} }` (Playwright-like options). Accept both:
      // - `put(url, {})` → body is `{}`.
      // - `put(url, { data: {} })` → body is `{}`.
      const payload =
        body && typeof body === "object" && "data" in body
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (body as any).data
          : body;
      return requestUntilCompiled(request, "put", url, {
        headers: authHeaders,
        data: payload ?? {},
      });
    },
    delete: (url: string) =>
      requestUntilCompiled(request, "delete", url, { headers: authHeaders }),
    patch: (url: string, data?: unknown) =>
      requestUntilCompiled(request, "patch", url, {
        headers: authHeaders,
        data: data ?? {},
      }),
  };
}

export { base as test, expect };
