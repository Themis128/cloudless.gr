import { beforeEach, describe, expect, it, vi } from "vitest";

const isHubSpotConfiguredMock = vi.fn();
const upsertContactMock = vi.fn();

vi.mock("@/lib/hubspot", () => ({
  isHubSpotConfigured: isHubSpotConfiguredMock,
  upsertContact: upsertContactMock,
}));

describe("POST /api/crm/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isHubSpotConfiguredMock.mockResolvedValue(true);
    upsertContactMock.mockResolvedValue("contact_123");
  });

  it("returns 503 when HubSpot is not configured", async () => {
    isHubSpotConfiguredMock.mockResolvedValueOnce(false);

    const { POST } = await import("@/app/api/crm/contact/route");
    const request = new Request("http://localhost:4500/api/crm/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "hello@cloudless.gr" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toContain("not configured");
    expect(upsertContactMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid email", async () => {
    const { POST } = await import("@/app/api/crm/contact/route");
    const request = new Request("http://localhost:4500/api/crm/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bad-email" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Valid email");
    expect(upsertContactMock).not.toHaveBeenCalled();
  });

  it("returns 200 and contact id for valid payload", async () => {
    const { POST } = await import("@/app/api/crm/contact/route");
    const request = new Request("http://localhost:4500/api/crm/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "hello@cloudless.gr",
        firstname: "Cloud",
        lastname: "Less",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.contactId).toBe("contact_123");
    expect(upsertContactMock).toHaveBeenCalledTimes(1);
  });
});
