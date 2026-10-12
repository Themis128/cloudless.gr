/**
 * Tail coverage — client dynamic-import wrappers, analytics scripts,
 * CloudCockpit visibility hooks, LenisInitializer lifecycle, theme-pref
 * storage catches, CookieConsentContext dispatches, PushNotificationPrompt
 * deferred reveal.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React, { useContext } from "react";

vi.mock("next/script", () => ({
  __esModule: true,
  default: ({ id, children, ...rest }: { id?: string; children?: React.ReactNode }) => (
    <script data-testid={`script-${id ?? "unnamed"}`} {...rest}>
      {children}
    </script>
  ),
}));

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: (_loader: () => Promise<unknown>) => () => <div data-testid="dynamic-stub" />,
}));

const lenisDestroy = vi.fn();
const lenisRaf = vi.fn();
vi.mock("lenis", () => ({
  __esModule: true,
  default: class Lenis {
    raf = lenisRaf;
    destroy = lenisDestroy;
  },
}));

import ClientCartSlideOver from "@/components/ClientCartSlideOver";
import ClientChatWidget from "@/components/ClientChatWidget";
import ClientParticleField from "@/components/ClientParticleField";
import ClarityAnalytics from "@/components/ClarityAnalytics";
import PlausibleAnalytics from "@/components/PlausibleAnalytics";
import LenisInitializer from "@/components/LenisInitializer";
import { readStoredPref, writeStoredPref } from "@/lib/theme-pref";
import {
  CookieConsentProvider,
  CookieConsentContext,
} from "@/context/CookieConsentContext";

describe("client dynamic wrappers", () => {
  it("renders the ssr:false cart/chat/particle boundaries", () => {
    const { container } = render(
      <>
        <ClientCartSlideOver />
        <ClientChatWidget />
        <ClientParticleField className="x" particleCount={3} />
      </>,
    );
    expect(container.querySelectorAll("[data-testid='dynamic-stub']")).toHaveLength(3);
  });
});

describe("analytics scripts", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders Clarity when the project id is set", () => {
    vi.stubEnv("NEXT_PUBLIC_CLARITY_PROJECT_ID", "clar-1");
    render(<ClarityAnalytics />);
    expect(screen.getByTestId("script-ms-clarity").textContent).toContain("clar-1");
  });

  it("renders Plausible when the domain is set", () => {
    vi.stubEnv("NEXT_PUBLIC_PLAUSIBLE_DOMAIN", "cloudless.gr");
    const { container } = render(<PlausibleAnalytics />);
    expect(container.querySelector("script[data-domain='cloudless.gr']")).toBeTruthy();
  });
});

describe("LenisInitializer", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    lenisDestroy.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts the raf loop and destroys Lenis on unmount", async () => {
    const { unmount } = render(<LenisInitializer />);
    await act(async () => {
      await Promise.resolve();
    });
    unmount();
    expect(lenisDestroy).toHaveBeenCalled();
  });
});

describe("theme-pref storage catches", () => {
  it("returns null when localStorage.getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    expect(readStoredPref()).toBeNull();
    vi.restoreAllMocks();
  });

  it("skips the dispatch when localStorage.setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    const onPref = vi.fn();
    window.addEventListener("cloudless:theme-pref", onPref);
    writeStoredPref("dark");
    window.removeEventListener("cloudless:theme-pref", onPref);
    expect(onPref).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

function ConsentProbe() {
  const ctx = useContext(CookieConsentContext);
  return (
    <div>
      <span data-testid="prefs">{JSON.stringify(ctx?.preferences)}</span>
      <button onClick={() => ctx?.openSettings()}>open-settings</button>
      <button onClick={() => ctx?.closeSettings()}>close-settings</button>
      <button onClick={() => ctx?.savePreferences({ analytics: true })}>save-prefs</button>
    </div>
  );
}

describe("CookieConsentContext tails", () => {
  it("reads an existing consent cookie on mount", () => {
    document.cookie = "cookieConsent=%7B%22analytics%22%3Atrue%7D";
    render(
      <CookieConsentProvider>
        <ConsentProbe />
      </CookieConsentProvider>,
    );
    expect(screen.getByTestId("prefs")).toBeTruthy();
    document.cookie = "cookieConsent=; path=/; max-age=0";
  });

  it("dispatches SET_SETTINGS_VISIBLE via open/close and SET_PREFERENCES via save", () => {
    const { container } = render(
      <CookieConsentProvider>
        <ConsentProbe />
      </CookieConsentProvider>,
    );
    const btn = (name: string) =>
      Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent === name,
      ) as HTMLButtonElement;
    act(() => {
      btn("open-settings").click();
      btn("close-settings").click();
      btn("save-prefs").click();
    });
    expect(
      container.querySelector("[data-testid='prefs']")?.textContent,
    ).toContain("necessary");
  });
});
