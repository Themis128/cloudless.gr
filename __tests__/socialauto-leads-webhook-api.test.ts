import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn(),
}));

const mockCreateLead = vi.fn();
vi.mock("@/lib/espocrm", () => ({
  createLead: (...args: unknown[]) => mockCreateLead(...args),
}));

import { getConfig } from "@/lib/ssm-config";
import { POST } from "@/app/api/webhooks/socialauto-leads/route";

const SECRET = "socialauto-test-secret";

function req(headers: Record<string, string>, body: unknown): NextRequest {
  return new NextRequest("https://cloudless.gr/api/webhooks/socialauto-leads", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getConfig).mockResolvedValue({
    SOCIALAUTO_LEADS_WEBHOOK_SECRET: SECRET,
  } as never);
  mockCreateLead.mockResolvedValue("lead-123");
});

describe("POST /api/webhooks/socialauto-leads", () => {
  it("returns 401 without a secret", async () => {
    const res = await POST(req({}, { source: "whatsapp_dm", name: "A B", email: "a@b.com" }));
    expect(res.status).toBe(401);
  });

  it("returns 503 when no secret is configured", async () => {
    vi.mocked(getConfig).mockResolvedValue({ SOCIALAUTO_LEADS_WEBHOOK_SECRET: "" } as never);
    const res = await POST(
      req(
        { "x-socialauto-webhook-secret": "anything" },
        { source: "whatsapp_dm", name: "A B", email: "a@b.com" }
      )
    );
    expect(res.status).toBe(503);
  });

  it("accepts a single lead and calls createLead with mapped fields", async () => {
    const res = await POST(
      req(
        { "x-socialauto-webhook-secret": SECRET },
        {
          source: "facebook_messenger",
          name: "Ada Lovelace",
          email: "ada@example.com",
          interest: "cloud",
          company_size: "11-50",
          notes: "Asked about pricing",
          thread_id: "t_123",
          social_account_id: "sa_456",
          id: "lead_ext_1",
          created_at: "2026-09-13T08:00:00Z",
          meta_data: { foo: "bar" },
        }
      )
    );

    expect(res.status).toBe(200);
    expect(mockCreateLead).toHaveBeenCalledTimes(1);
    const call = mockCreateLead.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.emailAddress).toBe("ada@example.com");
    expect(call.firstName).toBe("Ada");
    expect(call.lastName).toBe("Lovelace");
    expect(call.source).toBe("Messenger");
    expect(call.campaignSlug).toBe("socialauto-facebook_messenger");
    expect(String(call.description)).toContain("Interest: cloud");

    const payload = await res.json();
    expect(payload.ok).toBe(true);
    expect(payload.results).toEqual([{ ok: true, espocrm_lead_id: "lead-123" }]);
  });

  it("accepts a batch array and returns per-item results", async () => {
    mockCreateLead.mockResolvedValueOnce("lead-1").mockResolvedValueOnce(null);
    const res = await POST(
      req(
        { Authorization: `Bearer ${SECRET}` },
        [
          { source: "whatsapp_flow", name: "First User", email: "first@example.com" },
          { source: "instagram_dm", name: "Second User", email: "second@example.com" },
        ]
      )
    );

    expect(res.status).toBe(200);
    expect(mockCreateLead).toHaveBeenCalledTimes(2);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.results).toEqual([
      { ok: true, espocrm_lead_id: "lead-1" },
      { ok: false, espocrm_lead_id: null },
    ]);
  });
});

