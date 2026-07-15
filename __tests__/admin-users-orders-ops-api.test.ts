import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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
    send(cmd: unknown) { return cognitoSendMock(cmd); }
  },
  ListUsersCommand: class { constructor(public input: unknown) {} },
  AdminDisableUserCommand: class { constructor(public input: unknown) {} },
  AdminEnableUserCommand: class { constructor(public input: unknown) {} },
  AdminAddUserToGroupCommand: class { constructor(public input: unknown) {} },
  AdminRemoveUserFromGroupCommand: class { constructor(public input: unknown) {} },
  AdminListGroupsForUserCommand: class { constructor(public input: unknown) {} },
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
  const payload = {
    sub: "test-admin-sub",
    email: "admin@cloudless.gr",
    "cognito:groups": ["admin"],
    token_use: "id",
    aud: "test-client-id",
    iss: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TestPool",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fake-sig`;
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
describe("GET /api/admin/users", () => {
  const kcUsers = [
    { id: "uuid-1", username: "u1", email: "user@test.com",
      firstName: "Test", lastName: "User", emailVerified: true,
      enabled: true, createdTimestamp: Date.now() },
    { id: "uuid-admin", username: "adm", email: "admin@cloudless.gr",
      emailVerified: true, enabled: true, createdTimestamp: Date.now() },
  ];

  function mockFetch(adminGroups: string[] = []) {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/token")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ access_token: "tok" }) });
      }
      if (/\/users\?/.exec(String(url))) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(kcUsers) });
      }
      if (String(url).includes("/groups")) {
        const isAdmin = String(url).includes("uuid-admin");
        return Promise.resolve({ ok: true, json: () => Promise.resolve(
          isAdmin && adminGroups.length ? [{ id: "g1", name: adminGroups[0] }] : []
        )});
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.KEYCLOAK_ISSUER = "https://auth.cloudless.gr/realms/master";
    process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER = "https://auth.cloudless.gr/realms/master";
    process.env.KEYCLOAK_ADMIN_USER = "admin";
    process.env.KEYCLOAK_ADMIN_PASSWORD = "pass";
    mockFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.KEYCLOAK_ISSUER;
    delete process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;
  });

  it("returns 401 when not authenticated", async () => {
    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(unauthReq("http://localhost/api/admin/users"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when Keycloak is not configured", async () => {
    process.env.KEYCLOAK_ISSUER = "";
    process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER = "";
    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(adminReq("http://localhost/api/admin/users"));
    const data = await res.json();
    expect(res.status).toBe(503);
    expect(data.error).toMatch(/not configured/i);
  });

  it("returns users list from Keycloak", async () => {
    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(adminReq("http://localhost/api/admin/users"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.users.length).toBeGreaterThan(0);
    expect(data.users[0].email).toBe("user@test.com");
    expect(data.users[0].role).toBe("user");
  });

  it("marks user as admin when in admin group", async () => {
    mockFetch(["admin"]);
    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(adminReq("http://localhost/api/admin/users"));
    const data = await res.json();
    expect(res.status).toBe(200);
    const adminUser = data.users.find((u: { email: string }) => u.email === "admin@cloudless.gr");
    expect(adminUser?.role).toBe("admin");
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/users (actions)
// ---------------------------------------------------------------------------
describe("POST /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KEYCLOAK_ISSUER = "https://auth.cloudless.gr/realms/master";
    process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER = "https://auth.cloudless.gr/realms/master";
    process.env.KEYCLOAK_ADMIN_USER = "admin";
    process.env.KEYCLOAK_ADMIN_PASSWORD = "pass";
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/token")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ access_token: "tok" }) });
      }
      if (String(url).includes("/groups")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: "grp-1", name: "admin" }]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.KEYCLOAK_ISSUER;
    delete process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;
  });

  it("returns 401 when not authenticated", async () => {
    const { POST } = await import("@/app/api/admin/users/route");
    const res = await POST(unauthReq("http://localhost/api/admin/users"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when action or username missing", async () => {
    const { POST } = await import("@/app/api/admin/users/route");
    const res = await POST(adminReq("http://localhost/api/admin/users", { method: "POST", body: { action: "disable" } }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/required/i);
  });

  it("disables a user", async () => {
    const { POST } = await import("@/app/api/admin/users/route");
    const res = await POST(adminReq("http://localhost/api/admin/users", {
      method: "POST",
      body: { action: "disable", username: "uuid-test-user" },
    }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("promotes user to admin", async () => {
    const { POST } = await import("@/app/api/admin/users/route");
    const res = await POST(adminReq("http://localhost/api/admin/users", {
      method: "POST",
      body: { action: "promote", username: "uuid-test-user" },
    }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.message).toMatch(/admin/i);
  });

  it("returns 400 for unknown action", async () => {
    const { POST } = await import("@/app/api/admin/users/route");
    const res = await POST(adminReq("http://localhost/api/admin/users", {
      method: "POST",
      body: { action: "nuke", username: "uuid-test-user" },
    }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toMatch(/unknown action/i);
  });
});

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
            data: [{
              id: "cs_test_1",
              customer_email: "buyer@test.com",
              customer_details: { email: "buyer@test.com" },
              amount_total: 9900,
              currency: "eur",
              payment_status: "paid",
              mode: "payment",
              line_items: { data: [{ description: "AI Package", quantity: 1, amount_total: 9900 }] },
              created: Math.floor(Date.now() / 1000),
            }],
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
