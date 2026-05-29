/**
 * Unit tests for the HubSpot side of scripts/weekly-subscriber-report.ts.
 *
 * The script orchestrates HubSpot (counts) + Notion (logging) + Slack (digest).
 * Here we cover the HubSpot path end-to-end with mocked fetch — it is the
 * source of truth for every downstream metric and the only place numbers
 * can silently regress without a CI break.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  countHubSpotContacts,
  fetchSubscriberStats,
} from "../scripts/weekly-subscriber-report";

describe("countHubSpotContacts", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, HUBSPOT_API_KEY: "test-token" };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("POSTs to the search endpoint with Bearer auth and returns total", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ total: 42 }),
      text: () => Promise.resolve(""),
    });
    globalThis.fetch = fetchMock;

    const filters = [
      { propertyName: "lead_source", operator: "EQ", value: "newsletter_signup" },
    ];
    const total = await countHubSpotContacts(filters);

    expect(total).toBe(42);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts/search");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer test-token",
    });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.filterGroups).toEqual([{ filters }]);
    expect(body.limit).toBe(1);
  });

  it("throws when HubSpot responds non-OK", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve(null),
      text: () => Promise.resolve("unauthorized"),
    });
    await expect(countHubSpotContacts([])).rejects.toThrow(
      /HubSpot search failed: 401 unauthorized/,
    );
  });
});

describe("fetchSubscriberStats", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, HUBSPOT_API_KEY: "test-token" };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("issues three searches and aggregates total / newThisWeek / unsubscribed", async () => {
    // Three distinct total values to verify the result wiring isn't transposed.
    const totals = [100, 7, 12];
    let call = 0;
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ total: totals[call++] }),
        text: () => Promise.resolve(""),
      }),
    );
    globalThis.fetch = fetchMock;

    const stats = await fetchSubscriberStats("2026-05-30");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(stats).toEqual({
      total: 100,
      newThisWeek: 7,
      totalUnsubscribed: 12,
      week: "2026-05-30",
    });
  });

  it("uses lead_source=newsletter_signup for total and newThisWeek, newsletter_unsubscribed for unsubscribed", async () => {
    const bodies: unknown[] = [];
    globalThis.fetch = vi.fn().mockImplementation((_url, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string));
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ total: 0 }),
        text: () => Promise.resolve(""),
      });
    });

    await fetchSubscriberStats("2026-05-30");

    const sources = bodies.map((b) => {
      const body = b as { filterGroups: { filters: { value: string }[] }[] };
      return body.filterGroups[0].filters.map((f) => f.value);
    });
    // Promise.all order: [total, newThisWeek, totalUnsubscribed]
    expect(sources[0]).toEqual(["newsletter_signup"]);
    expect(sources[1][0]).toBe("newsletter_signup");
    expect(sources[1][1]).toMatch(/^\d+$/); // millisecond timestamp for createdate GTE
    expect(sources[2]).toEqual(["newsletter_unsubscribed"]);
  });

  it("bounds the newThisWeek window to the last 7 days", async () => {
    const bodies: unknown[] = [];
    globalThis.fetch = vi.fn().mockImplementation((_url, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string));
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ total: 0 }),
        text: () => Promise.resolve(""),
      });
    });

    const before = Date.now();
    await fetchSubscriberStats("2026-05-30");
    const after = Date.now();

    const newThisWeekBody = bodies[1] as {
      filterGroups: { filters: { propertyName: string; value: string }[] }[];
    };
    const dateFilter = newThisWeekBody.filterGroups[0].filters.find(
      (f) => f.propertyName === "createdate",
    )!;
    const ts = Number(dateFilter.value);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(ts).toBeGreaterThanOrEqual(before - sevenDaysMs);
    expect(ts).toBeLessThanOrEqual(after - sevenDaysMs);
  });
});
