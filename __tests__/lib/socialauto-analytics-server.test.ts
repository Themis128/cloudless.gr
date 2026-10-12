// @vitest-environment node
/**
 * socialauto-analytics-server — signed webhook sender tails:
 * secret-missing early return, default-URL fallback, HMAC signing + POST.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const getConfigMock = vi.fn();
vi.mock("@/lib/ssm-config", () => ({ getConfig: () => getConfigMock() }));

const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));

import { sendSocialAutoEventServer } from "@/lib/socialauto-analytics-server";

const EVENT = {
  event: "page_view",
  domain: "cloudless.gr",
  path: "/en",
  session_id: "s1",
  visitor_id: "v1",
  referrer: "https://ref.example",
  locale: "en",
  timestamp: 1_700_000_000_000,
  payload: { x: 1 },
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

describe("sendSocialAutoEventServer", () => {
  it("no-ops when the webhook secret is unset", async () => {
    getConfigMock.mockResolvedValue({});
    await sendSocialAutoEventServer(EVENT);
    expect(fetchMock).not.toHaveBeenCalled();
  });


  it("posts an HMAC-signed payload to the default webhook URL", async () => {
    getConfigMock.mockResolvedValue({ SOCIALAUTO_WEB_ANALYTICS_SECRET: "shh" });
    await sendSocialAutoEventServer(EVENT);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("social.cloudless.gr/api/v1/analytics/web/webhooks");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Webhook-Signature": expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(JSON.parse(init.body as string).event).toBe("page_view");
  });

  it("honours a URL override and the request referer", async () => {
    getConfigMock.mockResolvedValue({
      SOCIALAUTO_WEB_ANALYTICS_SECRET: "shh",
      SOCIALAUTO_WEB_ANALYTICS_URL: "https://hook.example/x",
    });
    await sendSocialAutoEventServer(
      EVENT,
      new Request("http://x", { headers: { referer: "https://req.example/r" } })
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://hook.example/x");
    expect(JSON.parse(init.body as string).referrer).toBe("https://req.example/r");
  });

  it("swallows fetch failures", async () => {
    getConfigMock.mockResolvedValue({ SOCIALAUTO_WEB_ANALYTICS_SECRET: "shh" });
    fetchMock.mockRejectedValueOnce(new Error("net down"));
    await expect(sendSocialAutoEventServer(EVENT)).resolves.toBeUndefined();
  });
});
