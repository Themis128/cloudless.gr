/**
 * Unit tests for scripts/weekly-gsc-sync.ts.
 *
 * The script's main() orchestrates Google JWT exchange + 4 GSC queries +
 * a Notion write. Here we cover the three pure-ish helpers — they are
 * what determine the shape and correctness of the weekly report row.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dateRange, gscQuery, rt } from "../scripts/weekly-gsc-sync";

describe("dateRange", () => {
  it("returns ISO YYYY-MM-DD strings", () => {
    const r = dateRange();
    expect(r.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("spans 28 days from today", () => {
    const r = dateRange();
    const start = new Date(`${r.startDate}T00:00:00Z`);
    const end = new Date(`${r.endDate}T00:00:00Z`);
    const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    expect(days).toBe(28);
  });
});

describe("rt", () => {
  it("wraps a string into Notion rich_text shape", () => {
    expect(rt("hi")).toEqual({
      rich_text: [{ text: { content: "hi" } }],
    });
  });

  it("truncates content at 2000 characters to stay within Notion's per-block limit", () => {
    const long = "x".repeat(2500);
    const out = rt(long);
    expect(out.rich_text[0].text.content.length).toBe(2000);
  });

  it("leaves short content unchanged", () => {
    const out = rt("short");
    expect(out.rich_text[0].text.content).toBe("short");
  });
});

describe("gscQuery", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("URL-encodes the siteUrl into the path and sends Bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ rows: [] }),
      text: () => Promise.resolve(""),
    });
    globalThis.fetch = fetchMock;

    await gscQuery("tok", "sc-domain:cloudless.gr", { dimensions: ["query"] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("sc-domain%3Acloudless.gr/searchAnalytics/query");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer tok",
    });
    expect((init as RequestInit).method).toBe("POST");
  });

  it("returns parsed rows from the GSC API", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          rows: [{ keys: ["aws cost"], clicks: 12, impressions: 400, ctr: 0.03, position: 5 }],
        }),
      text: () => Promise.resolve(""),
    });

    const result = await gscQuery("tok", "sc-domain:example", {});
    expect(result.rows).toHaveLength(1);
    expect(result.rows![0].keys).toEqual(["aws cost"]);
  });

  it("throws when GSC responds non-OK", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve(null),
      text: () => Promise.resolve("forbidden"),
    });
    await expect(gscQuery("tok", "sc-domain:example", {})).rejects.toThrow(
      /GSC query failed: 403 forbidden/
    );
  });
});
