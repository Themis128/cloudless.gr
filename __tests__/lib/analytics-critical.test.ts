import { describe, it, expect, vi, beforeEach } from "vitest";

const runMock = vi.fn().mockResolvedValue({ success: true });
const bindMock = vi.fn().mockReturnValue({ run: runMock });
const prepareMock = vi.fn().mockReturnValue({ bind: bindMock });
const getAuthDbMock = vi.fn().mockReturnValue({ prepare: prepareMock });
const passSampleMock = vi.fn().mockReturnValue(false);
const allowWriteMock = vi.fn().mockReturnValue(true);

vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: () => getAuthDbMock(),
}));
vi.mock("@/lib/d1-write-budget", () => ({
  allowDiscretionaryD1Write: (n: number) => allowWriteMock(n),
  passSample: (k: string, d: number) => passSampleMock(k, d),
}));
vi.mock("@/lib/secure-id", () => ({ secureId: (p: string) => `${p}test` }));

import { trackAnalyticsEvent } from "@/lib/analytics";

describe("trackAnalyticsEvent — critical events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passSampleMock.mockReturnValue(false);
    allowWriteMock.mockReturnValue(true);
    getAuthDbMock.mockReturnValue({ prepare: prepareMock });
  });

  it("drops non-critical events when sampling rejects them", async () => {
    const ok = await trackAnalyticsEvent({ event: "page_view", page: "/en" });
    expect(ok).toBe(false);
    expect(prepareMock).not.toHaveBeenCalled();
  });

  it("writes critical events even when sampling would reject them", async () => {
    const ok = await trackAnalyticsEvent({
      event: "purchase",
      critical: true,
      amount: 49,
      currency: "EUR",
      source: "linkedin",
      campaign: "cloudless-boost",
    });
    expect(ok).toBe(true);
    expect(prepareMock).toHaveBeenCalledOnce();
  });

  it("still enforces the discretionary D1 write budget on critical events", async () => {
    allowWriteMock.mockReturnValue(false);
    const ok = await trackAnalyticsEvent({ event: "signup", critical: true });
    expect(ok).toBe(false);
    expect(prepareMock).not.toHaveBeenCalled();
  });
});
