/**
 * Crypto-fallback tails: funnel-client session ids and content-calendar item
 * ids degrade through crypto.randomUUID → getRandomValues → Date.now.
 * Only the crypto/sessionStorage globals are stubbed.
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations", () => ({
  getIntegrationsAsync: vi.fn().mockResolvedValue({}),
  isConfiguredAsync: vi.fn().mockResolvedValue(false),
  isConfigured: vi.fn().mockReturnValue(false),
  getIntegrations: vi.fn().mockReturnValue({}),
  resetIntegrationCacheAsync: vi.fn(),
}));

vi.mock("@/lib/cal-com", () => ({
  getUpcomingConsultations: vi.fn().mockResolvedValue([]),
}));

import { getFunnelSessionId } from "@/lib/funnel-client";
import { createCalendarItem, deleteCalendarItem, getCalendarItems } from "@/lib/content-calendar";

const ITEM = {
  title: "tail-item",
  date: "2026-10-20",
  type: "post" as const,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("crypto getRandomValues fallback", () => {
  it("funnel session id uses getRandomValues when randomUUID is absent", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (b: Uint8Array) => b.fill(0xab),
    });
    sessionStorage.clear();
    const id = getFunnelSessionId();
    expect(id).toBe("sid_" + "ab".repeat(16));
    // second call reuses the stored id
    expect(getFunnelSessionId()).toBe(id);
  });

  it("calendar item id uses getRandomValues when randomUUID is absent", async () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (b: Uint8Array) => b.fill(0xcd),
    });
    const item = await createCalendarItem({ ...ITEM, title: "crypto-grv" });
    expect(item.id).toBe("cal_" + "cd".repeat(8));
    await deleteCalendarItem(item.id);
  });

  it("both fall back to Date.now ids when crypto is fully absent", async () => {
    vi.stubGlobal("crypto", undefined);
    sessionStorage.clear();
    const sid = getFunnelSessionId();
    expect(sid).toMatch(/^anon_\d+$/);

    const item = await createCalendarItem({ ...ITEM, title: "crypto-none" });
    expect(item.id).toMatch(/^cal_\d+$/);
    await deleteCalendarItem(item.id);
  });
});

describe("sessionStorage failures", () => {
  it("returns anon_ id when sessionStorage.getItem throws", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "uuid-x" });
    const original = sessionStorage.getItem.bind(sessionStorage);
    vi.spyOn(sessionStorage, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(getFunnelSessionId()).toMatch(/^anon_\d+$/);
    vi.spyOn(sessionStorage, "getItem").mockRestore?.();
    void original;
  });
});
