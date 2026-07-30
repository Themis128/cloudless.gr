import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  const { NextResponse } = await import("next/server");
  const adminUser = {
    sub: "test-admin-sub",
    email: "admin@cloudless.gr",
    groups: ["admin"],
    email_verified: true,
  };
  const plainUser = {
    sub: "test-user-sub",
    email: "user@cloudless.gr",
    groups: [] as string[],
    email_verified: true,
  };

  function userFromRequest(request: { headers: { get: (k: string) => string | null } }) {
    const h = request.headers.get("authorization") ?? "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    if (token === "test-admin-session") return adminUser;
    if (token === "test-user-session") return plainUser;
    // Allow email-bearing opaque tokens used by user-route tests: "user-session:<email>"
    if (token.startsWith("user-session:")) {
      const email = token.slice("user-session:".length) || "user@cloudless.gr";
      return { ...plainUser, email, sub: `user-${email}` };
    }
    if (token.startsWith("admin-session:")) {
      const email = token.slice("admin-session:".length) || "admin@cloudless.gr";
      return { ...adminUser, email, sub: `admin-${email}` };
    }
    return null;
  }

  return {
    ...actual,
    requireAuth: async (request: Parameters<typeof actual.requireAuth>[0]) => {
      const user = userFromRequest(request);
      if (user) return { ok: true as const, user };
      return actual.requireAuth(request);
    },
    requireAdmin: async (request: Parameters<typeof actual.requireAdmin>[0]) => {
      const user = userFromRequest(request);
      if (!user) return actual.requireAdmin(request);
      if (!user.groups.includes("admin")) {
        return {
          ok: false as const,
          response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
        };
      }
      return { ok: true as const, user };
    },
    requireVerifiedAuth: async (request: Parameters<typeof actual.requireVerifiedAuth>[0]) => {
      const user = userFromRequest(request);
      if (user) return { ok: true as const, user };
      return actual.requireVerifiedAuth(request);
    },
  };
});
// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const {
  cognitoSendMock,
  getStripeMock,
  isSentryConfiguredMock,
  getUnresolvedIssuesMock,
  verifySentryTokenMock,
} = vi.hoisted(() => ({
  cognitoSendMock: vi.fn(),
  getStripeMock: vi.fn(),
  isSentryConfiguredMock: vi.fn(),
  getUnresolvedIssuesMock: vi.fn(),
  verifySentryTokenMock: vi.fn().mockResolvedValue({ status: "error" }),
}));

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: async (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT structure");
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      if (payload.exp && Date.now() >= payload.exp * 1000) throw new Error("JWT expired");
      return { payload, protectedHeader: { alg: "RS256" } };
    },
  };
});

vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: class {
    send(cmd: unknown) {
      return cognitoSendMock(cmd);
    }
  },
  ListUsersCommand: class {
    constructor(public input: unknown) {}
  },
  AdminDisableUserCommand: class {
    constructor(public input: unknown) {}
  },
  AdminEnableUserCommand: class {
    constructor(public input: unknown) {}
  },
  AdminAddUserToGroupCommand: class {
    constructor(public input: unknown) {}
  },
  AdminRemoveUserFromGroupCommand: class {
    constructor(public input: unknown) {}
  },
  AdminListGroupsForUserCommand: class {
    constructor(public input: unknown) {}
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: getStripeMock,
}));

vi.mock("@/lib/sentry", () => ({
  isSentryConfigured: isSentryConfiguredMock,
  getUnresolvedIssues: getUnresolvedIssuesMock,
  verifySentryToken: verifySentryTokenMock,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeAdminToken(): string {
  return "test-admin-session";
}

function adminReq(url: string, opts?: { method?: string; body?: unknown }): NextRequest {
  return new NextRequest(url, {
    method: opts?.method ?? "GET",
    headers: { Authorization: `Bearer ${makeAdminToken()}`, "Content-Type": "application/json" },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
}

function unauthReq(url: string): NextRequest {
  return new NextRequest(url);
}

// ---------------------------------------------------------------------------
// GET /api/admin/users
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// GET /api/admin/orders
// ---------------------------------------------------------------------------
describe("GET /api/admin/orders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/orders/route");
    const res = await GET(unauthReq("http://localhost/api/admin/orders"));
    expect(res.status).toBe(401);
    expect(getStripeMock).not.toHaveBeenCalled();
  });

  it("returns orders and subscriptions from Stripe", async () => {
    const stripeMock = {
      checkout: {
        sessions: {
          list: vi.fn().mockResolvedValue({
            data: [
              {
                id: "cs_test_1",
                customer_email: "buyer@test.com",
                customer_details: { email: "buyer@test.com" },
                amount_total: 9900,
                currency: "eur",
                payment_status: "paid",
                mode: "payment",
                line_items: {
                  data: [{ description: "AI Package", quantity: 1, amount_total: 9900 }],
                },
                created: Math.floor(Date.now() / 1000),
              },
            ],
          }),
        },
      },
      subscriptions: {
        list: vi.fn().mockResolvedValue({
          data: [],
        }),
      },
    };
    getStripeMock.mockResolvedValue(stripeMock);

    const { GET } = await import("@/app/api/admin/orders/route");
    const res = await GET(adminReq("http://localhost/api/admin/orders"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.orders).toHaveLength(1);
    expect(data.orders[0].email).toBe("buyer@test.com");
    expect(data.orders[0].amount).toBe(99);
    expect(data.subscriptions).toHaveLength(0);
  });

  it("returns 500 when Stripe throws", async () => {
    getStripeMock.mockRejectedValue(new Error("Stripe unavailable"));
    const { GET } = await import("@/app/api/admin/orders/route");
    const res = await GET(adminReq("http://localhost/api/admin/orders"));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/ops/errors
// ---------------------------------------------------------------------------
describe("GET /api/admin/ops/errors", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/ops/errors/route");
    const res = await GET(unauthReq("http://localhost/api/admin/ops/errors"));
    expect(res.status).toBe(401);
    expect(isSentryConfiguredMock).not.toHaveBeenCalled();
  });

  it("returns 503 when Sentry not configured", async () => {
    isSentryConfiguredMock.mockReturnValue(false);
    const { GET } = await import("@/app/api/admin/ops/errors/route");
    const res = await GET(adminReq("http://localhost/api/admin/ops/errors"));
    const data = await res.json();
    expect(res.status).toBe(503);
    expect(data.error).toMatch(/Sentry not configured/i);
  });

  it("returns 502 when Sentry returns null", async () => {
    isSentryConfiguredMock.mockReturnValue(true);
    getUnresolvedIssuesMock.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/ops/errors/route");
    const res = await GET(adminReq("http://localhost/api/admin/ops/errors"));
    expect(res.status).toBe(502);
  });

  it("returns issues from Sentry", async () => {
    isSentryConfiguredMock.mockReturnValue(true);
    getUnresolvedIssuesMock.mockResolvedValue({
      issues: [{ id: "err-1", title: "TypeError: Cannot read undefined", count: 5 }],
      total: 1,
    });
    const { GET } = await import("@/app/api/admin/ops/errors/route");
    const res = await GET(adminReq("http://localhost/api/admin/ops/errors"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.issues).toHaveLength(1);
    expect(data.issues[0].title).toContain("TypeError");
  });
});
