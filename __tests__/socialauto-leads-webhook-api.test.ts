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
    expect(call.source).toBe("Other");
    expect(call.campaignSlug).toBe("socialauto-facebook_messenger");
    expect(String(call.description)).toContain("Interest: cloud");
    expect(String(call.description)).toContain("Facebook Messenger");

    const payload = await res.json();
    expect(payload.ok).toBe(true);
    expect(payload.results).toEqual([{ ok: true, espocrm_lead_id: "lead-123" }]);
  });

  it("accepts the SocialAuto envelope shape with lead field", async () => {
    const res = await POST(
      req(
        { "x-socialauto-webhook-secret": SECRET },
        {
          event: "lead.upserted",
          operation: "created",
          lead: {
            source: "instagram_dm",
            name: "Grace Hopper",
            email: "grace@example.com",
            interest: "growth",
          },
        }
      )
    );

    expect(res.status).toBe(200);
    expect(mockCreateLead).toHaveBeenCalledTimes(1);
    const call = mockCreateLead.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.emailAddress).toBe("grace@example.com");
    expect(call.source).toBe("Other");
    expect(call.campaignSlug).toBe("socialauto-instagram_dm");
    expect(String(call.description)).toContain("Instagram DM");

    const payload = await res.json();
    expect(payload.ok).toBe(true);
    expect(payload.results).toEqual([{ ok: true, espocrm_lead_id: "lead-123" }]);
  });

  it("accepts envelope shape with leads array", async () => {
    mockCreateLead.mockResolvedValueOnce("lead-1").mockResolvedValueOnce("lead-2");
    const res = await POST(
      req(
        { "x-socialauto-webhook-secret": SECRET },
        {
          leads: [
            { source: "whatsapp_dm", name: "First User", email: "first@example.com" },
            { source: "facebook_messenger", name: "Second User", email: "second@example.com" },
          ],
        }
      )
    );

    expect(res.status).toBe(200);
    expect(mockCreateLead).toHaveBeenCalledTimes(2);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.results).toEqual([
      { ok: true, espocrm_lead_id: "lead-1" },
      { ok: true, espocrm_lead_id: "lead-2" },
    ]);
  });

  it("accepts a batch array and returns per-item results", async () => {
    mockCreateLead.mockResolvedValueOnce("lead-1").mockResolvedValueOnce(null);
    const res = await POST(
      req(
        { Authorization: `Bearer ${SECRET}` },
        [
          { source: "whatsapp_flow", name: "First User", email: "first@example.com" },
          {
            event: "lead.upserted",
            operation: "updated",
            lead: { source: "instagram_dm", name: "Second User", email: "second@example.com" },
          },
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

  it("accepts website-source leads and maps them to the Web Site enum", async () => {
    const res = await POST(
      req(
        { "x-socialauto-webhook-secret": SECRET },
        {
          source: "website",
          name: "Contact Form User",
          email: "contact@cloudless.gr",
          notes: "Requested a cloud audit",
        }
      )
    );

    expect(res.status).toBe(200);
    expect(mockCreateLead).toHaveBeenCalledTimes(1);
    const call = mockCreateLead.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.emailAddress).toBe("contact@cloudless.gr");
    expect(call.source).toBe("Web Site");
    expect(call.campaignSlug).toBe("socialauto-website");
    expect(String(call.description)).toContain("website (Website)");

    const payload = await res.json();
    expect(payload.results).toEqual([{ ok: true, espocrm_lead_id: "lead-123" }]);
  });
});


describe("POST /api/webhooks/socialauto-leads tails", () => {
  const auth = { "x-socialauto-webhook-secret": "socialauto-test-secret" };
  const lead = { source: "whatsapp_dm", name: "A B", email: "a@b.com" };

  it("rejects a wrong secret and GET requests", async () => {
    const { GET } = await import("@/app/api/webhooks/socialauto-leads/route");
    expect((await GET()).status).toBe(405);

    const res = await POST(req({ "x-socialauto-webhook-secret": "wrong" }, lead));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
  });

  it("rejects invalid JSON and empty item lists", async () => {
    const bad = new NextRequest("https://cloudless.gr/api/webhooks/socialauto-leads", {
      method: "POST",
      headers: { "content-type": "application/json", ...auth },
      body: "{broken",
    });
    expect((await POST(bad)).status).toBe(400);

    const res = await POST(req(auth, []));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, results: [] });
  });

  it("marks unrecognised and non-lead candidates invalid in the results", async () => {
    const res = await POST(
      req(auth, [{ other: 1 }, { source: "not_a_lead", name: "X" }, lead])
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toEqual([
      { ok: false, espocrm_lead_id: null },
      { ok: false, espocrm_lead_id: null },
      { ok: true, espocrm_lead_id: "lead-123" },
    ]);
  });

  it("rejects batches over 100 items", async () => {
    const res = await POST(req(auth, Array.from({ length: 101 }, () => lead)));
    expect(res.status).toBe(413);
  });

  it("returns ok:false when the mapped lead lacks an email", async () => {
    const res = await POST(req(auth, { source: "whatsapp_dm", name: "No Email" }));
    const data = await res.json();
    expect(data.results[0]).toEqual({ ok: false, espocrm_lead_id: null });
    expect(mockCreateLead).not.toHaveBeenCalled();
  });
});
