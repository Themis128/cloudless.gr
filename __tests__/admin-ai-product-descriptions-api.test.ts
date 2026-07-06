import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { getConfigMock, getProductsMock, bedrockSendMock } = vi.hoisted(() => ({
  getConfigMock: vi.fn(),
  getProductsMock: vi.fn(),
  bedrockSendMock: vi.fn(),
}));

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: async (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT structure");
      const payload = JSON.parse(Buffer.from(parts[1]!, "base64").toString("utf-8"));
      if (payload.exp && Date.now() >= payload.exp * 1000) throw new Error("JWT expired");
      return { payload, protectedHeader: { alg: "RS256" } };
    },
  };
});

vi.mock("@/lib/ssm-config", () => ({ getConfig: getConfigMock }));
vi.mock("@/lib/store-products", () => ({ getProducts: getProductsMock }));
vi.mock("@aws-sdk/client-bedrock-runtime", async () => {
  const actual = await vi.importActual<typeof import("@aws-sdk/client-bedrock-runtime")>(
    "@aws-sdk/client-bedrock-runtime"
  );
  return {
    ...actual,
    BedrockRuntimeClient: class {
      send = bedrockSendMock;
    },
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_PRODUCTS = [
  {
    id: "srv-cloud",
    name: "Cloud Architecture Audit",
    description: "Old description for cloud audit.",
    price: 200000,
    currency: "eur",
    category: "service",
    image: "/store/cloud-audit.svg",
    features: ["Full infrastructure review", "Cost optimization report"],
  },
  {
    id: "dig-cloud-playbook",
    name: "Cloud Migration Playbook",
    description: "Old description for playbook.",
    price: 4900,
    currency: "eur",
    category: "digital",
    image: "/store/cloud-playbook.svg",
    features: ["120+ page PDF guide", "Terraform templates"],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdminToken(): string {
  const payload = {
    sub: "test-admin-sub",
    email: "admin@cloudless.gr",
    groups: ["admin"],
    aud: "test-client-id",
    iss: "https://auth.cloudless.gr/realms/cloudless",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fake-sig`;
}

function adminReq(
  url: string,
  method: "POST" | "PUT" = "POST",
  body?: Record<string, unknown>
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      Authorization: `Bearer ${makeAdminToken()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function unauthReq(url: string): NextRequest {
  return new NextRequest(url, { method: "POST" });
}

function mockBedrockResponse(text: string) {
  bedrockSendMock.mockResolvedValueOnce({
    stopReason: "end_turn",
    output: { message: { content: [{ text }] } },
  });
}

// ---------------------------------------------------------------------------
// POST /api/admin/ai/product-descriptions
// ---------------------------------------------------------------------------

describe("POST /api/admin/ai/product-descriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfigMock.mockResolvedValue({});
    getProductsMock.mockResolvedValue(MOCK_PRODUCTS);
  });

  it("returns 401 when not authenticated", async () => {
    const { POST } = await import("@/app/api/admin/ai/product-descriptions/route");
    const res = await POST(unauthReq("http://localhost/api/admin/ai/product-descriptions"));
    expect(res.status).toBe(401);
    expect(bedrockSendMock).not.toHaveBeenCalled();
  });

  it("generates descriptions for all products when no productIds given", async () => {
    mockBedrockResponse("Identify and fix cloud cost inefficiencies with a full AWS audit.");
    mockBedrockResponse("A battle-tested 120-page guide to migrating your stack to the cloud.");
    const { POST } = await import("@/app/api/admin/ai/product-descriptions/route");
    const res = await POST(adminReq("http://localhost/api/admin/ai/product-descriptions"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(2);
    expect(data.errors).toHaveLength(0);
    expect(data.results[0].id).toBe("srv-cloud");
    expect(data.results[1].id).toBe("dig-cloud-playbook");
  });

  it("generates descriptions only for requested productIds", async () => {
    mockBedrockResponse("Identify and fix cloud cost inefficiencies with a full AWS audit.");
    const { POST } = await import("@/app/api/admin/ai/product-descriptions/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/ai/product-descriptions", "POST", {
        productIds: ["srv-cloud"],
      })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].id).toBe("srv-cloud");
    expect(bedrockSendMock).toHaveBeenCalledOnce();
  });

  it("returns 400 when productIds filter matches nothing", async () => {
    const { POST } = await import("@/app/api/admin/ai/product-descriptions/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/ai/product-descriptions", "POST", {
        productIds: ["nonexistent-id"],
      })
    );
    expect(res.status).toBe(400);
    expect(bedrockSendMock).not.toHaveBeenCalled();
  });

  it("records errors for failed Bedrock calls and continues", async () => {
    bedrockSendMock.mockRejectedValueOnce(new Error("Bedrock throttled"));
    mockBedrockResponse("A battle-tested 120-page guide to migrating your stack to the cloud.");
    const { POST } = await import("@/app/api/admin/ai/product-descriptions/route");
    const res = await POST(adminReq("http://localhost/api/admin/ai/product-descriptions"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0].id).toBe("srv-cloud");
    expect(data.errors[0].error).toContain("Bedrock throttled");
  });

  it("records error when Bedrock returns empty text", async () => {
    bedrockSendMock.mockResolvedValueOnce({
      stopReason: "end_turn",
      output: { message: { content: [] } },
    });
    const { POST } = await import("@/app/api/admin/ai/product-descriptions/route");
    const res = await POST(
      adminReq("http://localhost/api/admin/ai/product-descriptions", "POST", {
        productIds: ["srv-cloud"],
      })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0].error).toContain("Empty response");
  });
});

// ---------------------------------------------------------------------------
// PUT /api/admin/ai/product-descriptions
// ---------------------------------------------------------------------------

describe("PUT /api/admin/ai/product-descriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfigMock.mockResolvedValue({});
    // Reset products to original descriptions before each test
    getProductsMock.mockResolvedValue(
      MOCK_PRODUCTS.map((p) => ({ ...p }))
    );
  });

  it("returns 401 when not authenticated", async () => {
    const { PUT } = await import("@/app/api/admin/ai/product-descriptions/route");
    const res = await PUT(unauthReq("http://localhost/api/admin/ai/product-descriptions"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when descriptions array is missing", async () => {
    const { PUT } = await import("@/app/api/admin/ai/product-descriptions/route");
    const res = await PUT(
      adminReq("http://localhost/api/admin/ai/product-descriptions", "PUT", {})
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when descriptions array is empty", async () => {
    const { PUT } = await import("@/app/api/admin/ai/product-descriptions/route");
    const res = await PUT(
      adminReq("http://localhost/api/admin/ai/product-descriptions", "PUT", {
        descriptions: [],
      })
    );
    expect(res.status).toBe(400);
  });

  it("applies descriptions to matching products and returns applied count", async () => {
    const { PUT } = await import("@/app/api/admin/ai/product-descriptions/route");
    const res = await PUT(
      adminReq("http://localhost/api/admin/ai/product-descriptions", "PUT", {
        descriptions: [
          { id: "srv-cloud", description: "New AI-generated cloud audit description." },
        ],
      })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.applied).toBe(1);
  });

  it("skips unknown product ids silently", async () => {
    const { PUT } = await import("@/app/api/admin/ai/product-descriptions/route");
    const res = await PUT(
      adminReq("http://localhost/api/admin/ai/product-descriptions", "PUT", {
        descriptions: [{ id: "nonexistent", description: "Should not apply." }],
      })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.applied).toBe(0);
  });

  it("truncates descriptions longer than 500 chars", async () => {
    const longDesc = "A".repeat(600);
    const { PUT } = await import("@/app/api/admin/ai/product-descriptions/route");
    const res = await PUT(
      adminReq("http://localhost/api/admin/ai/product-descriptions", "PUT", {
        descriptions: [{ id: "srv-cloud", description: longDesc }],
      })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.applied).toBe(1);
    // Verify the product description was truncated
    const products = await getProductsMock();
    const product = products.find((p: { id: string }) => p.id === "srv-cloud");
    expect(product?.description.length).toBeLessThanOrEqual(500);
  });
});
