// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock ssm-config before importing the adapter so resolveConfig() sees the
// fake AppConfig values. The adapter also reads
// process.env.LINKEDIN_CAPI_ACCESS_TOKEN, which the tests below set/clear.
vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn().mockResolvedValue({
    LINKEDIN_ACCESS_TOKEN: "lia_test_token",
    LINKEDIN_AD_ACCOUNT_ID: "511588554",
  }),
}));

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  delete process.env.LINKEDIN_CAPI_ACCESS_TOKEN;
  fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200 })
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("linkedinAdapter.pushConversion", () => {
  it("posts to /rest/conversionEvents with LinkedIn-Version: 202605", async () => {
    const { linkedinAdapter } = await import("@/lib/ad-analytics/adapters/linkedin");
    await linkedinAdapter.pushConversion({
      accountId: "511588554",
      conversionId: 99999999,
      eventId: "cs_test_abc",
      happenedAt: new Date("2026-06-19T00:00:00Z"),
      pageUrl: "https://cloudless.gr/en/campaigns/shop-online/thanks",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.linkedin.com/rest/conversionEvents");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["LinkedIn-Version"]).toBe("202605");
    expect(headers.Authorization).toBe("Bearer lia_test_token");
    const body = JSON.parse(init.body as string);
    expect(body.conversion).toBe("urn:lla:llaPartnerConversion:99999999");
    expect(body.eventId).toBe("cs_test_abc");
    expect(body.requestMetadata).toBeUndefined();
  });

  it("returns { accepted: false, status: 403 } on the source-bound CAPI rejection", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("conversion-source-mismatch", { status: 403 })
    );
    const { linkedinAdapter } = await import("@/lib/ad-analytics/adapters/linkedin");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await linkedinAdapter.pushConversion({
      accountId: "511588554",
      conversionId: 26846068, // EVENT_SPECIFIC_TAG-typed — server push 403s
      eventId: "cs_test_xyz",
      happenedAt: new Date(),
    });

    expect(res).toEqual({
      accepted: false,
      status: 403,
      message: "conversion-source-mismatch",
    });
    // The runtime relies on the adapter NOT throwing; the warn is a soft
    // signal so the operator sees the source-bound issue once.
    expect(warnSpy).toHaveBeenCalled();
  });

  it("returns 204 / not-configured when no token is available", async () => {
    const { getConfig } = await import("@/lib/ssm-config");
    (getConfig as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      LINKEDIN_ACCESS_TOKEN: "",
      LINKEDIN_AD_ACCOUNT_ID: "",
    });
    const { linkedinAdapter } = await import("@/lib/ad-analytics/adapters/linkedin");

    const res = await linkedinAdapter.pushConversion({
      accountId: "511588554",
      conversionId: 99999999,
      eventId: "cs_test_no_token",
      happenedAt: new Date(),
    });

    expect(res.accepted).toBe(false);
    expect(res.status).toBe(204);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("prefers process.env.LINKEDIN_CAPI_ACCESS_TOKEN over LINKEDIN_ACCESS_TOKEN", async () => {
    process.env.LINKEDIN_CAPI_ACCESS_TOKEN = "capi_only_token";
    const { linkedinAdapter } = await import("@/lib/ad-analytics/adapters/linkedin");

    await linkedinAdapter.pushConversion({
      accountId: "511588554",
      conversionId: 99999999,
      eventId: "cs_test_capi_token",
      happenedAt: new Date(),
    });

    const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer capi_only_token");
  });
});
