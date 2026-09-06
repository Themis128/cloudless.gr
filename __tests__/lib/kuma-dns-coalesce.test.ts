import { describe, it, expect, vi } from "vitest";
import {
  KumaDnsCoalescer,
  formatDnsFlapSlack,
  DNS_FAILURE_RE,
  resetKumaDnsCoalescerForTests,
  getKumaDnsCoalescer,
} from "@/lib/kuma-dns-coalesce";
import type { KumaAlertEvent, CoalesceFlush, CoalesceClock } from "@/lib/kuma-dns-coalesce";

function makeClock(): CoalesceClock & { tick: (ms: number) => void } {
  const timers: Map<number, { fn: () => void; fireAt: number }> = new Map();
  let now = 0;
  let nextId = 1;
  return {
    setTimeout(fn: () => void, ms: number) {
      const id = nextId++;
      timers.set(id, { fn, fireAt: now + ms });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout(id: ReturnType<typeof setTimeout>) {
      timers.delete(id as unknown as number);
    },
    tick(ms: number) {
      now += ms;
      for (const [id, { fn, fireAt }] of timers) {
        if (fireAt <= now) {
          timers.delete(id);
          fn();
        }
      }
    },
  };
}

function dnsDownEvent(name: string): KumaAlertEvent {
  return { name, status: "DOWN", msg: "getaddrinfo EAI_AGAIN api.cloudless.gr" };
}
function dnsUpEvent(name: string): KumaAlertEvent {
  return { name, status: "UP", msg: "getaddrinfo EAI_AGAIN api.cloudless.gr" };
}
function plainDownEvent(name: string): KumaAlertEvent {
  return { name, status: "DOWN", msg: "Connection refused" };
}

describe("DNS_FAILURE_RE", () => {
  it("matches EAI_AGAIN", () => {
    expect(DNS_FAILURE_RE.test("getaddrinfo EAI_AGAIN")).toBe(true);
  });

  it("matches ENOTFOUND", () => {
    expect(DNS_FAILURE_RE.test("ENOTFOUND hostname")).toBe(true);
  });

  it("does not match plain errors", () => {
    expect(DNS_FAILURE_RE.test("Connection refused")).toBe(false);
  });
});

describe("KumaDnsCoalescer", () => {
  it("passes through non-DNS events immediately", () => {
    const flushed: CoalesceFlush[] = [];
    const c = new KumaDnsCoalescer(90_000, makeClock(), (f) => flushed.push(f));
    const result = c.ingest(plainDownEvent("monitor-1"));
    expect(result.action).toBe("passthrough");
    expect(flushed).toHaveLength(0);
  });

  it("buffers a DNS DOWN event", () => {
    const clock = makeClock();
    const c = new KumaDnsCoalescer(1000, clock, () => {});
    const result = c.ingest(dnsDownEvent("api"));
    expect(result.action).toBe("buffered");
  });

  it("coalesces multiple DNS DOWNs into one flush", () => {
    const flushed: CoalesceFlush[] = [];
    const clock = makeClock();
    const c = new KumaDnsCoalescer(1000, clock, (f) => flushed.push(f));
    c.ingest(dnsDownEvent("mon-1"));
    c.ingest(dnsDownEvent("mon-2"));
    clock.tick(1001); // window expires
    expect(flushed).toHaveLength(1);
    expect(flushed[0].names).toContain("mon-1");
    expect(flushed[0].names).toContain("mon-2");
    expect(flushed[0].status).toBe("DOWN");
  });

  it("coalesces DNS UP for monitors that recently were DNS DOWN", () => {
    const flushed: CoalesceFlush[] = [];
    const clock = makeClock();
    const c = new KumaDnsCoalescer(1000, clock, (f) => flushed.push(f));
    c.ingest(dnsDownEvent("mon-x"));
    clock.tick(1001); // flush DOWN
    c.ingest(dnsUpEvent("mon-x"));
    clock.tick(1001); // flush UP
    expect(flushed).toHaveLength(2);
    expect(flushed[1].status).toBe("UP");
    expect(flushed[1].names).toContain("mon-x");
  });

  it("sorts names alphabetically in flush", () => {
    const flushed: CoalesceFlush[] = [];
    const clock = makeClock();
    const c = new KumaDnsCoalescer(1000, clock, (f) => flushed.push(f));
    c.ingest(dnsDownEvent("zebra"));
    c.ingest(dnsDownEvent("alpha"));
    clock.tick(1001);
    expect(flushed[0].names).toEqual(["alpha", "zebra"]);
  });
});

describe("formatDnsFlapSlack", () => {
  it("formats DOWN with multiple monitors", () => {
    const flush: CoalesceFlush = {
      status: "DOWN",
      names: ["api", "web"],
      sampleMsg: "EAI_AGAIN",
      urls: [],
    };
    const { title, text } = formatDnsFlapSlack(flush);
    expect(title).toContain("DOWN");
    expect(title).toContain("2 monitors");
    expect(text).toContain("api");
    expect(text).toContain("web");
  });

  it("formats UP recovery", () => {
    const flush: CoalesceFlush = {
      status: "UP",
      names: ["api"],
      sampleMsg: "",
      urls: [],
    };
    const { title, text } = formatDnsFlapSlack(flush);
    expect(title).toContain("UP");
    expect(text).toContain("api");
  });

  it("uses singular 'monitor' for single monitor", () => {
    const flush: CoalesceFlush = { status: "DOWN", names: ["api"], sampleMsg: "x", urls: [] };
    expect(formatDnsFlapSlack(flush).title).toContain("1 monitor");
    expect(formatDnsFlapSlack(flush).title).not.toContain("1 monitors");
  });
});

describe("singleton helpers", () => {
  it("getKumaDnsCoalescer returns a stable instance", () => {
    resetKumaDnsCoalescerForTests();
    const a = getKumaDnsCoalescer();
    const b = getKumaDnsCoalescer();
    expect(a).toBe(b);
  });

  it("resetKumaDnsCoalescerForTests clears buffered state", () => {
    resetKumaDnsCoalescerForTests();
    const c = getKumaDnsCoalescer();
    c.ingest(dnsDownEvent("mon-z"));
    resetKumaDnsCoalescerForTests(); // should not throw
  });
});
