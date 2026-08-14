import { expect, type APIRequestContext, type APIResponse, type TestInfo } from "@playwright/test";
import { requestUntilCompiled } from "../_internal/request-until-compiled";

export const GUEST_STORAGE = { cookies: [] as [], origins: [] as [] };

export const ADMIN_TOKEN = "e2e-admin-token-do-not-use-in-prod";

export function isMobileProject(testInfo: TestInfo): boolean {
  return testInfo.project.name === "mobile-chrome";
}

export async function api(
  request: APIRequestContext,
  method: "get" | "post" | "patch" | "put" | "delete",
  url: string,
  options: Parameters<APIRequestContext["get"]>[1] = {},
): Promise<APIResponse> {
  return requestUntilCompiled(request, method, url, options);
}

export async function expectJson(
  res: APIResponse,
): Promise<Record<string, unknown>> {
  const ct = res.headers()["content-type"] ?? "";
  expect(ct, `expected JSON from ${res.url()} (${res.status()}), got ${ct}`).toMatch(/json/i);
  const body = (await res.json()) as unknown;
  expect(body, `JSON body from ${res.url()}`).toBeTruthy();
  expect(typeof body).toBe("object");
  return body as Record<string, unknown>;
}

export function expectClientError(status: number, label: string): void {
  expect(status, label).toBeGreaterThanOrEqual(400);
  expect(status, label).toBeLessThan(500);
}

export function expectNotServerError(status: number, label: string): void {
  expect(status, `${label} must not 5xx`).toBeLessThan(500);
  expect(status, `${label} must be a real HTTP response`).toBeGreaterThanOrEqual(200);
}
