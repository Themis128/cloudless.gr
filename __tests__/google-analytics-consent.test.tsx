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
    expect(gtag).toHaveBeenCalledWith("consent", "update", {
      analytics_storage: "denied",
      ad_storage: "denied",
    });
  });

  it("grants analytics only when analytics=true, marketing=false", () => {
    render(<Wrapper analytics={true} marketing={false} />);
    expect(gtag).toHaveBeenCalledWith("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "denied",
    });
  });

  it("grants marketing only when analytics=false, marketing=true", () => {
    render(<Wrapper analytics={false} marketing={true} />);
    expect(gtag).toHaveBeenCalledWith("consent", "update", {
      analytics_storage: "denied",
      ad_storage: "granted",
    });
  });

  it("grants both when analytics=true and marketing=true", () => {
    render(<Wrapper analytics={true} marketing={true} />);
    expect(gtag).toHaveBeenCalledWith("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "granted",
    });
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
    expect(gtag).toHaveBeenLastCalledWith("consent", "update", {
      analytics_storage: "denied",
      ad_storage: "denied",
    });

    // User accepts analytics
    await act(async () => {
      setPrefs(true, false);
    });

    expect(gtag).toHaveBeenLastCalledWith("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "denied",
    });

    // User also accepts marketing
    await act(async () => {
      setPrefs(true, true);
    });

    expect(gtag).toHaveBeenLastCalledWith("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "granted",
    });

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

    expect(gtag).toHaveBeenLastCalledWith("consent", "update", {
      analytics_storage: "denied",
      ad_storage: "denied",
    });
  });

  it("renders nothing to the DOM", () => {
    const { container } = render(<Wrapper analytics={false} marketing={false} />);
    expect(container.firstChild).toBeNull();
  });
});
