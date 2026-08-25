/**
 * Mock NextRequest helper for unit testing middleware.
 * Uses the mocked NextRequest from the test's vi.mock() setup.
 */
export function mockRequest({ url, headers = {} }: { url: string; headers?: Record<string, string> }) {
  const { NextRequest } = require("next/server");
  return new NextRequest(url, {
    method: "GET",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}