import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations", () => ({
  getIntegrationsAsync: vi.fn(),
}));

import { getIntegrationsAsync } from "@/lib/integrations";
import { createLead } from "@/lib/espocrm";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...(init ?? {}),
  });
}

describe("EspoCRM createLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIntegrationsAsync).mockResolvedValue({
      ESPOCRM_BASE_URL: "https://espo.example",
      ESPOCRM_API_KEY: "espo-test-key",
    } as never);
  });

  it("includes data.description in the payload description when provided", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        // Dedup search: no existing leads
        .mockResolvedValueOnce(jsonResponse({ list: [] }))
        // Create lead
        .mockResolvedValueOnce(jsonResponse({ id: "lead-xyz" }))
    );

    const id = await createLead({
      emailAddress: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      source: "Other",
      campaignSlug: "socialauto-facebook_messenger",
      utmSource: "socialauto",
      description: "Source: facebook_messenger (Facebook Messenger)\nThread ID: t_123",
    });

    expect(id).toBe("lead-xyz");
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);

    const init = vi.mocked(globalThis.fetch).mock.calls[1]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(String(body.description)).toContain("Source: facebook_messenger (Facebook Messenger)");
    expect(String(body.description)).toContain("Thread ID: t_123");
    expect(String(body.description)).toContain("Campaign: socialauto-facebook_messenger");
    expect(String(body.description)).toContain("utm_source: socialauto");
  });
});

