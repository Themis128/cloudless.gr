import { test as base, expect, type APIRequestContext } from "@playwright/test";

export const ADMIN_TOKEN = "e2e-admin-token-do-not-use-in-prod";

/** Returns request context that always sends the E2E admin Bearer token. */
export async function adminRequest(request: APIRequestContext) {
  return {
    get: (url: string) => request.get(url, { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } }),
    post: (url: string, data?: unknown) =>
      request.post(url, {
        headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
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
      return request.put(url, {
        headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
        data: payload ?? {},
      });
    },
    delete: (url: string) =>
      request.delete(url, { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } }),
    patch: (url: string, data?: unknown) =>
      request.patch(url, {
        headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
        data: data ?? {},
      }),
  };
}

export { base as test, expect };
