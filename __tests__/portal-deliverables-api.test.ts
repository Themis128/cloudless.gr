import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockReadPortals, mockWritePortals, mockSlackPost, mockSendEmail, mockGetConfig } =
  vi.hoisted(() => ({
    mockReadPortals: vi.fn(),
    mockWritePortals: vi.fn(),
    mockSlackPost: vi.fn(),
    mockSendEmail: vi.fn(),
    mockGetConfig: vi.fn(),
  }));

vi.mock("@/lib/client-portals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client-portals")>();
  return {
    ...actual,
    readPortals: mockReadPortals,
    writePortals: mockWritePortals,
  };
});
vi.mock("@/lib/slack-notify", () => ({
  SlackClient: class {
    post = mockSlackPost;
  },
}));
vi.mock("@/lib/email", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetConfig }));

import { POST } from "@/app/api/portal/[token]/deliverables/route";

const TOKEN = "11111111-2222-3333-4444-555555555555";

function makePortal() {
  return {
    token: TOKEN,
    label: "Website Rebuild",
    clientEmail: "client@acme.com",
    clientName: "Acme",
    createdAt: "2026-06-01T00:00:00Z",
    steps: [],
    deliverables: [
      {
        id: "d1",
        title: "Homepage design",
        status: "in_review",
        createdAt: "2026-06-01T00:00:00Z",
        updatedAt: "2026-06-01T00:00:00Z",
      },
    ],
  };
}

function makeRequest(body: unknown, token = TOKEN) {
  const request = new NextRequest(`http://localhost/api/portal/${token}/deliverables`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  return { request, params: Promise.resolve({ token }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReadPortals.mockResolvedValue([makePortal()]);
  mockWritePortals.mockResolvedValue(undefined);
  mockSlackPost.mockResolvedValue(true);
  mockSendEmail.mockResolvedValue(undefined);
  mockGetConfig.mockResolvedValue({ SES_TO_EMAIL: "owner@cloudless.gr" });
});

describe("POST /api/portal/[token]/deliverables", () => {
  it("rejects malformed tokens with 401", async () => {
    const { request, params } = makeRequest({ deliverableId: "d1", action: "approve" }, "nope");
    const res = await POST(request, { params });
    expect(res.status).toBe(401);
  });

  it("rejects bad bodies with 400", async () => {
    const cases = [
      {},
      { deliverableId: "d1" },
      { deliverableId: "d1", action: "destroy" },
      { deliverableId: "d1", action: "request_changes" }, // changes need a comment
    ];
    for (const body of cases) {
      const { request, params } = makeRequest(body);
      const res = await POST(request, { params });
      expect(res.status).toBe(400);
    }
  });

  it("returns 404 for unknown portals", async () => {
    mockReadPortals.mockResolvedValue([]);
    const { request, params } = makeRequest({ deliverableId: "d1", action: "approve" });
    const res = await POST(request, { params });
    expect(res.status).toBe(404);
  });

  it("approves a deliverable, persists, and returns it", async () => {
    const { request, params } = makeRequest({ deliverableId: "d1", action: "approve" });
    const res = await POST(request, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deliverable.status).toBe("approved");
    expect(mockWritePortals).toHaveBeenCalledTimes(1);
  });

  it("records a change request with the comment", async () => {
    const { request, params } = makeRequest({
      deliverableId: "d1",
      action: "request_changes",
      comment: "Bigger logo please",
    });
    const res = await POST(request, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deliverable.status).toBe("changes_requested");
    expect(data.deliverable.clientComment).toBe("Bigger logo please");
  });

  it("returns 409 when the deliverable is not in review", async () => {
    const portal = makePortal();
    portal.deliverables[0].status = "approved";
    mockReadPortals.mockResolvedValue([portal]);
    const { request, params } = makeRequest({ deliverableId: "d1", action: "approve" });
    const res = await POST(request, { params });
    expect(res.status).toBe(409);
    expect(mockWritePortals).not.toHaveBeenCalled();
  });

  it("never fails the client response when notifications throw", async () => {
    mockSlackPost.mockRejectedValue(new Error("slack down"));
    mockSendEmail.mockRejectedValue(new Error("ses down"));
    const { request, params } = makeRequest({ deliverableId: "d1", action: "approve" });
    const res = await POST(request, { params });
    expect(res.status).toBe(200);
  });
});
