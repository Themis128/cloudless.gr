import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DNS_FAILURE_RE,
  formatDnsFlapSlack,
  KumaDnsCoalescer,
} from "@/lib/kuma-dns-coalesce";

describe("KumaDnsCoalescer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("detects EAI_AGAIN messages", () => {
    expect(DNS_FAILURE_RE.test("getaddrinfo EAI_AGAIN espocrm.cloudless.gr")).toBe(true);
    expect(DNS_FAILURE_RE.test("timeout")).toBe(false);
    expect(DNS_FAILURE_RE.test("200 - OK")).toBe(false);
  });

  it("passes non-DNS alerts through", () => {
    const flushes: unknown[] = [];
    const c = new KumaDnsCoalescer(90_000, undefined, (f) => flushes.push(f));
    expect(c.ingest({ name: "n8n", status: "DOWN", msg: "timeout" }).action).toBe(
      "passthrough"
    );
    expect(flushes).toHaveLength(0);
  });

  it("coalesces multiple DNS DOWNs into one flush", () => {
    const flushes: { names: string[]; status: string }[] = [];
    const c = new KumaDnsCoalescer(90_000, undefined, (f) => flushes.push(f));

    expect(
      c.ingest({
        name: "EspoCRM",
        status: "DOWN",
        msg: "getaddrinfo EAI_AGAIN espocrm.cloudless.gr",
      }).action
    ).toBe("buffered");
    expect(
      c.ingest({
        name: "AppFlowy",
        status: "DOWN",
        msg: "getaddrinfo EAI_AGAIN appflowy.cloudless.gr",
      }).action
    ).toBe("buffered");
    expect(
      c.ingest({
        name: "Stripe API surface",
        status: "DOWN",
        msg: "getaddrinfo EAI_AGAIN api.stripe.com",
      }).action
    ).toBe("buffered");

    expect(flushes).toHaveLength(0);
    vi.advanceTimersByTime(90_000);
    expect(flushes).toHaveLength(1);
    expect(flushes[0].status).toBe("DOWN");
    expect(flushes[0].names).toEqual(["AppFlowy", "EspoCRM", "Stripe API surface"]);
  });

  it("coalesces UPs for monitors that recently DNS-downed", () => {
    const flushes: { names: string[]; status: string }[] = [];
    const c = new KumaDnsCoalescer(90_000, undefined, (f) => flushes.push(f));

    c.ingest({
      name: "EspoCRM",
      status: "DOWN",
      msg: "getaddrinfo EAI_AGAIN espocrm.cloudless.gr",
    });
    c.ingest({
      name: "n8n",
      status: "DOWN",
      msg: "getaddrinfo EAI_AGAIN n8n.cloudless.gr",
    });
    vi.advanceTimersByTime(90_000);
    expect(flushes).toHaveLength(1);

    expect(c.ingest({ name: "EspoCRM", status: "UP", msg: "200 - OK" }).action).toBe(
      "buffered"
    );
    expect(c.ingest({ name: "n8n", status: "UP", msg: "200 - OK" }).action).toBe("buffered");
    vi.advanceTimersByTime(90_000);
    expect(flushes).toHaveLength(2);
    expect(flushes[1].status).toBe("UP");
    expect(flushes[1].names).toEqual(["EspoCRM", "n8n"]);
  });

  it("formats a readable Slack summary", () => {
    const { title, text } = formatDnsFlapSlack({
      status: "DOWN",
      names: ["EspoCRM", "n8n"],
      sampleMsg: "getaddrinfo EAI_AGAIN",
      urls: [],
    });
    expect(title).toContain("DNS flap (2");
    expect(text).toContain("• EspoCRM");
    expect(text).toContain("CoreDNS");
  });
});
