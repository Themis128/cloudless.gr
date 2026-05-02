import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const SUBSCRIPTIONS_URL = "http://localhost/api/admin/subscriptions";
const TEST_SUB_ID = "sub_test_1";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockSubsList, mockSubsUpdate, mockPortalCreate } = vi.hoisted(() => ({
  mockSubsList: vi.fn(),
  mockSubsUpdate: vi.fn(),
  mockPortalCreate: vi.fn(),
}));

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: async (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT");
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      return { payload, protectedHeader: { alg: "RS256" } };
    },
  };
});

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn().mockResolvedValue({
    subscriptions: { list: mockSubsList, update: mockSubsUpdate },
    billingPortal: { sessions: { create: mockPortalCreate } },
  }),
}));

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
function makeAdminToken(): string {
  const payload = {
    sub: "admin-sub",
    "cognito:groups": ["admin"],
    aud: "client",
    iss: "https://cognito-idp.us-east-1.amazonaws.com/pool",
    iat: Math.floor(Date.now() / 1000) - 10,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const h = Buffer.from("{}").toString("base64url");
  const b = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${h}.${b}.sig`;
}

function makeUserToken(): string {
  const payload = {
    sub: "user-sub",
    "cognito:groups": [],
    aud: "client",
    iss: "https://cognito-idp.us-east-1.amazonaws.com/pool",
    iat: Math.floor(Date.now() / 1000) - 10,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const h = Buffer.from("{}").toString("base64url");
  const b = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${h}.${b}.sig`;
}

function adminReq(url: string, init?: { method?: string; body?: string }): NextRequest {
  const headers = new Headers({ Authorization: `Bearer ${makeAdminToken()}` });
  if (init?.body) headers.set("Content-Type", "application/json");
  return new NextRequest(url, { method: init?.method, body: init?.body, headers });
}

function userReq(url: string): NextRequest {
  return new NextRequest(url, { headers: { Authorization: `Bearer ${makeUserToken()}` } });
}

const MOCK_SUB = {
  id: TEST_SUB_ID,
  customer: { id: "cus_test_1", email: "customer@test.com", name: "Test Customer" },
  status: "active",
  items: {
    data: [{
      price: {
        unit_amount: 4900,
        currency: "eur",
        recurring: { interval: "month" },
        nickname: null,
        product: { name: "Pro Plan" },
      },
    }],
  },
  current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
  cancel_at_period_end: false,
  created: Math.floor(Date.now() / 1000) - 86400,
};

// ---------------------------------------------------------------------------
// Tests — GET
// ---------------------------------------------------------------------------
describe("GET /api/admin/subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubsList.mockResolvedValue({ data: [MOCK_SUB], has_more: false });
  });

  it("returns 401 without token", async () => {
    const { GET } = await import("@/app/api/admin/subscriptions/route");
    const res = await GET(new NextRequest(SUBSCRIPTIONS_URL));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    const { GET } = await import("@/app/api/admin/subscriptions/route");
    const res = await GET(userReq(SUBSCRIPTIONS_URL));
    expect(res.status).toBe(403);
  });

  it("returns subscriptions list for admin", async () => {
    const { GET } = await import("@/app/api/admin/subscriptions/route");
    const res = await GET(adminReq(SUBSCRIPTIONS_URL));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.subscriptions)).toBe(true);
    expect(typeof data.hasMore).toBe("boolean");
    expect(typeof data.total).toBe("number");
    const sub = data.subscriptions[0];
    expect(sub.id).toBe(TEST_SUB_ID);
    expect(sub.status).toBe("active");
    expect(sub.planName).toBe("Pro Plan");
    expect(sub.amount).toBe(4900);
    expect(sub.currency).toBe("EUR");
    expect(sub.interval).toBe("month");
  });

  it("passes status filter to Stripe", async () => {
    const { GET } = await import("@/app/api/admin/subscriptions/route");
    await GET(adminReq("http://localhost/api/admin/subscriptions?status=past_due"));
    expect(mockSubsList).toHaveBeenCalledWith(expect.objectContaining({ status: "past_due" }));
  });

  it("passes all status as undefined to Stripe", async () => {
    const { GET } = await import("@/app/api/admin/subscriptions/route");
    await GET(adminReq("http://localhost/api/admin/subscriptions?status=all"));
    expect(mockSubsList).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
  });

  it("caps limit at 100", async () => {
    const { GET } = await import("@/app/api/admin/subscriptions/route");
    await GET(adminReq("http://localhost/api/admin/subscriptions?limit=500"));
    expect(mockSubsList).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });
});

// ---------------------------------------------------------------------------
// Tests — POST (actions)
// ---------------------------------------------------------------------------
describe("POST /api/admin/subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPortalCreate.mockResolvedValue({ url: "https://billing.stripe.com/session/test" });
    mockSubsUpdate.mockResolvedValue({ id: TEST_SUB_ID, cancel_at_period_end: true });
  });

  it("returns 400 for invalid action", async () => {
    const { POST } = await import("@/app/api/admin/subscriptions/route");
    const res = await POST(adminReq(SUBSCRIPTIONS_URL, {
      method: "POST",
      body: JSON.stringify({ action: "refund" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns portal URL for portal action", async () => {
    const { POST } = await import("@/app/api/admin/subscriptions/route");
    const res = await POST(adminReq(SUBSCRIPTIONS_URL, {
      method: "POST",
      body: JSON.stringify({ action: "portal", customerId: "cus_test_1" }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toContain("billing.stripe.com");
  });

  it("cancels subscription at period end", async () => {
    const { POST } = await import("@/app/api/admin/subscriptions/route");
    const res = await POST(adminReq(SUBSCRIPTIONS_URL, {
      method: "POST",
      body: JSON.stringify({ action: "cancel", subscriptionId: TEST_SUB_ID }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.cancelAtPeriodEnd).toBe(true);
    expect(mockSubsUpdate).toHaveBeenCalledWith(TEST_SUB_ID, { cancel_at_period_end: true });
  });
});
