import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gsc", () => ({
  getSeoSnapshot: vi.fn(),
  getTopKeywords: vi.fn(),
}));

vi.mock("@/lib/espocrm", () => ({
  listContacts: vi.fn(),
  isEspoCRMConfigured: vi.fn(),
  listNewsletterSubscribers: vi.fn(),
}));

vi.mock("@/lib/sentry", () => ({
  getTopErrors: vi.fn(),
  isSentryConfigured: vi.fn(),
}));

vi.mock("@/lib/content-cache", () => ({
  invalidateCache: vi.fn(),
}));

import { getSeoSnapshot, getTopKeywords } from "@/lib/gsc";
import { listContacts, isEspoCRMConfigured, listNewsletterSubscribers } from "@/lib/espocrm";
import { getTopErrors, isSentryConfigured } from "@/lib/sentry";
import { invalidateCache } from "@/lib/content-cache";
import {
  buildSeoBlocks,
  buildLeadsBlocks,
  buildErrorsBlocks,
  buildUptimeBlocks,
  buildSubscribersBlocks,
  buildCacheFlushBlocks,
} from "@/lib/slack-commands-extra";

function blockText(blocks: unknown[]): string {
  return JSON.stringify(blocks);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildSeoBlocks", () => {
  it("renders a warning when GSC returns no snapshot", async () => {
    vi.mocked(getSeoSnapshot).mockResolvedValue(null as never);
    const blocks = await buildSeoBlocks("U1");
    expect(blockText(blocks)).toContain("GSC not configured");
  });

  it("renders snapshot metrics and keyword rows", async () => {
    vi.mocked(getSeoSnapshot).mockResolvedValue({
      clicks: 1234,
      impressions: 56789,
      ctr: 2.187,
      avgPosition: 8.42,
    } as never);
    vi.mocked(getTopKeywords).mockResolvedValue([
      { keyword: "cloudless", position: 3.21, clicks: 10, impressions: 100 },
    ] as never);
    const text = blockText(await buildSeoBlocks("U1"));
    expect(text).toContain("SEO — Google Search Console");
    expect(text).toContain("1,234");
    expect(text).toContain("cloudless");
    expect(text).toContain("<@U1>");
  });

  it("returns a warning block when GSC throws", async () => {
    vi.mocked(getSeoSnapshot).mockRejectedValue(new Error("gsc down"));
    const blocks = await buildSeoBlocks("U1");
    expect(blockText(blocks)).toContain("SEO data unavailable");
    expect(blockText(blocks)).toContain("gsc down");
  });
});

describe("buildLeadsBlocks", () => {
  it("warns when EspoCRM is not configured", async () => {
    vi.mocked(isEspoCRMConfigured).mockResolvedValue(false);
    const blocks = await buildLeadsBlocks("U1");
    expect(blockText(blocks)).toContain("EspoCRM not configured");
    expect(listContacts).not.toHaveBeenCalled();
  });

  it("renders an empty-state when no contacts exist", async () => {
    vi.mocked(isEspoCRMConfigured).mockResolvedValue(true);
    vi.mocked(listContacts).mockResolvedValue([] as never);
    const text = blockText(await buildLeadsBlocks("U1"));
    expect(text).toContain("No contacts found");
  });

  it("renders contact rows with names and emails", async () => {
    vi.mocked(isEspoCRMConfigured).mockResolvedValue(true);
    vi.mocked(listContacts).mockResolvedValue([
      { properties: { firstname: "Ada", lastname: "Lovelace", email: "ada@x.com", createdate: "2026-01-01T00:00:00Z" } },
      { properties: { email: "noname@x.com" } },
    ] as never);
    const text = blockText(await buildLeadsBlocks("U1"));
    expect(text).toContain("Ada Lovelace");
    expect(text).toContain("ada@x.com");
    expect(text).toContain("noname@x.com");
  });

  it("returns a warning block when the CRM call throws", async () => {
    vi.mocked(isEspoCRMConfigured).mockResolvedValue(true);
    vi.mocked(listContacts).mockRejectedValue(new Error("crm down"));
    expect(blockText(await buildLeadsBlocks("U1"))).toContain("Leads unavailable");
  });
});

