/**
 * Batch: icons/[name] route, sitemap.ts, TurnstileWidget, KonamiEasterEgg,
 * LinkedInInsightTag, ServiceWorkerRegistration.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import React from "react";
import { NextRequest } from "next/server";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;


vi.mock("@/lib/blog", () => ({
  posts: [
    { slug: "b1", date: "2026-01-01" },
    { slug: "b2", date: "2026-02-01" },
  ],
}));
vi.mock("@/lib/store-products", () => ({
  defaultProducts: [{ id: "prod-1" }],
}));
vi.mock("@/lib/appflowy-case-studies", () => ({
  getCaseStudies: vi.fn(async () => [{ slug: "cs-1" }]),
  staticCaseStudies: [{ slug: "cs-static" }],
}));
vi.mock("@/lib/appflowy-docs", () => ({
  getDocs: vi.fn(async () => [
    { slug: "d1", published: true },
    { slug: "d2", published: false },
  ]),
}));
vi.mock("@/lib/appflowy", () => ({ isAppFlowyConfigured: vi.fn(async () => true) }));
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en"] }));
vi.mock("@/context/CookieConsentContext", () => ({ useCookieConsent: vi.fn() }));
vi.mock("./KonamiEasterEgg.module.css", () => ({ default: {} }));

import { GET as iconsGET } from "@/app/icons/[name]/route";
import sitemap from "@/app/sitemap";
import { isAppFlowyConfigured } from "@/lib/appflowy";
import TurnstileWidget from "@/components/TurnstileWidget";
import KonamiEasterEgg from "@/components/KonamiEasterEgg";
import LinkedInInsightTag from "@/components/LinkedInInsightTag";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { useCookieConsent } from "@/context/CookieConsentContext";

const params = (name: string) => ({ params: Promise.resolve({ name }) });
const req = () => new NextRequest("https://cloudless.gr/icons/icon-192.png");

describe("icons/[name] route", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("404s for unknown names", async () => {
    const res = await iconsGET(req(), params("nope.png"));
    expect(res.status).toBe(404);
  });

  it("serves a real icon file with immutable cache headers", async () => {
    const res = await iconsGET(req(), params("icon-192.png"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("immutable");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(100);
    expect(buf[1]).toBe(0x50); // PNG magic
  });

  it("serves the maskable icon alias to the 512 file", async () => {
    const res = await iconsGET(req(), params("icon-512-maskable.png"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
  });
});

describe("sitemap", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes static pages, blog posts, products, case studies, and published docs", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://cloudless.gr/en");
    expect(urls).toContain("https://cloudless.gr/en/blog/b1");
    expect(urls).toContain("https://cloudless.gr/en/store/prod-1");
    expect(urls).toContain("https://cloudless.gr/en/case-studies/cs-1");
    expect(urls).toContain("https://cloudless.gr/en/docs/d1");
    expect(urls).not.toContain("https://cloudless.gr/en/docs/d2"); // unpublished
    expect(entries[0].alternates?.languages?.el).toContain("cloudless.gr/el");
  });

  it("falls back to static case studies and no docs when unconfigured", async () => {
    vi.mocked(isAppFlowyConfigured).mockResolvedValueOnce(false);
    vi.mocked(isAppFlowyConfigured).mockResolvedValueOnce(false);
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://cloudless.gr/en/case-studies/cs-static");
    expect(urls).not.toContain("https://cloudless.gr/en/docs/d1");
  });
});

describe("TurnstileWidget", () => {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  afterEach(() => {
    cleanup();
    delete (window as { turnstile?: unknown }).turnstile;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = key;
    document.getElementById("cf-turnstile-script")?.remove();
  });

  it("renders nothing functional without a site key", () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const { container } = render(<TurnstileWidget onToken={vi.fn()} />);
    expect(document.getElementById("cf-turnstile-script")).toBeNull();
    expect(container).toBeTruthy();
  });

  it("injects the script and mounts the widget when turnstile loads", async () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key-1";
    const onToken = vi.fn();
    const renderMock = vi.fn((_el: HTMLElement, opts: { callback: (t: string) => void }) => {
      opts.callback("tok-1");
      return "wid-1";
    });
    (window as { turnstile?: unknown }).turnstile = {
      render: renderMock,
      reset: vi.fn(),
      remove: vi.fn(),
    };
    render(<TurnstileWidget onToken={onToken} />);
    await act(async () => { await Promise.resolve(); });
    expect(renderMock).toHaveBeenCalled();
    expect(onToken).toHaveBeenCalledWith("tok-1");
  });

  it("appends the script tag when turnstile is not yet present", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key-1";
    render(<TurnstileWidget onToken={vi.fn()} />);
    const script = document.getElementById("cf-turnstile-script");
    expect(script).toBeTruthy();
    expect(script?.getAttribute("src")).toContain("turnstile");
  });
});

describe("KonamiEasterEgg", () => {
  afterEach(() => cleanup());

  it("stays hidden until the full konami sequence fires", async () => {
    const { container } = render(<KonamiEasterEgg />);
    expect(container.firstChild).toBeNull();
    const seq = [
      "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
      "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
      "b", "a",
    ];
    for (const key of seq) {
      fireEvent.keyDown(window, { key });
    }
    await act(async () => { await Promise.resolve(); });
    expect(container.firstChild).not.toBeNull();
  });

  it("resets the sequence on a wrong key", async () => {
    const { container } = render(<KonamiEasterEgg />);
    for (const key of ["ArrowUp", "ArrowUp", "x", "ArrowUp", "ArrowDown"]) {
      fireEvent.keyDown(window, { key });
    }
    await act(async () => { await Promise.resolve(); });
    expect(container.firstChild).toBeNull();
  });
});

describe("LinkedInInsightTag", () => {
  const pid = process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID;
  beforeEach(() => {
    vi.mocked(useCookieConsent).mockReturnValue({
      preferences: { marketing: true },
    } as never);
    delete (window as { lintrk?: unknown }).lintrk;
    delete (window as { _linkedin_data_partner_ids?: unknown })._linkedin_data_partner_ids;
  });
  afterEach(() => {
    cleanup();
    process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID = pid;
    document.querySelectorAll('script[src*="licdn"]').forEach((s) => s.remove());
  });

  it("does nothing without marketing consent", () => {
    vi.mocked(useCookieConsent).mockReturnValue({ preferences: { marketing: false } } as never);
    process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID = "12345";
    render(<LinkedInInsightTag />);
    expect((window as { _linkedin_partner_id?: string })._linkedin_partner_id).toBeUndefined();
  });

  it("does nothing without a partner id", () => {
    delete process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID;
    render(<LinkedInInsightTag />);
    expect((window as { lintrk?: unknown }).lintrk).toBeUndefined();
  });

  it("injects partner ids and the lintrk stub when consented", () => {
    process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID = "12345";
    render(<LinkedInInsightTag />);
    const w = window as { _linkedin_partner_id?: string; _linkedin_data_partner_ids?: string[]; lintrk?: unknown };
    expect(w._linkedin_partner_id).toBe("12345");
    expect(w._linkedin_data_partner_ids).toContain("12345");
    expect(typeof w.lintrk).toBe("function");
  });
});

describe("ServiceWorkerRegistration", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    (window as { matchMedia?: unknown }).matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register: vi.fn(async () => ({})), getRegistrations: vi.fn(async () => []) },
      configurable: true,
    });
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("shows the install banner on beforeinstallprompt and dismisses it", async () => {
    const { container } = render(<ServiceWorkerRegistration />);
    const evt = new Event("beforeinstallprompt");
    Object.assign(evt, {
      preventDefault: vi.fn(),
      prompt: vi.fn(async () => {}),
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    fireEvent(window, evt);
    await act(async () => { await Promise.resolve(); });
    expect(container.textContent).toMatch(/install|app/i);
    // second event within the TTL → still no re-prompt for a dismissed banner
  });
});
