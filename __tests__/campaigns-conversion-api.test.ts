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
