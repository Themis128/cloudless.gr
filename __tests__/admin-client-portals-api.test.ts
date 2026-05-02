import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { ClientPortal } from "@/app/api/admin/client-portals/route";
const CLIENT_PORTALS_URL = "http://localhost/api/admin/client-portals";
const TEST_NAME = "Themis";
const ACTION_UPDATE_STEP = "update-step";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockSSMSend } = vi.hoisted(() => ({
  mockSSMSend: vi.fn(),
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
    SSMClient: vi.fn().mockImplementation(function() { return { send: mockSSMSend }; }),
  };
});

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

function adminReq(url: string, init?: { method?: string; body?: string }): NextRequest {
  const headers = new Headers({ Authorization: `Bearer ${makeAdminToken()}` });
  if (init?.body) headers.set("Content-Type", "application/json");
  return new NextRequest(url, { method: init?.method, body: init?.body, headers });
}

const STEP_ID = "step-uuid-1111-2222-3333-4444444444";
const COMMENT_ID = "cmt-uuid-aaaa-bbbb-cccc-dddddddddddd";

const MOCK_PORTAL: ClientPortal = {
  token: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  label: "Acme Corp — 2026",
  clientEmail: "acme@example.com",
  clientName: "Jane Doe",
  createdAt: new Date().toISOString(),
  steps: [
    {
      id: STEP_ID,
      name: "Free Audit",
      status: "pending",
      comments: [
        { id: COMMENT_ID, author: "Cloudless Team", text: "Audit scheduled.", createdAt: new Date().toISOString() },
      ],
    },
    { id: "step-2", name: "Implementation", status: "pending", comments: [] },
  ],
};

