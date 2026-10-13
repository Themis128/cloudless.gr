import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockTrackLinkedIn } = vi.hoisted(() => ({ mockTrackLinkedIn: vi.fn() }));
vi.mock("@/lib/linkedin-track", () => ({
  trackLinkedInConversion: mockTrackLinkedIn,
}));

import { fireCampaignConversion } from "@/lib/fire-campaign-conversion";
import { ATTRIBUTION_STORAGE_KEY } from "@/lib/lead-attribution";

describe("fireCampaignConversion", () => {
  const mockFetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockClear();
    mockTrackLinkedIn.mockClear();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/thanks");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fires the LinkedIn conversion and posts the CAPI mirror", () => {
    window.history.replaceState({}, "", "/thanks?li_fat_id=fat-123");
    fireCampaignConversion({
      campaign: "q4-launch",
      tier: "growth",
      orderId: "cs_test_1",
      conversionId: 98765,
      customer: { name: "Buyer", email: "b@example.com" },
    });

    expect(mockTrackLinkedIn).toHaveBeenCalledWith(98765);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.lastCall as [string, RequestInit];
    expect(url).toBe("/api/campaigns/conversion");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      campaign: "q4-launch",
      tier: "growth",
      orderId: "cs_test_1",
      conversionId: 98765,
      liFatId: "fat-123",
      customer: { name: "Buyer", email: "b@example.com" },
    });
    expect(body.utm).toBeNull();
  });

  it("forwards stored first-touch attribution as utm", () => {
    window.sessionStorage.setItem(
      ATTRIBUTION_STORAGE_KEY,
      JSON.stringify({
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "q4-launch",
        utmContent: "ad-a",
        utmTerm: "cloud audit",
      })
    );
    fireCampaignConversion({ campaign: "q4-launch" });

    const body = JSON.parse((mockFetch.mock.lastCall?.[1] as RequestInit).body as string);
    expect(body.utm).toEqual({
      source: "google",
      medium: "cpc",
      campaign: "q4-launch",
      content: "ad-a",
      term: "cloud audit",
    });
    // No conversionId → no lintrk call.
    expect(mockTrackLinkedIn).not.toHaveBeenCalled();
  });
});
