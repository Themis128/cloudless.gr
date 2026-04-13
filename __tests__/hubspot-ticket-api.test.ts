import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const isHubSpotConfiguredMock = vi.fn();
const searchContactsMock = vi.fn();
const createTicketMock = vi.fn();

vi.mock("@/lib/hubspot", () => ({
  isHubSpotConfigured: isHubSpotConfiguredMock,
  searchContacts: searchContactsMock,
  createTicket: createTicketMock,
}));

function makeRequest(payload: unknown): NextRequest {
  return new NextRequest("http://localhost:4500/api/hubspot/ticket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/hubspot/ticket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isHubSpotConfiguredMock.mockResolvedValue(true);
    searchContactsMock.mockResolvedValue({ total: 0, results: [] });
    createTicketMock.mockResolvedValue({ id: "ticket_123" });
  });

  it("returns 503 when HubSpot is not configured", async () => {
    isHubSpotConfiguredMock.mockResolvedValueOnce(false);

    const { POST } = await import("@/app/api/hubspot/ticket/route");
    const response = await POST(
      makeRequest({ subject: "Need support", content: "Issue details" }),
    );
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toContain("not configured");
    expect(createTicketMock).not.toHaveBeenCalled();
  });

  it("returns 400 for missing required fields", async () => {
    const { POST } = await import("@/app/api/hubspot/ticket/route");
    const response = await POST(makeRequest({ subject: "Only subject" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Missing required fields");
  });

  it("returns 400 for invalid email", async () => {
    const { POST } = await import("@/app/api/hubspot/ticket/route");
    const response = await POST(
      makeRequest({
        subject: "Need support",
        content: "Issue details",
        email: "bad-email",
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid email");
    expect(searchContactsMock).not.toHaveBeenCalled();
    expect(createTicketMock).not.toHaveBeenCalled();
  });

  it("creates ticket with normalized priority and optional contact", async () => {
    searchContactsMock.mockResolvedValueOnce({
      total: 1,
      results: [{ id: "contact_1", properties: {} }],
    });

    const { POST } = await import("@/app/api/hubspot/ticket/route");
    const response = await POST(
      makeRequest({
        subject: "Need support",
        content: "Issue details",
        email: "hello@cloudless.gr",
        priority: "INVALID",
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.ticketId).toBe("ticket_123");
    expect(data.contactId).toBe("contact_1");
    expect(createTicketMock).toHaveBeenCalledWith(
      {
        subject: "Need support",
        content: "Issue details",
        hs_ticket_priority: "MEDIUM",
      },
      "contact_1",
    );
  });
});
