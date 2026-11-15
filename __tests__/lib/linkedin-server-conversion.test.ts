import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetConfig = vi.fn().mockResolvedValue({ SOCIALAUTO_API_URL: "" });
vi.mock("@/lib/ssm-config", () => ({
  getConfig: () => mockGetConfig(),
}));

import { fireLinkedInServerConversion } from "@/lib/linkedin-server-conversion";

const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  delete process.env.SOCIALAUTO_API_URL;
  delete process.env.SOCIALAUTO_CONVERSION_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fireLinkedInServerConversion", () => {
  it("POSTs the event to the SocialAuto ingest endpoint", async () => {
    process.env.SOCIALAUTO_CONVERSION_KEY = "sekrit";
    await fireLinkedInServerConversion({
      event: "contact_created",
      email: "a@b.co",
      eventId: "evt-1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://social.cloudless.gr/api/v1/webhooks/linkedin-conversion");
    expect((init.headers as Record<string, string>)["X-Conversion-Key"]).toBe("sekrit");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ event: "contact_created", email: "a@b.co", event_id: "evt-1" });
  });

  it("omits the key header when unset", async () => {
    await fireLinkedInServerConversion({ event: "signup", email: "x@y.z" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["X-Conversion-Key"]).toBeUndefined();
  });

  it("uses SOCIALAUTO_API_URL override", async () => {
    process.env.SOCIALAUTO_API_URL = "https://sa.example.com/";
    await fireLinkedInServerConversion({ event: "purchase", email: "e@x.co", value: 10, currency: "EUR" });
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://sa.example.com/api/v1/webhooks/linkedin-conversion");
  });

  it("never throws on fetch failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("down"));
    await expect(
      fireLinkedInServerConversion({ event: "signup", email: "e@x.co" })
    ).resolves.toBeUndefined();
  });
});
