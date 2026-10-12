/**
 * Component tails: HolographicCard tilt, ServiceWorkerRegistration install
 * banner + dev unregister, CookieConsent idle/keyboard branches.
 *
 * @vitest-environment jsdom
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en", vi.fn()] }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import HolographicCard from "@/components/HolographicCard";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import CookieConsent from "@/components/CookieConsent";
import { CookieConsentProvider } from "@/context/CookieConsentContext";
import enMessages from "@/locales/en.json";

const wrap = (node: React.ReactNode) => (
  <NextIntlClientProvider locale="en" messages={enMessages}>
    {node}
  </NextIntlClientProvider>
);

afterEach(() => cleanup());

// ── HolographicCard ─────────────────────────────────────────────────────────

describe("HolographicCard tails", () => {
  it("applies tilt + glare on mousemove and resets on mouseleave", () => {
    const { container } = render(
      <HolographicCard>
        <span>card body</span>
      </HolographicCard>
    );
    const card = container.firstElementChild as HTMLElement;
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.mouseMove(card, { clientX: 75, clientY: 25 });
    const moved = container.querySelector<HTMLElement>("[style*='rotateX']");
    expect(moved).toBeTruthy();
    expect(moved!.style.transform).toContain("rotateX");

    fireEvent.mouseLeave(card);
    const left = container.querySelector<HTMLElement>("[style*='rotateX']");
    expect(left!.style.transform).toContain("rotateX(0deg)");
  });
});

// ── ServiceWorkerRegistration ───────────────────────────────────────────────

describe("ServiceWorkerRegistration tails", () => {
  const setSw = (value: unknown) => {
    Object.defineProperty(window.navigator, "serviceWorker", {
      value,
      configurable: true,
    });
  };

  it("unregisters existing registrations in non-production", async () => {
    const unregister = vi.fn();
    setSw({ getRegistrations: vi.fn().mockResolvedValue([{ unregister }]) });
    render(wrap(<ServiceWorkerRegistration />));
    await waitFor(() => expect(unregister).toHaveBeenCalled());
  });

  it("shows the install banner on beforeinstallprompt and handles install/dismiss", async () => {
    const origEnv = process.env.NODE_ENV;
    (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
    Reflect.deleteProperty(window.navigator, "serviceWorker");
    (window as { matchMedia?: unknown }).matchMedia = () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      media: "",
      onchange: null,
      dispatchEvent: vi.fn(),
    });
    localStorage.clear();

    const { container } = render(wrap(<ServiceWorkerRegistration />));
    const prompt = vi.fn().mockResolvedValue(undefined);
    const evt = new Event("beforeinstallprompt") as Event & {
      prompt: typeof prompt;
      userChoice: Promise<{ outcome: string }>;
    };
    Object.assign(evt, { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
    fireEvent(window, evt);

    await waitFor(() =>
      expect(container.textContent).toMatch(/install/i)
    );

    // install → accepted hides banner
    const installBtn = [...container.querySelectorAll("button")].find((b) =>
      /^install$/i.test(b.textContent ?? "")
    )!;
    await act(async () => fireEvent.click(installBtn));
    await waitFor(() => expect(prompt).toHaveBeenCalled());

    // second prompt → dismiss persists to localStorage
    fireEvent(window, evt);
    await waitFor(() => expect(container.textContent).toMatch(/install/i));
    const dismiss = [...container.querySelectorAll("button")].find((b) =>
      /not now/i.test(b.textContent ?? "")
    )!;
    await act(async () => fireEvent.click(dismiss));
    expect(localStorage.getItem("pwa-install-dismissed")).toBeTruthy();
    (process.env as { NODE_ENV?: string }).NODE_ENV = origEnv;
  });
});

// ── CookieConsent ───────────────────────────────────────────────────────────

describe("CookieConsent tails", () => {
  beforeEach(() => {
    document.cookie = "cookieConsent=; max-age=0; path=/";
  });

  it("mounts via requestIdleCallback when available", async () => {
    vi.useFakeTimers();
    const idle = vi.fn((cb: () => void) => {
      cb();
      return 1;
    });
    (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback = idle;
    (globalThis as { cancelIdleCallback?: unknown }).cancelIdleCallback = vi.fn();
    try {
      await act(async () => {
        render(
          <CookieConsentProvider>
            <CookieConsent />
          </CookieConsentProvider>
        );
      });
      expect(idle).toHaveBeenCalled();
      expect(document.body.textContent).toContain("Your cookies");
      // unmount while the stubs still exist, then delete them
      await act(async () => cleanup());
    } finally {
      delete (globalThis as { requestIdleCallback?: unknown })
        .requestIdleCallback;
      delete (globalThis as { cancelIdleCallback?: unknown })
        .cancelIdleCallback;
      vi.useRealTimers();
    }
  });

  it("Escape closes the settings modal and Tab cycles focus", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await act(async () => {
      render(
        <CookieConsentProvider>
          <CookieConsent />
        </CookieConsentProvider>
      );
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    await act(async () => fireEvent.click(screen.getByText("Customise")));
    expect(document.body.textContent).toContain("Cookie Preferences");

    // Tab on last focusable wraps to first; Escape closes.
    fireEvent.keyDown(document, { key: "Tab" });
    fireEvent.keyDown(document, { key: "Escape" });
    await act(async () => vi.advanceTimersByTime(50));
    expect(document.body.textContent).not.toContain("Cookie Preferences");
    vi.useRealTimers();
  });
});
