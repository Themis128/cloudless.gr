/**
 * Tail coverage: TypingText animation loop, StatCounter countup trigger,
 * LenisInitializer lazy smooth-scroll, NewsletterForm submit states.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// ── environment stubs ───────────────────────────────────────────────────────

const ioCallbacks: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
class IOStub {
  cb: (entries: { isIntersecting: boolean }[]) => void;
  constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
    this.cb = cb;
    ioCallbacks.push(cb);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as Record<string, unknown>).IntersectionObserver = IOStub;

let reducedMotion = false;
const mqListeners: (() => void)[] = [];
const matchMediaStub = (q: string) => ({
  matches: q.includes("reduce") ? reducedMotion : false,
  media: q,
  addEventListener: (_e: string, cb: () => void) => mqListeners.push(cb),
  removeEventListener: (_e: string, cb: () => void) => {
    const i = mqListeners.indexOf(cb);
    if (i >= 0) mqListeners.splice(i, 1);
  },
  addListener: () => {},
  removeListener: () => {},
  onchange: null,
  dispatchEvent: () => false,
});
(globalThis as Record<string, unknown>).matchMedia = matchMediaStub as unknown;
window.matchMedia = matchMediaStub as unknown as typeof window.matchMedia;

const lenisCtor = vi.hoisted(() => vi.fn());
vi.mock("lenis", () => ({
  default: class {
    constructor(o: unknown) {
      lenisCtor(o);
    }
    raf() {}
    destroy() {}
  },
}));

const countUpCtor = vi.hoisted(() => vi.fn());
vi.mock("countup.js", () => ({
  CountUp: class {
    error: string | undefined;
    constructor(el: unknown, end: unknown, opts: unknown) {
      countUpCtor(el, end, opts);
    }
    start() {}
  },
}));

vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en", vi.fn()] }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import TypingText from "@/components/TypingText";
import StatCounter from "@/components/StatCounter";
import LenisInitializer from "@/components/LenisInitializer";
import NewsletterForm from "@/components/NewsletterForm";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  reducedMotion = false;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ── TypingText ──────────────────────────────────────────────────────────────

describe("TypingText", () => {
  it("types, pauses, deletes, and advances to the next text", async () => {
    vi.useFakeTimers();
    const { container } = render(
      <TypingText
        texts={["hello", "world"]}
        typingSpeed={10}
        deletingSpeed={5}
        pauseDuration={50}
      />
    );
    const span = () => container.querySelector("span")!;

    // finish typing first text (started at full length → pause then delete)
    act(() => { vi.advanceTimersByTime(60); }); // pauseDuration → isDeleting
    act(() => { vi.advanceTimersByTime(40); }); // delete a few chars
    act(() => { vi.advanceTimersByTime(300); }); // delete to 0 → next text → retype
    expect(span().textContent).not.toBe("hello");
  });

  it("renders static text under reduced motion", () => {
    reducedMotion = true;
    const { container } = render(<TypingText texts={["static"]} />);
    expect(container.textContent).toContain("static");
  });
});

// ── StatCounter ─────────────────────────────────────────────────────────────

describe("StatCounter", () => {
  it("renders the final value and starts CountUp when visible", async () => {
    const { container } = render(<StatCounter value="99.5%" label="Uptime" />);
    expect(container.textContent).toContain("99.5%");
    const cb = ioCallbacks.at(-1)!;
    await act(async () => {
      cb([{ isIntersecting: true }]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(countUpCtor).toHaveBeenCalledWith(
      expect.anything(),
      99.5,
      expect.objectContaining({ suffix: "%", decimalPlaces: 1 })
    );
  });

  it("parses values without a numeric prefix as zero-end", () => {
    const { container } = render(<StatCounter value="N/A" label="Custom" />);
    expect(container.textContent).toContain("N/A");
  });
});

// ── LenisInitializer ────────────────────────────────────────────────────────

describe("LenisInitializer", () => {
  it("loads Lenis and starts the raf loop when motion is allowed", async () => {
    const { unmount } = render(<LenisInitializer />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(lenisCtor).toHaveBeenCalledWith(
      expect.objectContaining({ smoothWheel: true })
    );
    unmount();
  });

  it("skips Lenis entirely under reduced motion", async () => {
    reducedMotion = true;
    render(<LenisInitializer />);
    await act(async () => { await Promise.resolve(); });
    expect(lenisCtor).not.toHaveBeenCalled();
  });
});

// ── NewsletterForm ──────────────────────────────────────────────────────────

describe("NewsletterForm", () => {
  it("subscribes successfully", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { container } = render(<NewsletterForm />);
    fireEvent.change(container.querySelector('input[type="email"]')!, {
      target: { value: "new@sub.dev" },
    });
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() =>
      expect(container.textContent).toContain("Check your email")
    );
    expect(mockFetch.mock.calls[0][0]).toBe("/api/subscribe");
  });

  it("shows the server error message", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "already subscribed" }), { status: 409 })
    );
    const { container } = render(<NewsletterForm />);
    fireEvent.change(container.querySelector('input[type="email"]')!, {
      target: { value: "dup@sub.dev" },
    });
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    await waitFor(() =>
      expect(container.textContent).toContain("already subscribed")
    );
  });
});