// ---------------------------------------------------------------------------
// Tests — GET
// ---------------------------------------------------------------------------
describe("GET /api/admin/client-portals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify([MOCK_PORTAL]) } });
  });

  it("returns 401 without token", async () => {
    const { GET } = await import("@/app/api/admin/client-portals/route");
    const res = await GET(new NextRequest(CLIENT_PORTALS_URL));
    expect(res.status).toBe(401);
  });

  it("returns portal list for admin", async () => {
    mockSSMSend.mockResolvedValue({ Parameter: { Value: JSON.stringify([MOCK_PORTAL]) } });
    const { GET } = await import("@/app/api/admin/client-portals/route");
    const res = await GET(adminReq(CLIENT_PORTALS_URL));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.portals)).toBe(true);
    expect(data.portals[0]).toMatchObject({
      label: "Acme Corp — 2026",
      clientEmail: "acme@example.com",
    });
  });

  it("returns empty array when SSM throws", async () => {
    mockSSMSend.mockRejectedValue(new Error("Not found"));
    const { GET } = await import("@/app/api/admin/client-portals/route");
    const res = await GET(adminReq(CLIENT_PORTALS_URL));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.portals).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests — POST (create)
// ---------------------------------------------------------------------------
describe("POST /api/admin/client-portals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSSMSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify([]) } }) // GET (readPortals)
      .mockResolvedValue({}); // PUT (writePortals)
  });

  it("returns 400 when clientEmail is missing", async () => {
    const { POST } = await import("@/app/api/admin/client-portals/route");
    const res = await POST(adminReq(CLIENT_PORTALS_URL, {
      method: "POST",
      body: JSON.stringify({ label: "Test" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when label is missing", async () => {
    const { POST } = await import("@/app/api/admin/client-portals/route");
    const res = await POST(adminReq(CLIENT_PORTALS_URL, {
      method: "POST",
      body: JSON.stringify({ clientEmail: "test@example.com" }),
    }));
    expect(res.status).toBe(400);
  });

  it("creates a portal and returns it with a token", async () => {
    mockSSMSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify([]) } })
      .mockResolvedValue({});
    const { POST } = await import("@/app/api/admin/client-portals/route");
    const res = await POST(adminReq(CLIENT_PORTALS_URL, {
      method: "POST",
      body: JSON.stringify({
        label: "Beta Corp",
        clientEmail: "beta@example.com",
        clientName: "John Beta",
      }),
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.portal).toMatchObject({
      label: "Beta Corp",
      clientEmail: "beta@example.com",
      clientName: "John Beta",
    });
    expect(typeof data.portal.token).toBe("string");
    expect(data.portal.token.length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// Tests — POST creates portal with default steps
// ---------------------------------------------------------------------------
it("created portal includes default steps", async () => {
  mockSSMSend
    .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify([]) } })
    .mockResolvedValue({});
  const { POST } = await import("@/app/api/admin/client-portals/route");
  const res = await POST(adminReq(CLIENT_PORTALS_URL, {
    method: "POST",
    body: JSON.stringify({ label: "Steps Corp", clientEmail: "steps@example.com" }),
  }));
  expect(res.status).toBe(201);
  const data = await res.json();
  expect(Array.isArray(data.portal.steps)).toBe(true);
  expect(data.portal.steps.length).toBeGreaterThan(0);
  expect(data.portal.steps[0]).toMatchObject({ name: "Free Audit", status: "pending" });
});

// ---------------------------------------------------------------------------
// Tests — PATCH (step management)
// ---------------------------------------------------------------------------
describe("PATCH /api/admin/client-portals", () => {
  beforeEach(() => {
    mockSSMSend.mockReset();
    mockSSMSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify([MOCK_PORTAL]) } })
      .mockResolvedValue({});
  });

  it("returns 400 when token is missing", async () => {
    const { PATCH } = await import("@/app/api/admin/client-portals/route");
    const res = await PATCH(adminReq(CLIENT_PORTALS_URL, {
      method: "PATCH",
      body: JSON.stringify({ action: ACTION_UPDATE_STEP, stepId: STEP_ID, status: "completed" }),
    }));
    expect(res.status).toBe(400);
  });

  it("updates step status to completed", async () => {
    const { PATCH } = await import("@/app/api/admin/client-portals/route");
    const res = await PATCH(adminReq(CLIENT_PORTALS_URL, {
      method: "PATCH",
      body: JSON.stringify({
        token: MOCK_PORTAL.token,
        action: ACTION_UPDATE_STEP,
        stepId: STEP_ID,
        status: "completed",
      }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    const step = data.portal.steps.find((s: { id: string }) => s.id === STEP_ID);
    expect(step.status).toBe("completed");
    expect(step.completedAt).toBeDefined();
  });

  it("adds a comment to a step", async () => {
    const { PATCH } = await import("@/app/api/admin/client-portals/route");
    const res = await PATCH(adminReq(CLIENT_PORTALS_URL, {
      method: "PATCH",
      body: JSON.stringify({
        token: MOCK_PORTAL.token,
        action: "add-comment",
        stepId: STEP_ID,
        author: TEST_NAME,
        text: "Work started on this step.",
      }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    const step = data.portal.steps.find((s: { id: string }) => s.id === STEP_ID);
    expect(step.comments).toHaveLength(2);
    expect(step.comments[1]).toMatchObject({ author: TEST_NAME, text: "Work started on this step." });
  });

  it("returns 400 for add-comment with empty text", async () => {
    const { PATCH } = await import("@/app/api/admin/client-portals/route");
    const res = await PATCH(adminReq(CLIENT_PORTALS_URL, {
      method: "PATCH",
      body: JSON.stringify({
        token: MOCK_PORTAL.token,
        action: "add-comment",
        stepId: STEP_ID,
        author: TEST_NAME,
        text: "  ",
      }),
    }));
    expect(res.status).toBe(400);
  });

  it("deletes a comment from a step", async () => {
    const { PATCH } = await import("@/app/api/admin/client-portals/route");
    const res = await PATCH(adminReq(CLIENT_PORTALS_URL, {
      method: "PATCH",
      body: JSON.stringify({
        token: MOCK_PORTAL.token,
        action: "delete-comment",
        stepId: STEP_ID,
        commentId: COMMENT_ID,
      }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    const step = data.portal.steps.find((s: { id: string }) => s.id === STEP_ID);
    expect(step.comments).toHaveLength(0);
  });

  it("adds a new custom step", async () => {
    const { PATCH } = await import("@/app/api/admin/client-portals/route");
    const res = await PATCH(adminReq(CLIENT_PORTALS_URL, {
      method: "PATCH",
      body: JSON.stringify({
        token: MOCK_PORTAL.token,
        action: "add-step",
        name: "Custom Review",
      }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.portal.steps).toHaveLength(3);
    expect(data.portal.steps[2]).toMatchObject({ name: "Custom Review", status: "pending" });
  });

  it("deletes a step", async () => {
    const { PATCH } = await import("@/app/api/admin/client-portals/route");
    const res = await PATCH(adminReq(CLIENT_PORTALS_URL, {
      method: "PATCH",
      body: JSON.stringify({
        token: MOCK_PORTAL.token,
        action: "delete-step",
        stepId: STEP_ID,
      }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.portal.steps).toHaveLength(1);
    expect(data.portal.steps[0].id).toBe("step-2");
  });

  it("returns 404 for unknown portal token", async () => {
    const { PATCH } = await import("@/app/api/admin/client-portals/route");
    const res = await PATCH(adminReq(CLIENT_PORTALS_URL, {
      method: "PATCH",
      body: JSON.stringify({
        token: "nonexistent-token-that-does-not-exist",
        action: ACTION_UPDATE_STEP,
        stepId: STEP_ID,
        status: "completed",
      }),
    }));
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Tests — DELETE (revoke)
// ---------------------------------------------------------------------------
describe("DELETE /api/admin/client-portals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSSMSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify([MOCK_PORTAL]) } })
      .mockResolvedValue({});
  });

  it("returns 400 when token is missing", async () => {
    const { DELETE } = await import("@/app/api/admin/client-portals/route");
    const res = await DELETE(adminReq(CLIENT_PORTALS_URL, {
      method: "DELETE",
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
  });

  it("revokes a portal and returns ok", async () => {
    mockSSMSend
      .mockResolvedValueOnce({ Parameter: { Value: JSON.stringify([MOCK_PORTAL]) } })
      .mockResolvedValue({});
    const { DELETE } = await import("@/app/api/admin/client-portals/route");
    const res = await DELETE(adminReq(CLIENT_PORTALS_URL, {
      method: "DELETE",
      body: JSON.stringify({ token: MOCK_PORTAL.token }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});
