import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockIsCronAuthorized, mockReadPortals, mockWritePortals, mockSendEmail } = vi.hoisted(
  () => ({
    mockIsCronAuthorized: vi.fn(),
    mockReadPortals: vi.fn(),
    mockWritePortals: vi.fn(),
    mockSendEmail: vi.fn(),
  })
);

vi.mock("@/lib/cron-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cron-auth")>();
  return {
    ...actual,
    isCronAuthorized: mockIsCronAuthorized,
  };
});
vi.mock("@/lib/client-portals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client-portals")>();
  return {
    ...actual,
    readPortals: mockReadPortals,
    writePortals: mockWritePortals,
  };
});
vi.mock("@/lib/email", () => ({ sendEmail: mockSendEmail }));

import { GET } from "@/app/api/cron/client-reports/route";

const DAY_MS = 86_400_000;

function portal(overrides: Record<string, unknown> = {}) {
  return {
    token: "11111111-2222-3333-4444-555555555555",
    label: "Website Rebuild",
    clientEmail: "client@acme.com",
    clientName: "Acme",
    createdAt: "2026-06-01T00:00:00Z",
    steps: [],
    reportsEnabled: true,
    ...overrides,
  };
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/cron/client-reports", {
    headers: { authorization: "Bearer secret" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsCronAuthorized.mockResolvedValue(true);
  mockReadPortals.mockResolvedValue([]);
  mockWritePortals.mockResolvedValue(undefined);
  mockSendEmail.mockResolvedValue(undefined);
});

describe("GET /api/cron/client-reports", () => {
  it("rejects unauthorized callers", async () => {
    mockIsCronAuthorized.mockResolvedValue(false);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sends to enabled portals that were never reported on", async () => {
    mockReadPortals.mockResolvedValue([portal()]);
    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data.sent).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "client@acme.com",
        subject: expect.stringContaining("Website Rebuild"),
      })
    );
    expect(mockWritePortals).toHaveBeenCalledTimes(1);
    const saved = mockWritePortals.mock.calls[0][0];
    expect(saved[0].lastReportAt).toBeTruthy();
  });

  it("skips portals with reports disabled or recently reported", async () => {
    const recent = new Date(Date.now() - 5 * DAY_MS).toISOString();
    mockReadPortals.mockResolvedValue([
      portal({ reportsEnabled: false }),
      portal({ clientEmail: "recent@acme.com", lastReportAt: recent }),
    ]);
    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data.sent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockWritePortals).not.toHaveBeenCalled();
  });

  it("sends again after the 25-day window", async () => {
    const old = new Date(Date.now() - 30 * DAY_MS).toISOString();
    mockReadPortals.mockResolvedValue([portal({ lastReportAt: old })]);
    const res = await GET(makeRequest());
    expect((await res.json()).sent).toBe(1);
  });

  it("isolates per-portal send failures and still persists successes", async () => {
    mockReadPortals.mockResolvedValue([
      portal({ clientEmail: "ok@acme.com" }),
      portal({ clientEmail: "broken@acme.com", token: "22222222-2222-3333-4444-555555555555" }),
    ]);
    mockSendEmail.mockImplementation(({ to }: { to: string }) =>
      to === "broken@acme.com" ? Promise.reject(new Error("SES down")) : Promise.resolve()
    );
    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data.sent).toBe(1);
    expect(data.failed).toBe(1);
    expect(mockWritePortals).toHaveBeenCalledTimes(1);
  });
});
