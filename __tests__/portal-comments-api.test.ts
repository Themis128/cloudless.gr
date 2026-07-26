import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks (I/O boundary only — SSM)
// ---------------------------------------------------------------------------
const mockFindPortalByToken = vi.fn();
const mockReadPortals = vi.fn();
const mockWritePortals = vi.fn();

vi.mock("@/lib/client-portals", () => ({
  findPortalByToken: (...a: unknown[]) => mockFindPortalByToken(...a),
  readPortals: (...a: unknown[]) => mockReadPortals(...a),
  writePortals: (...a: unknown[]) => mockWritePortals(...a),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => ({ ok: true }),
  getClientIp: () => "127.0.0.1",
}));

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------
const VALID_TOKEN = "12345678-1234-1234-1234-123456789abc";

function makePortal() {
  return {
    token: VALID_TOKEN,
    label: "Test Project",
    clientEmail: "client@example.com",
    clientName: "Test Client",
    createdAt: "2024-01-01T00:00:00Z",
    steps: [
      { id: "step-1", name: "Discovery", status: "in-progress", comments: [] },
      { id: "step-2", name: "Build", status: "pending", comments: [] },
    ],
    deliverables: [],
    paymentLinks: [],
  };
}

function makeRequest(token: string, body: unknown) {
  return new NextRequest(`http://localhost/api/portal/${token}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/portal/[token]/comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for invalid token format", async () => {
    const { POST } = await import("@/app/api/portal/[token]/comments/route");
    const req = makeRequest("not-a-uuid", { stepId: "step-1", text: "hello" });
    const res = await POST(req, { params: Promise.resolve({ token: "not-a-uuid" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when portal not found", async () => {
    mockFindPortalByToken.mockResolvedValue(null);
    const { POST } = await import("@/app/api/portal/[token]/comments/route");
    const req = makeRequest(VALID_TOKEN, { stepId: "step-1", text: "hello" });
    const res = await POST(req, { params: Promise.resolve({ token: VALID_TOKEN }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 when stepId missing", async () => {
    mockFindPortalByToken.mockResolvedValue(makePortal());
    const { POST } = await import("@/app/api/portal/[token]/comments/route");
    const req = makeRequest(VALID_TOKEN, { text: "hello" });
    const res = await POST(req, { params: Promise.resolve({ token: VALID_TOKEN }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when text is empty", async () => {
    mockFindPortalByToken.mockResolvedValue(makePortal());
    const { POST } = await import("@/app/api/portal/[token]/comments/route");
    const req = makeRequest(VALID_TOKEN, { stepId: "step-1", text: "   " });
    const res = await POST(req, { params: Promise.resolve({ token: VALID_TOKEN }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when step not found", async () => {
    mockFindPortalByToken.mockResolvedValue(makePortal());
    const { POST } = await import("@/app/api/portal/[token]/comments/route");
    const req = makeRequest(VALID_TOKEN, { stepId: "nonexistent", text: "hello" });
    const res = await POST(req, { params: Promise.resolve({ token: VALID_TOKEN }) });
    expect(res.status).toBe(404);
  });

  it("returns 201 and adds comment on success", async () => {
    const portal = makePortal();
    mockFindPortalByToken.mockResolvedValue(portal);
    mockReadPortals.mockResolvedValue([portal]);
    mockWritePortals.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/portal/[token]/comments/route");
    const req = makeRequest(VALID_TOKEN, { stepId: "step-1", text: "My reply" });
    const res = await POST(req, { params: Promise.resolve({ token: VALID_TOKEN }) });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.comment.text).toBe("My reply");
    expect(data.comment.author).toBe("Test Client");
    expect(data.comment.id).toBeTruthy();
    expect(data.comment.createdAt).toBeTruthy();
  });

  it("persists comment via writePortals", async () => {
    const portal = makePortal();
    const portalCopy = JSON.parse(JSON.stringify(portal));
    mockFindPortalByToken.mockResolvedValue(portal);
    mockReadPortals.mockResolvedValue([portalCopy]);
    mockWritePortals.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/portal/[token]/comments/route");
    const req = makeRequest(VALID_TOKEN, { stepId: "step-1", text: "Persisted" });
    await POST(req, { params: Promise.resolve({ token: VALID_TOKEN }) });

    expect(mockWritePortals).toHaveBeenCalledTimes(1);
    const written = mockWritePortals.mock.calls[0][0];
    const step = written[0].steps.find((s: { id: string }) => s.id === "step-1");
    expect(step.comments).toHaveLength(1);
    expect(step.comments[0].text).toBe("Persisted");
  });

  it("uses clientEmail username when clientName is empty", async () => {
    const portal = makePortal();
    portal.clientName = "";
    mockFindPortalByToken.mockResolvedValue(portal);
    mockReadPortals.mockResolvedValue([portal]);
    mockWritePortals.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/portal/[token]/comments/route");
    const req = makeRequest(VALID_TOKEN, { stepId: "step-1", text: "hi" });
    const res = await POST(req, { params: Promise.resolve({ token: VALID_TOKEN }) });
    const data = await res.json();
    expect(data.comment.author).toBe("client");
  });

  it("truncates text at 2000 chars", async () => {
    const portal = makePortal();
    mockFindPortalByToken.mockResolvedValue(portal);
    mockReadPortals.mockResolvedValue([portal]);
    mockWritePortals.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/portal/[token]/comments/route");
    const longText = "x".repeat(3000);
    const req = makeRequest(VALID_TOKEN, { stepId: "step-1", text: longText });
    const res = await POST(req, { params: Promise.resolve({ token: VALID_TOKEN }) });
    const data = await res.json();
    expect(data.comment.text.length).toBe(2000);
  });
});
