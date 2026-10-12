import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";

const { mockTrackPageView, mockHasConsent, mockSendEvent, mockUsePathname } = vi.hoisted(() => ({
  mockTrackPageView: vi.fn(),
  mockHasConsent: vi.fn(),
  mockSendEvent: vi.fn(() => Promise.resolve()),
  mockUsePathname: vi.fn(() => "/services"),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
}));

vi.mock("@/lib/funnel-client", () => ({
  trackPageView: mockTrackPageView,
  hasAnalyticsConsent: mockHasConsent,
}));

vi.mock("@/lib/socialauto-analytics", () => ({
  sendSocialAutoEvent: mockSendEvent,
}));

import PageViewBeacon from "@/components/analytics/PageViewBeacon";
import TypingText from "@/components/TypingText";

describe("PageViewBeacon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/services");
    document.documentElement.lang = "en";
  });

  afterEach(() => cleanup());

  it("tracks the page view and forwards to SocialAuto when consent is granted", () => {
    mockHasConsent.mockReturnValue(true);
    render(<PageViewBeacon />);
    expect(mockTrackPageView).toHaveBeenCalledOnce();
    expect(mockSendEvent).toHaveBeenCalledWith({
      event: "page_view",
      domain: "cloudless.gr",
      path: "/services",
      locale: "en",
    });
  });

  it("tracks locally but skips SocialAuto without analytics consent", () => {
    mockHasConsent.mockReturnValue(false);
    render(<PageViewBeacon />);
    expect(mockTrackPageView).toHaveBeenCalledOnce();
    expect(mockSendEvent).not.toHaveBeenCalled();
  });

  it("dedupes repeated renders on the same pathname but fires on navigation", () => {
    mockHasConsent.mockReturnValue(true);
    const { rerender } = render(<PageViewBeacon />);
    rerender(<PageViewBeacon />);
    expect(mockTrackPageView).toHaveBeenCalledTimes(1);

    mockUsePathname.mockReturnValue("/pricing");
    rerender(<PageViewBeacon />);
    expect(mockTrackPageView).toHaveBeenCalledTimes(2);
    expect(mockSendEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: "/pricing" })
    );
  });
});

describe("TypingText tails", () => {
  const ioCallbacks: Array<(entries: { isIntersecting: boolean }[]) => void> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    ioCallbacks.length = 0;
    class FakeIO {
      observe() {}
      unobserve() {}
      disconnect() {}
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        ioCallbacks.push(cb);
      }
    }
    vi.stubGlobal("IntersectionObserver", FakeIO);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );
    window.matchMedia = globalThis.matchMedia as typeof window.matchMedia;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    cleanup();
  });

  it("types out the first text character by character", async () => {
    const { container } = render(
      <TypingText texts={["ab", "xy"]} initialText="" typingSpeed={50} />
    );
    const el = container.firstChild as HTMLElement;
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(el.textContent).toContain("a");
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(el.textContent).toContain("ab");
  });

  it("pauses, deletes, then cycles to the next text", async () => {
    const { container } = render(
      <TypingText
        texts={["ab", "xy"]}
        initialText="ab"
        typingSpeed={10}
        deletingSpeed={10}
        pauseDuration={100}
      />
    );
    const el = container.firstChild as HTMLElement;
    // Pause elapses → deleting starts.
    // Pause → delete both chars → reset → start typing the next text.
    for (const step of [100, 10, 10, 10, 10, 10, 30]) {
      await act(async () => {
        vi.advanceTimersByTime(step);
      });
    }
    expect(el.textContent).toContain("xy");
  });

  it("stops animating when the IntersectionObserver reports it off-screen", async () => {
    const { container } = render(
      <TypingText texts={["ab"]} initialText="" typingSpeed={50} />
    );
    const el = container.firstChild as HTMLElement;
    await act(async () => {
      ioCallbacks[0]?.([{ isIntersecting: false }]);
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(el.textContent).not.toContain("a");
  });
});
