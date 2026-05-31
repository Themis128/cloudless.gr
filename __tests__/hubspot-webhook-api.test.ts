import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getIntegrationsAsyncMock = vi.fn();

vi.mock("@/lib/integrations", () => ({
  getIntegrationsAsync: getIntegrationsAsyncMock,
}));

function makeRequest(body: string): NextRequest {
  return new NextRequest("http://localhost/api/webhooks/hubspot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/webhooks/hubspot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed with 401 when HUBSPOT_CLIENT_SECRET is not configured", async () => {
    getIntegrationsAsyncMock.mockResolvedValue({
      HUBSPOT_CLIENT_SECRET: "",
      HUBSPOT_API_KEY: "",
    });

    const { POST } = await import("@/app/api/webhooks/hubspot/route");
    const res = await POST(makeRequest(JSON.stringify([])));

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Webhook not configured");
  });

  it("rejects with 401 when the signature is missing or invalid", async () => {
    getIntegrationsAsyncMock.mockResolvedValue({
      HUBSPOT_CLIENT_SECRET: "test_client_secret",
      HUBSPOT_API_KEY: "",
    });

    const { POST } = await import("@/app/api/webhooks/hubspot/route");
    // No x-hubspot-signature-v3 header → verification fails.
    const res = await POST(makeRequest(JSON.stringify([])));

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Invalid signature");
  });
});
