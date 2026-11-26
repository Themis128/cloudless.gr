import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import ClarityAnalytics from "@/components/ClarityAnalytics";
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
      <ClarityAnalytics />
    </CookieConsentContext>
  );
}

describe("ClarityAnalytics", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CLARITY_PROJECT_ID", "testproject123");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    document.head.querySelectorAll('script[src*="clarity.ms"]').forEach((s) => s.remove());
    // @ts-expect-error – cleaning up globals
    delete window.clarity;
  });

  it("does not inject the clarity script without analytics consent", () => {
    render(<Wrapper analytics={false} />);
    expect(document.head.querySelector('script[src*="clarity.ms"]')).toBeNull();
  });

  it("injects the clarity.ms tag after analytics consent", () => {
    render(<Wrapper analytics={true} />);
    const script = document.head.querySelector(
      'script[src*="clarity.ms"]'
    ) as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script!.src).toBe("https://www.clarity.ms/tag/testproject123");
    expect(script!.async).toBe(true);
    expect(typeof window.clarity).toBe("function");
  });

  it("calls clarity consent API with granted state", () => {
    render(<Wrapper analytics={true} />);
    const q = (window.clarity as { q?: unknown[][] }).q ?? [];
    expect(q).toContainEqual(["consent", true]);
  });

  it("does not inject when the project id is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_CLARITY_PROJECT_ID", "");
    render(<Wrapper analytics={true} />);
    expect(document.head.querySelector('script[src*="clarity.ms"]')).toBeNull();
  });
});