describe("buildErrorsBlocks", () => {
  it("warns when Sentry is not configured", async () => {
    vi.mocked(isSentryConfigured).mockResolvedValue(false);
    expect(blockText(await buildErrorsBlocks("U1"))).toContain("Sentry not configured");
    expect(getTopErrors).not.toHaveBeenCalled();
  });

  it("renders the all-clear state", async () => {
    vi.mocked(isSentryConfigured).mockResolvedValue(true);
    vi.mocked(getTopErrors).mockResolvedValue([] as never);
    expect(blockText(await buildErrorsBlocks("U1"))).toContain("No Unresolved Errors");
  });

  it("renders issues with level icons", async () => {
    vi.mocked(isSentryConfigured).mockResolvedValue(true);
    vi.mocked(getTopErrors).mockResolvedValue([
      { title: "TypeError: x", level: "error", count: 12, lastSeen: "2026-02-01T00:00:00Z" },
      { title: "Warn thing", level: "warning", count: 3, lastSeen: null },
    ] as never);
    const text = blockText(await buildErrorsBlocks("U1"));
    expect(text).toContain("Top Unresolved Errors");
    expect(text).toContain("TypeError: x");
    expect(text).toContain(":red_circle:");
    expect(text).toContain(":large_orange_circle:");
    expect(text).toContain("Open Sentry");
  });

  it("returns a warning block when Sentry throws", async () => {
    vi.mocked(isSentryConfigured).mockResolvedValue(true);
    vi.mocked(getTopErrors).mockRejectedValue(new Error("sentry down"));
    expect(blockText(await buildErrorsBlocks("U1"))).toContain("Errors unavailable");
  });
});

describe("buildUptimeBlocks", () => {
  it("renders all-systems-operational when every endpoint is up", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("ok", { status: 200 }))
    );
    const text = blockText(await buildUptimeBlocks("U1"));
    expect(text).toContain("All Systems Operational");
    expect(text).toContain("cloudless.gr");
    expect(text).toContain("Pi origin");
    expect(text).toContain("200 OK");
  });

  it("renders issues-detected with TIMEOUT when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        url.includes("pi-origin")
          ? Promise.reject(new Error("timeout"))
          : Promise.resolve(new Response("ok", { status: 200 }))
      )
    );
    const text = blockText(await buildUptimeBlocks("U1"));
    expect(text).toContain("Issues Detected");
    expect(text).toContain("TIMEOUT");
    expect(text).toContain(":red_circle:");
  });
});

describe("buildSubscribersBlocks", () => {
  it("warns when EspoCRM is not configured", async () => {
    vi.mocked(isEspoCRMConfigured).mockResolvedValue(false);
    expect(blockText(await buildSubscribersBlocks("U1"))).toContain("EspoCRM not configured");
  });

  it("renders totals and recent signups", async () => {
    vi.mocked(isEspoCRMConfigured).mockResolvedValue(true);
    vi.mocked(listNewsletterSubscribers).mockResolvedValue([
      { properties: { email: "a@x.com", createdate: "2026-01-15T00:00:00Z" } },
      { properties: {} },
    ] as never);
    const text = blockText(await buildSubscribersBlocks("U1"));
    expect(text).toContain("Total subscribers:* 2");
    expect(text).toContain("a@x.com");
    expect(text).toContain("Recent signups");
  });

  it("returns a warning block when the call throws", async () => {
    vi.mocked(isEspoCRMConfigured).mockResolvedValue(true);
    vi.mocked(listNewsletterSubscribers).mockRejectedValue(new Error("boom"));
    expect(blockText(await buildSubscribersBlocks("U1"))).toContain("Subscribers unavailable");
  });
});

describe("buildCacheFlushBlocks", () => {
  it("flushes a named prefix", async () => {
    const text = blockText(await buildCacheFlushBlocks("U1", "blog"));
    expect(invalidateCache).toHaveBeenCalledWith("blog");
    expect(text).toContain("matching `blog`");
  });

  it("flushes all keys without a prefix", async () => {
    const text = blockText(await buildCacheFlushBlocks("U1"));
    expect(invalidateCache).toHaveBeenCalledWith(undefined);
    expect(text).toContain("all CMS cache keys");
  });

  it("returns a warning block when the flush throws", async () => {
    vi.mocked(invalidateCache).mockImplementation(() => {
      throw new Error("cache wedged");
    });
    expect(blockText(await buildCacheFlushBlocks("U1"))).toContain("Cache flush failed");
  });
});
