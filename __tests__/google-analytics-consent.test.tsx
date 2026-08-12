import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, act } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import GoogleAnalyticsConsent from "@/components/GoogleAnalyticsConsent";
import { CookieConsentContext, type CookieConsentState } from "@/context/CookieConsentContext";

// Minimal context value factory
function makeConsent(analytics: boolean, marketing: boolean): CookieConsentState {
  return {
    hasConsented: true,
    preferences: { necessary: true, analytics, marketing },
    bannerVisible: false,
    settingsVisible: false,
    acceptAll: vi.fn(),
    rejectAll: vi.fn(),
    savePreferences: vi.fn(),
    openSettings: vi.fn(),
    closeSettings: vi.fn(),
  };
}

function Wrapper({ analytics, marketing }: { analytics: boolean; marketing: boolean }) {
  return (
    <CookieConsentContext value={makeConsent(analytics, marketing)}>
      <GoogleAnalyticsConsent />
    </CookieConsentContext>
  );
}

// Wrapper that lets tests change preferences after mount
function DynamicWrapper({
  children,
}: {
  children: (set: (analytics: boolean, marketing: boolean) => void) => ReactNode;
}) {
  const [prefs, setPrefs] = useState({ analytics: false, marketing: false });
  return (
    <CookieConsentContext value={makeConsent(prefs.analytics, prefs.marketing)}>
      {children((a, m) => setPrefs({ analytics: a, marketing: m }))}
    </CookieConsentContext>
  );
}

/** Consent Mode v2 payload (analytics + ads + ad_user_data + ad_personalization). */
function consentUpdate(analytics: "granted" | "denied", marketing: "granted" | "denied") {
  return {
    analytics_storage: analytics,
    ad_storage: marketing,
    ad_user_data: marketing,
    ad_personalization: marketing,
  };
}

describe("GoogleAnalyticsConsent", () => {
  let gtag: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gtag = vi.fn();
    window.gtag = gtag;
    window.dataLayer = [];
  });

  afterEach(() => {
    cleanup();
    // @ts-expect-error – cleaning up global
    delete window.gtag;
    // @ts-expect-error – cleaning up global
    delete window.dataLayer;
  });

  it("denies both when analytics and marketing are off", () => {
    render(<Wrapper analytics={false} marketing={false} />);
    expect(gtag).toHaveBeenCalledWith("consent", "update", consentUpdate("denied", "denied"));
  });

  it("grants analytics only when analytics=true, marketing=false", () => {
    render(<Wrapper analytics={true} marketing={false} />);
    expect(gtag).toHaveBeenCalledWith("consent", "update", consentUpdate("granted", "denied"));
  });

  it("grants marketing only when analytics=false, marketing=true", () => {
    render(<Wrapper analytics={false} marketing={true} />);
    expect(gtag).toHaveBeenCalledWith("consent", "update", consentUpdate("denied", "granted"));
  });

  it("grants both when analytics=true and marketing=true", () => {
    render(<Wrapper analytics={true} marketing={true} />);
    expect(gtag).toHaveBeenCalledWith("consent", "update", consentUpdate("granted", "granted"));
  });

  it("does not throw when window.gtag is not a function", () => {
    // @ts-expect-error – simulating missing gtag
    window.gtag = undefined;
    expect(() => render(<Wrapper analytics={true} marketing={true} />)).not.toThrow();
  });

  it("calls gtag once per render (not multiple times)", () => {
    render(<Wrapper analytics={false} marketing={false} />);
    expect(gtag).toHaveBeenCalledTimes(1);
  });

  it("fires an updated consent call when preferences change", async () => {
    let setPrefs!: (analytics: boolean, marketing: boolean) => void;

    render(
      <DynamicWrapper>
        {(set) => {
          setPrefs = set;
          return <GoogleAnalyticsConsent />;
        }}
      </DynamicWrapper>
    );

    // Initial render: both denied
    expect(gtag).toHaveBeenLastCalledWith("consent", "update", consentUpdate("denied", "denied"));

    // User accepts analytics
    await act(async () => {
      setPrefs(true, false);
    });

    expect(gtag).toHaveBeenLastCalledWith("consent", "update", consentUpdate("granted", "denied"));

    // User also accepts marketing
    await act(async () => {
      setPrefs(true, true);
    });

    expect(gtag).toHaveBeenLastCalledWith("consent", "update", consentUpdate("granted", "granted"));

    // Total: 3 calls (initial + 2 updates)
    expect(gtag).toHaveBeenCalledTimes(3);
  });

  it("reverts to denied when user withdraws consent", async () => {
    let setPrefs!: (analytics: boolean, marketing: boolean) => void;

    render(
      <DynamicWrapper>
        {(set) => {
          setPrefs = set;
          return <GoogleAnalyticsConsent />;
        }}
      </DynamicWrapper>
    );

    await act(async () => setPrefs(true, true));
    await act(async () => setPrefs(false, false));

    expect(gtag).toHaveBeenLastCalledWith("consent", "update", consentUpdate("denied", "denied"));
  });

  it("renders nothing to the DOM", () => {
    const { container } = render(<Wrapper analytics={false} marketing={false} />);
    expect(container.firstChild).toBeNull();
  });
});
