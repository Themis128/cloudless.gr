import { beforeEach, describe, expect, it, vi } from "vitest";

const isHubSpotConfiguredMock = vi.fn();
const upsertContactMock = vi.fn();

vi.mock("@/lib/espocrm", () => ({
  isEspoCRMConfigured: isHubSpotConfiguredMock,
  upsertContact: upsertContactMock,
}));

describe("POST /api/crm/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isHubSpotConfiguredMock.mockResolvedValue(true);
    upsertContactMock.mockResolvedValue("contact_123");
  });

  it("returns 503 when EspoCRM is not configured", async () => {
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


  it("returns 500 when upsert resolves with no contact id", async () => {
    upsertContactMock.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/crm/contact/route");
    const response = await POST(
      new Request("http://localhost:4500/api/crm/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "hello@cloudless.gr" }),
      })
    );
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("Failed to create contact.");
  });

  it("returns 500 on an unexpected upsert throw and maps integration errors", async () => {
    const { POST } = await import("@/app/api/crm/contact/route");
    const req = () =>
      new Request("http://localhost:4500/api/crm/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "hello@cloudless.gr" }),
      });

    upsertContactMock.mockRejectedValueOnce(new Error("espocrm exploded"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    let res = await POST(req());
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("CRM operation failed.");
    spy.mockRestore();

    // a mapped integration error short-circuits to its own response
    const { IntegrationNotConfiguredError } = await import("@/lib/integrations");
    upsertContactMock.mockRejectedValueOnce(new IntegrationNotConfiguredError(["ESPOCRM_URL"]));
    res = await POST(req());
    expect(res.status).toBe(503);
  });
});
