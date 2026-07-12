import { test as base, expect, type APIRequestContext } from "@playwright/test";

// Use environment variable for admin token in production, fallback to mock token for local dev
export const ADMIN_TOKEN = process.env.E2E_ADMIN_TOKEN ?? "e2e-admin-token-do-not-use-in-prod";

/** Returns request context that always sends the E2E admin Bearer token. */
export async function adminRequest(request: APIRequestContext) {
  return {
    get: (url: string) => request.get(url, { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } }),
    post: (url: string, data?: unknown) =>
      request.post(url, {
        headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
        data: data ?? {},
      }),
    delete: (url: string) =>
      request.delete(url, { headers: { authorization: `Bearer ${ADMIN_TOKEN}` } }),
    put: (url: string, data?: unknown) =>
      request.put(url, {
        headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
        data: data ?? {},
      }),
    patch: (url: string, data?: unknown) =>
      request.patch(url, {
        headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
        data: data ?? {},
      }),
  };
}

export { base as test, expect };