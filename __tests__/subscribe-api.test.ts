import { beforeEach, describe, expect, it, vi } from "vitest";

const notifyTeamMock = vi.fn();

vi.mock("@/lib/email", () => ({
  notifyTeam: notifyTeamMock,
}));

describe("POST /api/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyTeamMock.mockResolvedValue(undefined);
  });

  it("returns 400 for invalid email payload", async () => {
    const { POST } = await import("@/app/api/subscribe/route");
    const request = new globalThis.Request("http://localhost:4000/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid email");
    expect(notifyTeamMock).not.toHaveBeenCalled();
  });

  it("returns success for valid email", async () => {
    const { POST } = await import("@/app/api/subscribe/route");
    const request = new globalThis.Request("http://localhost:4000/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "hello@cloudless.gr" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(notifyTeamMock).toHaveBeenCalledTimes(1);
    expect(notifyTeamMock.mock.calls[0][0]).toContain("New subscriber");
  });

  it("returns 500 when team notification fails", async () => {
    notifyTeamMock.mockRejectedValueOnce(new Error("ses-down"));
    const { POST } = await import("@/app/api/subscribe/route");
    const request = new globalThis.Request("http://localhost:4000/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "hello@cloudless.gr" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("Failed to subscribe");
  });
});
