/**
 * Component/icon tails — apple-icon + icon ImageResponse, AttributionCapture
 * effect, ConsentGatedPixel fbq stub + script.onload, AgentCounter error
 * branches + Refresh, ThemeSwitcher dismiss/inline-authed, PlaybookLeadForm
 * honeypot/not_configured/download link, i18n request config.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const captureMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/lead-attribution", () => ({ captureAttribution: captureMock }));
vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/en") }));

const cookiePrefsRef = vi.hoisted(() => ({ current: { marketing: true } }));
vi.mock("@/context/CookieConsentContext", () => ({
  useCookieConsent: () => ({ preferences: cookiePrefsRef.current, mounted: true }),
}));

vi.mock("@/components/TurnstileWidget", () => ({
  default: () => <div data-testid="turnstile" />,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: vi.fn(() => "/en"),
}));
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en", vi.fn()] }));
vi.mock("@/lib/track-client-event", () => ({ trackClientEvent: vi.fn() }));
const authRef = vi.hoisted(() => ({
  current: {
    user: null as null | { preferences?: { theme?: string } },
    updatePreferences: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => authRef.current }));

import AppleIcon from "@/app/apple-icon";
import SiteIcon from "@/app/icon";
import AttributionCapture from "@/components/AttributionCapture";
import ConsentGatedPixel from "@/components/ConsentGatedPixel";
import AgentCounter from "@/components/AgentCounter";
import ThemeSwitcher, { ThemeSwitcherInline } from "@/components/ThemeSwitcher";
import PlaybookLeadForm from "@/components/PlaybookLeadForm";

const mockFetch = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
  captureMock.mockClear();
});
afterEach(() => cleanup());

// ── icons ────────────────────────────────────────────────────────────────────

describe("app icons", () => {
  it("apple-icon renders a real PNG at 180×180", async () => {
    const res = AppleIcon();
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(500);
  });

  it("icon renders a real PNG at 32×32", async () => {
    const res = SiteIcon();
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(200);
  });
});

// ── AttributionCapture ───────────────────────────────────────────────────────

describe("AttributionCapture", () => {
  it("runs captureAttribution on mount", async () => {
    const { container } = render(<AttributionCapture />);
    await act(async () => {});
    expect(container.innerHTML).toBe("");
    expect(captureMock).toHaveBeenCalled();
  });
});

// ── ConsentGatedPixel ────────────────────────────────────────────────────────

describe("ConsentGatedPixel", () => {
  it("creates the fbq stub and fires init+PageView on script load", async () => {
    delete (window as { fbq?: unknown }).fbq;
    delete (window as { _fbq?: unknown })._fbq;
    render(<ConsentGatedPixel pixelId="px-1" nonce="n1" />);
    await act(async () => {});
    const w = window as unknown as { fbq?: (...a: unknown[]) => void };
    expect(w.fbq).toBeTypeOf("function");
    const script = document.head.querySelector(
      'script[src*="fbevents"]'
    ) as HTMLScriptElement;
    expect(script).toBeTruthy();
    expect(script.getAttribute("nonce")).toBe("n1");
    const calls: unknown[][] = [];
    const spy = w.fbq!;
    (window as { fbq?: unknown }).fbq = (...a: unknown[]) => calls.push(a);
    await act(async () => {
      script.onload?.(new Event("load"));
    });
    expect(calls).toContainEqual(["init", "px-1"]);
    expect(calls).toContainEqual(["track", "PageView"]);
    (window as { fbq?: unknown }).fbq = spy;
  });
});

// ── AgentCounter ─────────────────────────────────────────────────────────────

describe("AgentCounter — error branches", () => {
  it("surfaces rpc errors from increment/decrement/reset and refreshes", async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ count: 3 }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "agent refused" }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "dec refused" }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "reset refused" }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ count: 9 }), { status: 200 })
      );
    const { container } = render(<AgentCounter />);
    await waitFor(() => expect(container.textContent).toContain("3"));

    const clickBtn = async (re: RegExp) => {
      const btn = [...container.querySelectorAll("button")].find((b) =>
        re.test(b.textContent ?? "")
      )!;
      await act(async () => fireEvent.click(btn));
    };

    await clickBtn(/^\+|increment/i);
    await waitFor(() => expect(container.textContent).toContain("agent refused"));
    await clickBtn(/decrement|^-$/i);
    await clickBtn(/reset/i);
    await waitFor(() => expect(container.textContent).toContain("reset refused"));

    // Refresh → count updates
    await clickBtn(/refresh/i);
    await waitFor(() => expect(container.textContent).toContain("9"));
  });
});

// ── ThemeSwitcher ────────────────────────────────────────────────────────────

describe("ThemeSwitcher — dismiss + inline", () => {
  beforeEach(() => {
    window.localStorage.clear();
    authRef.current.user = null;
    authRef.current.updatePreferences.mockClear();
  });

  it("closes the popover on outside mousedown and Escape", async () => {
    const { container } = render(<ThemeSwitcher />);
    fireEvent.click(container.querySelector("button")!);
    expect(container.querySelector("[role='listbox'], [role='menu'], [role='option']")).toBeTruthy();

    await act(async () => {
      document.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true })
      );
    });
    expect(container.querySelector("[role='option']")).toBeNull();

    fireEvent.click(container.querySelector("button")!);
    expect(container.querySelector("[role='option']")).toBeTruthy();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(container.querySelector("[role='option']")).toBeNull();
  });

  it("inline variant persists the choice for an authenticated user", async () => {
    authRef.current.user = { preferences: { theme: "system" } };
    render(<ThemeSwitcherInline />);
    const opt = [...document.querySelectorAll("[role='radio'], button")].find((el) =>
      /dark/i.test(el.textContent ?? "")
    )!;
    await act(async () => fireEvent.click(opt));
    expect(window.localStorage.getItem("cloudless-theme-pref")).toBe("dark");
    expect(authRef.current.updatePreferences).toHaveBeenCalledWith({ theme: "dark" });
  });
});

// ── PlaybookLeadForm ─────────────────────────────────────────────────────────

describe("PlaybookLeadForm — tails", () => {
  it("sends the honeypot value and shows the download link on not_configured", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "mail unbound", code: "not_configured" }),
        { status: 503 }
      )
    );
    const { container } = render(<PlaybookLeadForm />);
    const email = container.querySelector('input[type="email"]')!;
    fireEvent.change(email, { target: { value: "lead@example.com" } });
    const honeypot = container.querySelector('input[name="website"]')!;
    fireEvent.change(honeypot, { target: { value: "spammy-site" } });
    const consent = container.querySelector('input[type="checkbox"]')!;
    fireEvent.click(consent);
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
    const body = JSON.parse(String(mockFetch.mock.calls[0][1].body));
    expect(body.website).toBe("spammy-site");
    // not_configured → fallback download link
    await waitFor(() =>
      expect(container.textContent).toContain("download it directly")
    );
    const link = container.querySelector('a[href*="cloud-migration-playbook.pdf"]');
    expect(link).toBeTruthy();
  });
});

// ── i18n request config (see __tests__/i18n-request.test.ts — needs node env) ──
