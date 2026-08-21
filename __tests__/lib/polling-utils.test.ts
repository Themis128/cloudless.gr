import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  acquirePollLock,
  releasePollLock,
  getEffectiveInterval,
  recordPollSuccess,
  recordPollError,
  resetPollingState,
  isPageVisible,
  createThrottledFetch,
} from "@/lib/polling-utils";

const POLLING_KEY = "cloudless:polling:lock";
const POLLING_STATE_KEY = "cloudless:polling:state";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("acquirePollLock", () => {
  it("acquires lock when none exists", () => {
    expect(acquirePollLock(5000)).toBe(true);
    expect(localStorage.getItem(POLLING_KEY)).toBe("1005000");
  });

  it("blocks when an unexpired lock exists", () => {
    localStorage.setItem(POLLING_KEY, "1005000"); // expires in 5s
    expect(acquirePollLock()).toBe(false);
  });

  it("acquires when the existing lock is expired", () => {
    localStorage.setItem(POLLING_KEY, "999999"); // 1ms in the past
    expect(acquirePollLock(5000)).toBe(true);
  });
});

describe("releasePollLock", () => {
  it("removes the lock", () => {
    localStorage.setItem(POLLING_KEY, "1005000");
    releasePollLock();
    expect(localStorage.getItem(POLLING_KEY)).toBeNull();
  });
});

describe("getEffectiveInterval", () => {
  it("returns base interval when state is clean", () => {
    expect(getEffectiveInterval(10_000)).toBe(10_000);
  });

  it("returns base interval after a recent success", () => {
    recordPollSuccess();
    expect(getEffectiveInterval(10_000)).toBe(10_000);
  });

  it("applies exponential backoff after errors", () => {
    // Simulate 2 consecutive errors by recording them
    const fakeResponse = new Response(null, {
      status: 429,
      headers: {},
    });
    recordPollError(fakeResponse);
    recordPollError(fakeResponse);
    // 2 errors → backoffUntil is in the future → backoff kicks in
    const interval = getEffectiveInterval(10_000);
    expect(interval).toBeGreaterThan(10_000);
  });

  it("respects Retry-After header", () => {
    const retryResponse = new Response(null, {
      status: 429,
      headers: { "Retry-After": "60" },
    });
    recordPollError(retryResponse);
    const interval = getEffectiveInterval(10_000);
    // Should wait ~60s for the Retry-After
    expect(interval).toBeGreaterThanOrEqual(59_000);
  });

  it("caps backoff at maxBackoff", () => {
    const fakeResponse = new Response(null, { status: 429, headers: {} });
    for (let i = 0; i < 10; i++) recordPollError(fakeResponse);
    const interval = getEffectiveInterval(1_000, 5_000);
    expect(interval).toBeLessThanOrEqual(5_000);
  });
});

describe("recordPollSuccess", () => {
  it("resets error counters", () => {
    const fakeResponse = new Response(null, { status: 429, headers: {} });
    recordPollError(fakeResponse);
    recordPollSuccess();
    // After success backoff should be gone — base interval applies
    expect(getEffectiveInterval(10_000)).toBe(10_000);
  });
});

describe("resetPollingState", () => {
  it("clears all state", () => {
    const fakeResponse = new Response(null, { status: 429, headers: {} });
    recordPollError(fakeResponse);
    resetPollingState();
    expect(getEffectiveInterval(10_000)).toBe(10_000);
  });
});

describe("isPageVisible", () => {
  it("returns true when visibilityState is visible", () => {
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    expect(isPageVisible()).toBe(true);
  });

  it("returns false when visibilityState is hidden", () => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    expect(isPageVisible()).toBe(false);
  });
});

describe("createThrottledFetch", () => {
  beforeEach(() => {
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });

  it("calls the base fetcher and records success", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const throttled = createThrottledFetch(fetcher, 5_000);
    const result = await throttled();
    expect(result.status).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("deduplicates concurrent calls", async () => {
    let resolveFirst!: () => void;
    const pending = new Promise<Response>((res) => {
      resolveFirst = () => res(new Response(null, { status: 200 }));
    });
    const fetcher = vi.fn().mockReturnValue(pending);
    const throttled = createThrottledFetch(fetcher, 5_000);

    const p1 = throttled();
    const p2 = throttled(); // second call while first is in-flight
    resolveFirst();

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(fetcher).toHaveBeenCalledOnce(); // only one real fetch
    expect(r1).toBe(r2); // same promise object
  });

  it("rejects when page is hidden", async () => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    const fetcher = vi.fn();
    const throttled = createThrottledFetch(fetcher, 5_000);
    await expect(throttled()).rejects.toThrow("Page is hidden");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
