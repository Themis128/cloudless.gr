import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const PENDING_URL = "http://localhost/api/admin/pending-clients";
const ENROLL_URL = "http://localhost/api/portal/enroll";
const PORTAL_ME_URL = "http://localhost/api/portal/me";
const TEST_EMAIL = "eve@example.com";
const PLAN_BUNDLE = "bundle";
const PLAN_CLOUD = "cloud";
const STATUS_WAITING = "waiting";
const STATUS_APPROVED = "approved";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { mockSSMSend, mockSendEmail, mockSlackPost } = vi.hoisted(() => ({
  mockSSMSend: vi.fn(),
  mockSendEmail: vi.fn().mockResolvedValue(undefined),
  mockSlackPost: vi.fn().mockResolvedValue(true),
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

vi.mock("@aws-sdk/client-ssm", async () => {
  const actual = await vi.importActual<typeof import("@aws-sdk/client-ssm")>("@aws-sdk/client-ssm");
  return {
    ...actual,
    SSMClient: vi.fn().mockImplementation(function () {
      return { send: mockSSMSend };
    }),
  };
});

vi.mock("@/lib/email", () => ({
  sendEmail: mockSendEmail,
}));

vi.mock("@/lib/slack-notify", () => ({
  SlackClient: vi.fn().mockImplementation(function () {
    return { post: mockSlackPost };
  }),
}));

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
function makeUserToken(opts?: { email?: string; admin?: boolean }): string {
  const payload = {
    sub: "user-sub",
    email: opts?.email ?? "client@example.com",
    "cognito:groups": opts?.admin ? ["admin"] : [],
    token_use: "id",
    aud: "client",
    iss: "https://cognito-idp.us-east-1.amazonaws.com/pool",
    iat: Math.floor(Date.now() / 1000) - 10,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const h = Buffer.from("{}").toString("base64url");
  const b = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${h}.${b}.sig`;
}

function authReq(
  url: string,
  init?: { method?: string; body?: string; admin?: boolean; email?: string },
): NextRequest {
  const headers = new Headers({
    Authorization: `Bearer ${makeUserToken({ email: init?.email, admin: init?.admin })}`,
  });
  if (init?.body) headers.set("Content-Type", "application/json");
  return new NextRequest(url, {
    method: init?.method,
    body: init?.body,
    headers,
  });
}

function unauthReq(url: string, init?: { method?: string; body?: string }): NextRequest {
  const headers = new Headers();
  if (init?.body) headers.set("Content-Type", "application/json");
  return new NextRequest(url, { method: init?.method, body: init?.body, headers });
}

// ---------------------------------------------------------------------------
// POST /api/portal/enroll
// ---------------------------------------------------------------------------
describe("POST /api/portal/enroll", () => {
  beforeEach(() => {
    mockSSMSend.mockReset();
    mockSendEmail.mockClear();
    mockSlackPost.mockClear();
    // Default: empty pending list, write succeeds
    mockSSMSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify([]) } })
      .mockResolvedValue({});
  });

  it("returns 401 when no auth token", async () => {
    const { POST } = await import("@/app/api/portal/enroll/route");
    const res = await POST(unauthReq(ENROLL_URL, {
      method: "POST",
      body: JSON.stringify({ plan: PLAN_BUNDLE }),
    }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when plan is missing", async () => {
    const { POST } = await import("@/app/api/portal/enroll/route");
    const res = await POST(authReq(ENROLL_URL, {
      method: "POST",
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when plan is not in allowed list", async () => {
    const { POST } = await import("@/app/api/portal/enroll/route");
    const res = await POST(authReq(ENROLL_URL, {
      method: "POST",
      body: JSON.stringify({ plan: "not-a-real-plan" }),
    }));
    expect(res.status).toBe(400);
  });

  it("creates a pending client for a valid plan", async () => {
    const { POST } = await import("@/app/api/portal/enroll/route");
    const res = await POST(authReq(ENROLL_URL, {
      method: "POST",
      email: "alice@example.com",
      body: JSON.stringify({ plan: PLAN_BUNDLE, name: "Alice" }),
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.pending).toMatchObject({
      email: "alice@example.com",
      plan: PLAN_BUNDLE,
      status: STATUS_WAITING,
    });
    expect(data.pending.planLabel).toContain("Bundle");
  });

  it("accepts new plan keys (web, hosting)", async () => {
    const { POST } = await import("@/app/api/portal/enroll/route");
    const res1 = await POST(authReq(ENROLL_URL, {
      method: "POST",
      body: JSON.stringify({ plan: "web" }),
    }));
    expect(res1.status).toBe(201);

    mockSSMSend.mockReset();
    mockSSMSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify([]) } })
      .mockResolvedValue({});

    const res2 = await POST(authReq(ENROLL_URL, {
      method: "POST",
      body: JSON.stringify({ plan: "hosting" }),
    }));
    expect(res2.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
// GET /api/portal/me
// ---------------------------------------------------------------------------
describe("GET /api/portal/me", () => {
  beforeEach(() => {
    mockSSMSend.mockReset();
  });

  it("returns 401 without auth", async () => {
    const { GET } = await import("@/app/api/portal/me/route");
    const res = await GET(unauthReq(PORTAL_ME_URL));
    expect(res.status).toBe(401);
  });

  it("returns status: none when user has no pending entry", async () => {
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify([]) } });
    const { GET } = await import("@/app/api/portal/me/route");
    const res = await GET(authReq(PORTAL_ME_URL));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("none");
  });

  it("returns waiting status for pending client", async () => {
    const pending = [
      {
        email: "bob@example.com",
        name: "Bob",
        plan: PLAN_CLOUD,
        planLabel: "Cloud Architecture & Migration",
        submittedAt: new Date().toISOString(),
        status: STATUS_WAITING,
      },
    ];
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify(pending) } });
    const { GET } = await import("@/app/api/portal/me/route");
    const res = await GET(authReq(PORTAL_ME_URL, { email: "bob@example.com" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      status: STATUS_WAITING,
      plan: PLAN_CLOUD,
      planLabel: "Cloud Architecture & Migration",
      name: "Bob",
    });
  });

  it("returns approved status with portalToken", async () => {
    const pending = [
      {
        email: "carol@example.com",
        plan: PLAN_BUNDLE,
        submittedAt: new Date().toISOString(),
        status: STATUS_APPROVED,
        portalToken: "abc-portal-token-1234567890",
      },
    ];
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify(pending) } });
    const { GET } = await import("@/app/api/portal/me/route");
    const res = await GET(authReq(PORTAL_ME_URL, { email: "carol@example.com" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe(STATUS_APPROVED);
    expect(data.portalToken).toBe("abc-portal-token-1234567890");
  });

  it("is case-insensitive on email", async () => {
    const pending = [
      {
        email: "Dan@Example.com",
        plan: "marketing",
        submittedAt: new Date().toISOString(),
        status: STATUS_WAITING,
      },
    ];
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify(pending) } });
    const { GET } = await import("@/app/api/portal/me/route");
    const res = await GET(authReq(PORTAL_ME_URL, { email: "dan@example.com" }));
    const data = await res.json();
    expect(data.status).toBe(STATUS_WAITING);
  });
});

// ---------------------------------------------------------------------------
// /api/admin/pending-clients
// ---------------------------------------------------------------------------
describe("GET /api/admin/pending-clients", () => {
  beforeEach(() => {
    mockSSMSend.mockReset();
  });

  it("returns 401 without auth", async () => {
    const { GET } = await import("@/app/api/admin/pending-clients/route");
    const res = await GET(unauthReq(PENDING_URL));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    const { GET } = await import("@/app/api/admin/pending-clients/route");
    const res = await GET(authReq(PENDING_URL, { admin: false }));
    expect(res.status).toBe(403);
  });

  it("returns pending clients sorted (waiting first, newest first)", async () => {
    const now = new Date();
    const pending = [
      { email: "a@x.com", plan: PLAN_CLOUD, status: STATUS_APPROVED, submittedAt: new Date(now.getTime() - 86400000).toISOString() },
      { email: "b@x.com", plan: PLAN_BUNDLE, status: STATUS_WAITING, submittedAt: new Date(now.getTime() - 3600000).toISOString() },
      { email: "c@x.com", plan: "web", status: STATUS_WAITING, submittedAt: now.toISOString() },
    ];
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify(pending) } });
    const { GET } = await import("@/app/api/admin/pending-clients/route");
    const res = await GET(authReq(PENDING_URL, { admin: true }));
    expect(res.status).toBe(200);
    const data = await res.json();
    // Waiting first, newest waiting first
    expect(data.clients[0].email).toBe("c@x.com");
    expect(data.clients[1].email).toBe("b@x.com");
    expect(data.clients[2].email).toBe("a@x.com");
  });
});

describe("POST /api/admin/pending-clients (approve)", () => {
  beforeEach(() => {
    mockSSMSend.mockReset();
    mockSendEmail.mockClear();
  });

  it("returns 403 for non-admin", async () => {
    const { POST } = await import("@/app/api/admin/pending-clients/route");
    const res = await POST(authReq(PENDING_URL, {
      method: "POST",
      body: JSON.stringify({ email: "x@y.com" }),
    }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when email is missing", async () => {
    const { POST } = await import("@/app/api/admin/pending-clients/route");
    const res = await POST(authReq(PENDING_URL, {
      method: "POST",
      admin: true,
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when pending client not found", async () => {
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify([]) } });
    const { POST } = await import("@/app/api/admin/pending-clients/route");
    const res = await POST(authReq(PENDING_URL, {
      method: "POST",
      admin: true,
      body: JSON.stringify({ email: "ghost@example.com" }),
    }));
    expect(res.status).toBe(404);
  });

  it("approves a pending client and creates portal", async () => {
    const pending = [
      { email: TEST_EMAIL, name: "Eve", plan: PLAN_BUNDLE, planLabel: "Bundle", status: STATUS_WAITING, submittedAt: new Date().toISOString() },
    ];
    // Need to track call count to set up the right mock for each call
    // 1. readPendingClients (find pending)
    // 2. readPortals (load existing portals)
    // 3. writePortals (save new portal)
    // 4. readPendingClients (approvePendingClient)
    // 5. writePendingClients (approvePendingClient)
    let callCount = 0;
    mockSSMSend.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return { Parameter: { Value: JSON.stringify(pending) } };
      if (callCount === 2) return { Parameter: { Value: JSON.stringify([]) } };
      if (callCount === 3) return {};
      if (callCount === 4) return { Parameter: { Value: JSON.stringify(pending) } };
      return {};
    });

    const { POST } = await import("@/app/api/admin/pending-clients/route");
    const res = await POST(authReq(PENDING_URL, {
      method: "POST",
      admin: true,
      body: JSON.stringify({ email: TEST_EMAIL }),
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.portal).toMatchObject({
      clientEmail: TEST_EMAIL,
      clientName: "Eve",
    });
    expect(data.portal.steps.length).toBeGreaterThan(0);
    expect(typeof data.token).toBe("string");
  });

  it("returns 409 when client already approved", async () => {
    const pending = [
      { email: "f@x.com", plan: PLAN_CLOUD, status: STATUS_APPROVED, portalToken: "existing-token", submittedAt: new Date().toISOString() },
    ];
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify(pending) } });
    const { POST } = await import("@/app/api/admin/pending-clients/route");
    const res = await POST(authReq(PENDING_URL, {
      method: "POST",
      admin: true,
      body: JSON.stringify({ email: "f@x.com" }),
    }));
    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/admin/pending-clients", () => {
  beforeEach(() => {
    mockSSMSend.mockReset();
  });

  it("declines a pending client (removes from list)", async () => {
    const pending = [
      { email: "g@x.com", plan: "web", status: STATUS_WAITING, submittedAt: new Date().toISOString() },
      { email: "h@x.com", plan: "hosting", status: STATUS_WAITING, submittedAt: new Date().toISOString() },
    ];
    mockSSMSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify(pending) } })
      .mockResolvedValue({});

    const { DELETE } = await import("@/app/api/admin/pending-clients/route");
    const res = await DELETE(authReq(PENDING_URL, {
      method: "DELETE",
      admin: true,
      body: JSON.stringify({ email: "g@x.com" }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("returns 400 when email is missing", async () => {
    const { DELETE } = await import("@/app/api/admin/pending-clients/route");
    const res = await DELETE(authReq(PENDING_URL, {
      method: "DELETE",
      admin: true,
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
  });
});
