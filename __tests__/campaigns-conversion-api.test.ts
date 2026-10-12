import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn().mockResolvedValue(null),
}));

const mockCreateLead = vi.fn().mockResolvedValue("lead-1");
vi.mock("@/lib/espocrm", () => ({
  createLead: (...args: unknown[]) => mockCreateLead(...args),
}));

const mockDispatch = vi.fn().mockResolvedValue({
  noop: false,
  capi: [{ platform: "linkedin", accepted: true, status: 200 }],
  notifications: [],
});
vi.mock("@/lib/ad-analytics/runtime", () => ({
  dispatchConversion: (...args: unknown[]) => mockDispatch(...args),
}));

import { POST } from "@/app/api/campaigns/conversion/route";

function req(body: unknown): NextRequest {
  return new NextRequest("https://cloudless.gr/api/campaigns/conversion", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateLead.mockResolvedValue("lead-1");
  mockDispatch.mockResolvedValue({
    noop: false,
    capi: [{ platform: "linkedin", accepted: true, status: 200 }],
    notifications: [],
  });
});

describe("POST /api/campaigns/conversion", () => {
  it("creates an EspoCRM Lead for lead-* orderIds when customer.email is present", async () => {
    const res = await POST(
      req({
        campaign: "shop-online",
        tier: "starter",
        orderId: "lead-12345",
        conversionId: 26846068,
        customer: { name: "Ada Lovelace", email: "ada@shop.gr", phone: "+30111" },
        utm: { source: "linkedin", medium: "cpc", campaign: "shop_online_founding" },
      })
    );
    expect(res.status).toBe(200);
    expect(mockCreateLead).toHaveBeenCalledTimes(1);
    const arg = mockCreateLead.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg.emailAddress).toBe("ada@shop.gr");
    expect(arg.firstName).toBe("Ada");
    expect(arg.lastName).toBe("Lovelace");
    expect(arg.campaignSlug).toBe("shop-online");
    expect(arg.tier).toBe("starter");
    expect(arg.orderId).toBe("lead-12345");
    expect(arg.utmSource).toBe("linkedin");
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it("skips createLead when no customer email", async () => {
    const res = await POST(
      req({
        campaign: "shop-online",
        tier: "starter",
        orderId: "lead-999",
      })
    );
    expect(res.status).toBe(200);
    expect(mockCreateLead).not.toHaveBeenCalled();
  });

  it("returns 400 without campaign", async () => {
    const res = await POST(req({ tier: "starter" }));
    expect(res.status).toBe(400);
  });
});

describe("conversion route tails", () => {
  it("400 on unparseable JSON", async () => {
    const bad = new NextRequest("https://cloudless.gr/api/campaigns/conversion", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{broken",
    });
    const res = await POST(bad);
    expect(res.status).toBe(400);
  });

  it("204 when dispatchConversion returns noop", async () => {
    mockDispatch.mockResolvedValueOnce({ noop: true, capi: [], notifications: [] });
    const res = await POST(req({ campaign: "shop-online" }));
    expect(res.status).toBe(204);
  });

  it("enriches customer from a cs_ Stripe session and mirrors the lead", async () => {
    const { getStripe } = await import("@/lib/stripe");
    (getStripe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      checkout: {
        sessions: {
          retrieve: vi.fn().mockResolvedValue({
            customer_details: { name: "Grace Hopper", email: "grace@navy.mil", phone: "+1" },
          }),
        },
      },
    });
    const res = await POST(req({ campaign: "shop-online", orderId: "cs_test_1" }));
    expect(res.status).toBe(200);
    const arg = mockCreateLead.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(arg.emailAddress).toBe("grace@navy.mil");
    expect(arg.firstName).toBe("Grace");
    expect(arg.lastName).toBe("Hopper");
  });

  it("Stripe retrieve failure still completes the conversion", async () => {
    const { getStripe } = await import("@/lib/stripe");
    (getStripe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      checkout: { sessions: { retrieve: vi.fn().mockRejectedValue(new Error("stripe down")) } },
    });
    const res = await POST(req({ campaign: "shop-online", orderId: "cs_test_2" }));
    expect(res.status).toBe(200);
    expect(mockCreateLead).not.toHaveBeenCalled();
  });

  it("nameless customer → lead without firstName; cf/xff headers reach dispatch", async () => {
    const headers = new Headers({
      "content-type": "application/json",
      "cf-ipcountry": "GR",
      "x-forwarded-for": "1.2.3.4, 5.6.7.8",
    });
    const r = new NextRequest("https://cloudless.gr/api/campaigns/conversion", {
      method: "POST",
      headers,
      body: JSON.stringify({
        campaign: "shop-online",
        orderId: "lead-1",
        customer: { email: "noname@x.gr" },
      }),
    });
    const res = await POST(r);
    expect(res.status).toBe(200);
    const lead = mockCreateLead.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(lead.firstName).toBeUndefined();
    const dispatch = mockDispatch.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(dispatch.country).toBe("GR");
    expect(dispatch.ipAddress).toBe("1.2.3.4");
  });
});
