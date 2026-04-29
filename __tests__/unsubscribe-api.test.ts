import { beforeEach, describe, expect, it, vi } from "vitest";

const notifyTeamMock = vi.fn();
const addToSuppressionListMock = vi.fn();

vi.mock("@/lib/email", () => ({
  notifyTeam: notifyTeamMock,
}));

vi.mock("@/lib/ses-suppression", () => ({
  addToSuppressionList: addToSuppressionListMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ ok: true, remaining: 99 })),
  getClientIp: vi.fn(() => "127.0.0.1"),
  resetRateLimitStore: vi.fn(),
}));

describe("POST /api/unsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyTeamMock.mockResolvedValue(undefined);
    addToSuppressionListMock.mockResolvedValue(true);
  });

  it("returns 400 for missing email", async () => {
    const { POST } = await import("@/app/api/unsubscribe/route");
    const req = new Request("http://localhost:4000/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid email");
  });

  it("returns 400 for malformed email", async () => {
    const { POST } = await import("@/app/api/unsubscribe/route");
    const req = new Request("http://localhost:4000/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 and suppresses email when valid", async () => {
    const { POST } = await import("@/app/api/unsubscribe/route");
    const req = new Request("http://localhost:4000/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@cloudless.gr" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(addToSuppressionListMock).toHaveBeenCalledWith("user@cloudless.gr");
  });

  it("notifies team on successful unsubscribe (fire-and-forget)", async () => {
    const { POST } = await import("@/app/api/unsubscribe/route");
    const req = new Request("http://localhost:4000/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@cloudless.gr" }),
    });
    await POST(req);
    // Give the fire-and-forget micro-task a tick to execute
    await new Promise((r) => setTimeout(r, 0));
    expect(notifyTeamMock).toHaveBeenCalledTimes(1);
    expect(notifyTeamMock.mock.calls[0][0]).toContain("Unsubscribe");
  });

  it("returns 200 even when SES suppression fails (degraded mode)", async () => {
    addToSuppressionListMock.mockResolvedValueOnce(false);
    const { POST } = await import("@/app/api/unsubscribe/route");
    const req = new Request("http://localhost:4000/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@cloudless.gr" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(addToSuppressionListMock).toHaveBeenCalled();
  });
});

describe("GET /api/unsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyTeamMock.mockResolvedValue(undefined);
    addToSuppressionListMock.mockResolvedValue(true);
  });

  it("returns 400 HTML for missing email param", async () => {
    const { GET } = await import("@/app/api/unsubscribe/route");
    const req = new Request("http://localhost:4000/api/unsubscribe");
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("returns 400 HTML for invalid email param", async () => {
    const { GET } = await import("@/app/api/unsubscribe/route");
    const req = new Request("http://localhost:4000/api/unsubscribe?email=bad");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("Error");
  });

  it("returns 200 HTML confirmation for valid email", async () => {
    const { GET } = await import("@/app/api/unsubscribe/route");
    const req = new Request(
      "http://localhost:4000/api/unsubscribe?email=user%40cloudless.gr",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Unsubscribed");
    expect(body).toContain("user@cloudless.gr");
    expect(addToSuppressionListMock).toHaveBeenCalledWith("user@cloudless.gr");
  });

  it("returns 500 HTML when suppression throws", async () => {
    addToSuppressionListMock.mockRejectedValueOnce(new Error("aws-down"));
    const { GET } = await import("@/app/api/unsubscribe/route");
    const req = new Request(
      "http://localhost:4000/api/unsubscribe?email=user%40cloudless.gr",
    );
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).toContain("Error");
  });
});
