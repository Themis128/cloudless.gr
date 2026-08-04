/**
 * Coalesce Kuma webhook bursts that share a DNS-resolution failure.
 *
 * A control-plane / resolver flap produces N nearly-simultaneous
 * `getaddrinfo EAI_AGAIN` DOWNs (and matching UPs on recovery). Without
 * coalescing, Slack gets one message per monitor.
 *
 * Non-DNS failures always pass through immediately.
 */
export const DNS_FAILURE_RE =
  /EAI_AGAIN|ENOTFOUND|getaddrinfo|NXDOMAIN|SERVFAIL|name resolution|DNS_PROBE/i;

const DEFAULT_WINDOW_MS = 90_000;

export type KumaAlertEvent = {
  name: string;
  status: "DOWN" | "UP" | "PENDING" | "MAINTENANCE" | "UNKNOWN";
  msg: string;
  url?: string;
};

export type CoalesceFlush = {
  status: "DOWN" | "UP";
  names: string[];
  sampleMsg: string;
  urls: string[];
};

export type CoalesceResult =
  { action: "passthrough" } | { action: "buffered" } | { action: "flush"; flush: CoalesceFlush };

type Batch = {
  status: "DOWN" | "UP";
  names: Set<string>;
  urls: Set<string>;
  sampleMsg: string;
  timer: ReturnType<typeof setTimeout>;
};

export type CoalesceClock = {
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
};

const DEFAULT_CLOCK: CoalesceClock = {
  setTimeout: ((...args: Parameters<typeof setTimeout>) =>
    globalThis.setTimeout(...args)) as typeof setTimeout,
  clearTimeout: ((...args: Parameters<typeof clearTimeout>) =>
    globalThis.clearTimeout(...args)) as typeof clearTimeout,
};

export class KumaDnsCoalescer {
  private batch: Batch | null = null;
  private readonly recentDnsDown = new Set<string>();
  private recentDnsDownTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly clock: CoalesceClock;
  private readonly onFlush: (flush: CoalesceFlush) => void;

  constructor(
    private readonly windowMs: number = DEFAULT_WINDOW_MS,
    clock: CoalesceClock | undefined = undefined,
    onFlush: (flush: CoalesceFlush) => void = () => {}
  ) {
    this.clock = clock ?? DEFAULT_CLOCK;
    this.onFlush = onFlush;
  }

  /** Test / restart helper. */
  reset(): void {
    if (this.batch) this.clock.clearTimeout(this.batch.timer);
    if (this.recentDnsDownTimer) this.clock.clearTimeout(this.recentDnsDownTimer);
    this.batch = null;
    this.recentDnsDown.clear();
    this.recentDnsDownTimer = null;
  }

  ingest(event: KumaAlertEvent): CoalesceResult {
    const dnsDown = event.status === "DOWN" && DNS_FAILURE_RE.test(event.msg);
    const dnsUp =
      event.status === "UP" &&
      (DNS_FAILURE_RE.test(event.msg) || this.recentDnsDown.has(event.name));

    if (!dnsDown && !dnsUp) {
      return { action: "passthrough" };
    }

    const status: "DOWN" | "UP" = dnsDown ? "DOWN" : "UP";
    return this.buffer(status, event);
  }

  private buffer(status: "DOWN" | "UP", event: KumaAlertEvent): CoalesceResult {
    if (this.batch && this.batch.status !== status) {
      this.flushNow();
    }

    if (!this.batch) {
      this.batch = {
        status,
        names: new Set([event.name]),
        urls: new Set(event.url ? [event.url] : []),
        sampleMsg: event.msg,
        timer: this.clock.setTimeout(() => this.flushNow(), this.windowMs),
      };
      return { action: "buffered" };
    }

    this.batch.names.add(event.name);
    if (event.url) this.batch.urls.add(event.url);
    if (event.msg) this.batch.sampleMsg = event.msg;
    this.clock.clearTimeout(this.batch.timer);
    this.batch.timer = this.clock.setTimeout(() => this.flushNow(), this.windowMs);
    return { action: "buffered" };
  }

  private flushNow(): void {
    if (!this.batch) return;
    const { status, names, urls, sampleMsg, timer } = this.batch;
    this.clock.clearTimeout(timer);
    this.batch = null;

    const flush: CoalesceFlush = {
      status,
      names: [...names].sort((a, b) => a.localeCompare(b)),
      sampleMsg,
      urls: [...urls],
    };

    if (status === "DOWN") {
      for (const n of flush.names) this.recentDnsDown.add(n);
      if (this.recentDnsDownTimer) this.clock.clearTimeout(this.recentDnsDownTimer);
      // Remember DNS-down names long enough to coalesce matching UPs.
      this.recentDnsDownTimer = this.clock.setTimeout(() => {
        this.recentDnsDown.clear();
        this.recentDnsDownTimer = null;
      }, this.windowMs * 4);
    } else {
      for (const n of flush.names) this.recentDnsDown.delete(n);
    }

    this.onFlush(flush);
  }
}

/**
 * Module-level singleton coalescer used by the Kuma webhook route.
 *
 * Kept in this lib (not in the route module) because Next.js 16 validates
 * Route exports — a test-only helper exported from `route.ts` fails type
 * checking with "is not a valid Route export field". Tests reset the
 * singleton via {@link resetKumaDnsCoalescerForTests} instead.
 */
let singleton: KumaDnsCoalescer | null = null;

export function getKumaDnsCoalescer(
  onFlush: (flush: CoalesceFlush) => void = () => {}
): KumaDnsCoalescer {
  if (!singleton) {
    singleton = new KumaDnsCoalescer(DEFAULT_WINDOW_MS, undefined, onFlush);
  }
  return singleton;
}

/** Test / dev helper — clears buffered state between test cases. */
export function resetKumaDnsCoalescerForTests(): void {
  getKumaDnsCoalescer().reset();
}

export function formatDnsFlapSlack(flush: CoalesceFlush): { title: string; text: string } {
  const n = flush.names.length;
  if (flush.status === "DOWN") {
    return {
      title: `Kuma DOWN: DNS flap (${n} monitor${n === 1 ? "" : "s"})`,
      text: [
        `DNS resolution failed across ${n} probe${n === 1 ? "" : "s"} (likely CoreDNS / node resolver stall, not app outages).`,
        "",
        flush.names.map((name) => `• ${name}`).join("\n"),
        "",
        `Sample: ${flush.sampleMsg || "getaddrinfo EAI_AGAIN"}`,
      ].join("\n"),
    };
  }
  return {
    title: `Kuma UP: DNS recovered (${n} monitor${n === 1 ? "" : "s"})`,
    text: [
      `DNS resolution recovered for ${n} probe${n === 1 ? "" : "s"}.`,
      "",
      flush.names.map((name) => `• ${name}`).join("\n"),
    ].join("\n"),
  };
}
