import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, act } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import HotjarAnalytics from "@/components/HotjarAnalytics";
import { CookieConsentContext, type CookieConsentState } from "@/context/CookieConsentContext";

function makeConsent(analytics: boolean): CookieConsentState {
  return {
    hasConsented: true,
    preferences: { necessary: true, analytics, marketing: false },
    bannerVisible: false,
    settingsVisible: false,
    acceptAll: vi.fn(),
    rejectAll: vi.fn(),
    savePreferences: vi.fn(),
    openSettings: vi.fn(),
    closeSettings: vi.fn(),
  };
}

function Wrapper({ analytics }: { analytics: boolean }) {
  return (
    <CookieConsentContext value={makeConsent(analytics)}>
      <HotjarAnalytics />
    </CookieConsentContext>
  );
}

describe("HotjarAnalytics", () => {
  afterEach(() => {
    cleanup();
    document.head.querySelectorAll('script[src*="hotjar"]').forEach((s) => s.remove());
    // @ts-expect-error – cleaning up globals
    delete window.hj;
    // @ts-expect-error – cleaning up globals
    delete window._hjSettings;
  });

  it("does not inject the hj.js script without analytics consent", () => {
    render(<Wrapper analytics={false} />);
    expect(document.head.querySelector('script[src*="hotjar"]')).toBeNull();
    expect(window.hj).toBeUndefined();
  });

  it("injects hj.js and sets _hjSettings when analytics consent is granted", () => {
    render(<Wrapper analytics={true} />);
    const script = document.head.querySelector(
      'script[src*="static.hotjar.com/c/hotjar-"]'
    ) as HTMLScriptElement;
    expect(script).toBeTruthy();
    expect(script.src).toContain("hotjar-");
    expect(script.src).toContain(".js?sv=6");
    expect(script.async).toBe(true);
    expect(window._hjSettings).toEqual({ hjid: 6507725, hjsv: 6 });
    expect(typeof window.hj).toBe("function");
  });

  it("queues consent grant through the hj stub", () => {
    render(<Wrapper analytics={true} />);
    const hj = window.hj as unknown as { q?: unknown[][] };
    expect(hj.q).toBeDefined();
    expect(hj.q).toContainEqual(["consent", true]);
  });

  it("calls hj('consent', false) when consent is withdrawn after grant", async () => {
    function Dynamic({ children }: { children: (set: (a: boolean) => void) => ReactNode }) {
      const [analytics, setAnalytics] = useState(false);
      return (
        <CookieConsentContext value={makeConsent(analytics)}>
          {children(setAnalytics)}
          <HotjarAnalytics />
        </CookieConsentContext>
      );
    }
    let setAnalytics!: (a: boolean) => void;
    render(
      <Dynamic>
        {(set) => {
          setAnalytics = set;
          return null;
        }}
      </Dynamic>
    );
    await act(async () => setAnalytics(true));
    expect(document.head.querySelector('script[src*="hotjar"]')).toBeTruthy();

    const calls: unknown[][] = [];
    (window as { hj?: unknown }).hj = (...a: unknown[]) => calls.push(a);
    await act(async () => setAnalytics(false));
    expect(calls).toContainEqual(["consent", false]);
    // jsdom cannot navigate — window.location.reload() logs "Not implemented"
    // but still exercises the withdrawal path above.
  });

  it("does not double-inject the script on re-render", () => {
    render(<Wrapper analytics={true} />);
    render(<Wrapper analytics={true} />);
    expect(document.head.querySelectorAll('script[src*="static.hotjar.com"]').length).toBe(1);
  });

  it("renders nothing to the DOM", () => {
    const { container } = render(<Wrapper analytics={false} />);
    expect(container.firstChild).toBeNull();
  });
});
