/**
 * /api/cron/slack-digest: order digest (24h filter, list truncation,
 * plural forms, missing email/amount/currency, Slack escaping), error digest
 * (fatal/error/warning summary, issue level icons, empty top-issues list),
 * and the 500 path when a digest throws.
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  list: vi.fn(),
  sentryReady: vi.fn(),
  counts: vi.fn(),
  top: vi.fn(),
  posts: [] as { channel: string; payload: { text: string; blocks: unknown[] } }[],
  postImpl: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({
  isCronAuthorized: (...a: unknown[]) => mocks.auth(...a),
  cronUnauthorized: () => new Response("{}", { status: 401 }),
}));
vi.mock("@/lib/stripe", () => ({
  listRecentCheckoutSessions: (...a: unknown[]) => mocks.list(...a),
  // Mirrors the real default currency (format-price.ts) with a readable format.
  formatPrice: (amount: number | null, currency = "eur") =>
    `${currency.toUpperCase()} ${((amount ?? 0) / 100).toFixed(2)}`,
}));
vi.mock("@/lib/sentry", () => ({
  isSentryConfigured: () => mocks.sentryReady(),
  getErrorCounts: () => mocks.counts(),
  getTopErrors: (n: number) => mocks.top(n),
}));
vi.mock("@/lib/slack-notify", () => ({
  SlackClient: class {
    channel: string;
    constructor(opts: { channel: string }) {
      this.channel = opts.channel;
    }
    post(payload: { text: string; blocks: unknown[] }) {
      mocks.posts.push({ channel: this.channel, payload });
      return mocks.postImpl(payload);
    }
  },
}));

import { GET } from "@/app/api/cron/slack-digest/route";

const NOW = new Date("2026-10-17T07:00:00Z").getTime();
const HOURS = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const run = () => GET(new NextRequest("http://localhost/api/cron/slack-digest"));
const post = (channel: string) => mocks.posts.find((p) => p.channel === channel)!.payload;
const blocksText = (channel: string) => JSON.stringify(post(channel).blocks);

function order(i: number, extra: Record<string, unknown> = {}) {
  return {
    id: `cs_${i}`,
    created: HOURS(1),
    paymentStatus: "paid",
    amount: 1000,
    currency: "usd",
    email: `u${i}@x.co`,
    ...extra,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  mocks.posts.length = 0;
  mocks.auth.mockResolvedValue(true);
  mocks.postImpl.mockResolvedValue(undefined);
  mocks.sentryReady.mockResolvedValue(false);
  mocks.list.mockResolvedValue({ orders: [] });
  mocks.top.mockResolvedValue([]);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("order digest", () => {
  it("keeps only paid orders from the last 24h and singularises one order", async () => {
    mocks.list.mockResolvedValue({
      orders: [
        order(1, { email: "a<b>&c@x.co" }),
        order(2, { paymentStatus: "unpaid" }),
        order(3, { created: HOURS(30) }),
        order(4, { created: null }),
      ],
    });
    const res = await run();
    expect(res.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith(100);
    const p = post("#orders");
    expect(p.text).toBe(":chart_with_upwards_trend: Daily digest — 1 order, USD 10.00");
    expect(blocksText("#orders")).toContain("a&lt;b&gt;&amp;c@x.co");
    expect(blocksText("#orders")).not.toContain("u2@x.co");
    expect(blocksText("#orders")).not.toContain("…and");
  });

  it("truncates to 5 lines with a singular '1 more order' tail", async () => {
    mocks.list.mockResolvedValue({ orders: [1, 2, 3, 4, 5, 6].map((i) => order(i)) });
    await run();
    expect(post("#orders").text).toBe(
      ":chart_with_upwards_trend: Daily digest — 6 orders, USD 60.00"
    );
    const b = blocksText("#orders");
    expect(b).toContain("_…and 1 more order_");
    expect(b).not.toContain("u6@x.co");
  });

  it("uses plural 'more orders', N/A for missing emails, 0 for missing amounts, EUR default", async () => {
    mocks.list.mockResolvedValue({
      orders: [
        order(1, { currency: undefined, email: "", amount: null }),
        ...[2, 3, 4, 5, 6, 7].map((i) => order(i)),
      ],
    });
    await run();
    // 6 × 1000 cents + one null amount; currency taken from the first order → eur default
    expect(post("#orders").text).toBe(
      ":chart_with_upwards_trend: Daily digest — 7 orders, EUR 60.00"
    );
    const b = blocksText("#orders");
    expect(b).toContain("— N/A");
    expect(b).toContain("_…and 2 more orders_");
  });
});

describe("error digest", () => {
  beforeEach(() => mocks.sentryReady.mockResolvedValue(true));

  it("posts the health-check ping when Sentry is not configured", async () => {
    mocks.sentryReady.mockResolvedValue(false);
    await run();
    expect(post("#errors").text).toBe(
      ":white_check_mark: Daily health check — errors channel active"
    );
    expect(mocks.counts).not.toHaveBeenCalled();
  });

  it("summarises singular counts and maps issue levels to icons", async () => {
    mocks.counts.mockResolvedValue({ total: 3, fatal: 1, error: 1, warning: 1 });
    mocks.top.mockResolvedValue([
      { level: "fatal", title: "Boom <x>", count: "1", permalink: "https://s/1" },
      { level: "error", title: "E".repeat(100), count: "2500", permalink: "https://s/2" },
      { level: "warning", title: "W", count: 3, permalink: "https://s/3" },
    ]);
    await run();
    expect(mocks.top).toHaveBeenCalledWith(3);
    expect(post("#errors").text).toBe(
      ":rotating_light: Daily error digest — 1 fatal, 1 error, 1 warning unresolved"
    );
    const b = blocksText("#errors");
    expect(b).toContain(":red_circle: <https://s/1|Boom &lt;x&gt;> — 1 event\\n");
    expect(b).toContain(
      `:large_orange_circle: <https://s/2|${"E".repeat(80)}> — ${(2500).toLocaleString()} events`
    );
    expect(b).toContain(":yellow_circle: <https://s/3|W> — 3 events");
    expect(b).toContain("*Total unresolved:*\\n3");
  });

  it("pluralises errors/warnings, omits zero fatals, and notes an empty top list", async () => {
    mocks.counts.mockResolvedValue({ total: 5, fatal: 0, error: 2, warning: 3 });
    await run();
    expect(post("#errors").text).toBe(
      ":rotating_light: Daily error digest — 2 errors, 3 warnings unresolved"
    );
    expect(blocksText("#errors")).toContain("_No recent high-frequency issues found._");
  });

  it("omits zero errors and warnings from the summary", async () => {
    mocks.counts.mockResolvedValue({ total: 2, fatal: 2, error: 0, warning: 0 });
    await run();
    expect(post("#errors").text).toBe(":rotating_light: Daily error digest — 2 fatal unresolved");
  });
});

describe("handler", () => {
  it("returns 500 and logs when a digest throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.list.mockRejectedValue(new Error("stripe down"));
    const res = await run();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal error" });
    expect(spy).toHaveBeenCalledWith("[Slack Digest] Unhandled error:", expect.any(Error));
    spy.mockRestore();
  });

  it("returns 401 without touching Stripe when unauthorised", async () => {
    mocks.auth.mockResolvedValue(false);
    const res = await run();
    expect(res.status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
