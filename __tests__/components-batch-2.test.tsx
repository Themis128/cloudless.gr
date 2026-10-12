/**
 * Component behavior batch — ChatWidget SSE streaming, TierTable lead form,
 * NeonCursor pointer gating, CookieConsent banner/settings via the real
 * provider, WaitingRoomClient enroll/poll/redirect flows.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/* ── shared seams ────────────────────────────────────────── */

const fetchMock = vi.fn();
const fetchWithAuthMock = vi.fn();
const pushMock = vi.fn();
const conversionMock = vi.fn();
let authUser: { name: string; email: string } | null = { name: "Themis", email: "t@x.gr" };
let authLoading = false;
let searchParamsMap = new URLSearchParams();

vi.stubGlobal("fetch", (...args: Parameters<typeof fetch>) => fetchMock(...args));

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: Parameters<typeof fetch>) => fetchWithAuthMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsMap,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: authUser, isLoading: authLoading }),
}));

vi.mock("@/lib/lead-attribution", () => ({
  getStoredAttribution: () => ({ source: "li", campaign: "c1" }),
}));

vi.mock("@/lib/fire-campaign-conversion", () => ({
  fireCampaignConversion: (...args: unknown[]) => conversionMock(...args),
}));

vi.mock("@/lib/use-locale", () => ({
  useCurrentLocale: () => ["en", vi.fn()],
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import ChatWidget from "@/components/ChatWidget";
import TierTable from "@/components/TierTable";
import NeonCursor from "@/components/NeonCursor";
import CookieConsent from "@/components/CookieConsent";
import { CookieConsentProvider } from "@/context/CookieConsentContext";
import WaitingRoomClient from "@/app/portal/waiting/WaitingRoomClient";

const click = async (el: Element) => {
  await act(async () => fireEvent.click(el));
};
const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

const sse = (chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(ctrl) {
      const enc = new TextEncoder();
      for (const c of chunks) ctrl.enqueue(enc.encode(c));
      ctrl.close();
    },
  });

/* ── ChatWidget ──────────────────────────────────────────── */

describe("ChatWidget", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(cleanup);

  it("opens, streams SSE chunks into the assistant bubble", async () => {
    let c: HTMLElement | undefined;
    await act(async () => {
      c = render(<ChatWidget />).container;
    });
    await click(screen.getByLabelText("Open chat assistant"));
    expect(c!.textContent).toContain("Cloudless Assistant");
    expect(c!.textContent).toContain("What services do you offer?");

    fetchMock.mockResolvedValueOnce(
      new Response(
        sse([
          'data: {"text":"Hello "}\n',
          'data: {"text":"world"}\ndata: {"text":"!"}\n',
          "data: {bad json}\ndata: [DONE]\n",
        ]),
        { status: 200 }
      )
    );
    await click(screen.getByText("What services do you offer?"));
    expect(c!.textContent).toContain("Hello world!");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]!.body));
    expect(body.messages.at(-1).content).toBe("What services do you offer?");

    // suggestions gone after first turn
    expect(c!.textContent).not.toContain("How much does it cost?");
  });

  it("non-ok response → unavailable message; fetch throw → connection error", async () => {
    let c: HTMLElement | undefined;
    await act(async () => {
      c = render(<ChatWidget />).container;
    });
    await click(screen.getByLabelText("Open chat assistant"));

    fetchMock.mockResolvedValueOnce(okJson({}, 500));
    const input = c!.querySelector("input")!;
    fireEvent.change(input, { target: { value: "q" } });
    await click(screen.getByText("Send"));
    expect(c!.textContent).toContain("I'm unavailable right now");

    fetchMock.mockRejectedValueOnce(new Error("down"));
    fireEvent.change(input, { target: { value: "q2" } });
    await click(screen.getByText("Send"));
    expect(c!.textContent).toContain("Connection error");

    // Enter key sends too
    fetchMock.mockResolvedValueOnce(
      new Response(sse(['data: {"text":"k"}\ndata: [DONE]\n']), { status: 200 })
    );
    fireEvent.change(input, { target: { value: "q3" } });
    await act(async () => fireEvent.keyDown(input, { key: "Enter" }));
    await flush();
    expect(c!.textContent).toContain("k");
  });
});

/* ── TierTable ───────────────────────────────────────────── */

const CAMPAIGN = {
  slug: "camp1",
  status: "live" as const,
  startsAt: "2026-01-01",
  endsAt: "2026-12-31",
  tagline: { en: "t", el: "t" },
  headline: { en: "h", el: "h" },
  headlineAccent: { en: "a", el: "a" },
  subhead: { en: "s", el: "s" },
  heroImage: "/h.png",
  ogImage: "/o.png",
  utmCampaign: "c1",
  linkedinConversionId: 42,
  faq: [],
  tiers: [
    {
      id: "basic",
      name: { en: "Basic", el: "Βασικό" },
      oneOff: "€500",
      highlights: { en: ["h1"], el: ["h1"] },
      cta: { en: "Buy Basic", el: "Αγόρασε" },
      checkoutHref: "/x",
    },
    {
      id: "pro",
      badge: "BEST",
      featured: true,
      name: { en: "Pro", el: "Προ" },
      monthly: "€99/mo",
      savings: { en: "save", el: "save" },
      highlights: { en: ["h2"], el: ["h2"] },
      cta: { en: "Buy Pro", el: "Αγόρασε" },
      checkoutHref: "/y",
    },
  ],
};

describe("TierTable", () => {
  beforeEach(() => fetchMock.mockReset());
  afterEach(cleanup);

  it("CTA → form → submit → success + conversion fire; error path", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    let c: HTMLElement | undefined;
    await act(async () => {
      c = render(<TierTable campaign={CAMPAIGN} locale="en" />).container;
    });
    expect(c!.textContent).toContain("Basic");
    expect(c!.textContent).toContain("BEST");
    expect(c!.textContent).toContain("€99/mo");
    expect(c!.textContent).toContain("save");

    await click(screen.getByText("Buy Pro"));
    expect(c!.textContent).toContain("Get started with Pro");

    // submit error first
    fetchMock.mockResolvedValueOnce(okJson({}, 500));
    const form = c!.querySelector("form")!;
    fireEvent.change(form.querySelector("input[name='name']")!, { target: { value: "N" } });
    fireEvent.change(form.querySelector("input[name='email']")!, { target: { value: "e@x" } });
    fireEvent.change(form.querySelector("input[name='phone']")!, { target: { value: "1" } });
    await act(async () => fireEvent.submit(form));
    await flush();
    expect(c!.textContent).toContain("Something went wrong");

    // success → conversion + success card
    fetchMock.mockResolvedValueOnce(okJson({ ok: true }));
    fireEvent.change(form.querySelector("input[name='name']")!, { target: { value: "N" } });
    fireEvent.change(form.querySelector("input[name='email']")!, { target: { value: "e@x" } });
    fireEvent.change(form.querySelector("input[name='phone']")!, { target: { value: "1" } });
    await act(async () => fireEvent.submit(form));
    await flush();
    expect(c!.textContent).toContain("Thank you! We'll be in touch within 24 hours.");
    expect(conversionMock).toHaveBeenCalledWith(
      expect.objectContaining({ campaign: "camp1", tier: "pro", conversionId: 42 })
    );
    const payload = JSON.parse(String(fetchMock.mock.calls.at(-1)![1]!.body));
    expect(payload.service).toBe("camp1 — Pro");
    expect(payload.attribution).toEqual({ source: "li", campaign: "c1" });
  });

  it("el locale labels", async () => {
    let c: HTMLElement | undefined;
    await act(async () => {
      c = render(<TierTable campaign={CAMPAIGN} locale="el" />).container;
    });
    await click(screen.getAllByText("Αγόρασε")[0]);
    expect(c!.textContent).toContain("Ξεκίνα με Βασικό");
  });
});

/* ── NeonCursor ──────────────────────────────────────────── */

describe("NeonCursor", () => {
  afterEach(cleanup);

  it("hidden on coarse pointers; renders + hides body cursor on fine pointers", async () => {
    window.matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    let c: HTMLElement | undefined;
    await act(async () => {
      c = render(<NeonCursor />).container;
    });
    expect(c!.children.length).toBe(0);
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    cleanup();
    await act(async () => {
      c = render(<NeonCursor />).container;
    });
    await act(async () => {
      // let rAF scheduled setVisible(true) run
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(document.body.style.cursor).toBe("none");
    expect(document.getElementById("neon-cursor-style")).toBeTruthy();
    expect(c!.children.length).toBeGreaterThan(0);
    fireEvent.mouseMove(window, { clientX: 10, clientY: 20 });
    await flush();
  });
});

/* ── CookieConsent (real provider) ───────────────────────── */

describe("CookieConsent", () => {
  beforeEach(() => {
    document.cookie = "cookieConsent=; max-age=0; path=/";
    // requestIdleCallback may not exist in jsdom — component falls back to setTimeout
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  async function renderConsent() {
    let c: HTMLElement | undefined;
    await act(async () => {
      c = render(
        <CookieConsentProvider>
          <CookieConsent />
        </CookieConsentProvider>
      ).container;
    });
    // mount gate (idle callback / setTimeout 1000ms)
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    return c!;
  }

  it("banner → accept all writes cookie + hides", async () => {
    const c = await renderConsent();
    expect(c.textContent).toContain("Your cookies, your choice");
    await click(screen.getByText("Accept all"));
    expect(c.textContent).not.toContain("Your cookies, your choice");
    expect(document.cookie).toContain("cookieConsent=");
  });

  it("customise → modal toggles → save preferences; reject hides", async () => {
    const c = await renderConsent();
    await click(screen.getByText("Customise"));
    expect(c.textContent).toContain("Cookie Preferences");

    // toggle analytics + marketing
    const switches = c.querySelectorAll("button[role='switch']");
    fireEvent.click(switches[0]);
    fireEvent.click(switches[1]);
    await act(async () => fireEvent.click(screen.getByText("Save preferences")));
    expect(document.cookie).toContain("analytics%22%3Atrue");
    expect(document.cookie).toContain("marketing%22%3Atrue");

    // consent cookie already set → banner never appears (null render)
    cleanup();
    const c2 = await renderConsent();
    expect(c2.textContent).not.toContain("Your cookies, your choice");
  });

  it("escape closes the modal; reject optional hides banner", async () => {
    const c = await renderConsent();
    await click(screen.getByText("Customise"));
    expect(c.textContent).toContain("Cookie Preferences");
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(c.textContent).not.toContain("Cookie Preferences");
    // banner returns
    expect(c.textContent).toContain("Your cookies, your choice");
    await click(screen.getByText("Reject optional"));
    expect(c.textContent).not.toContain("Your cookies, your choice");
  });
});

/* ── WaitingRoomClient ───────────────────────────────────── */

describe("WaitingRoomClient", () => {
  beforeEach(() => {
    pushMock.mockReset();
    fetchWithAuthMock.mockReset();
    authUser = { name: "Themis", email: "t@x.gr" };
    authLoading = false;
    searchParamsMap = new URLSearchParams();
    document.cookie = "NEXT_LOCALE=; max-age=0; path=/";
  });
  afterEach(cleanup);

  it("logged out → locale-aware login redirect", async () => {
    authUser = null;
    document.cookie = "NEXT_LOCALE=el";
    searchParamsMap = new URLSearchParams("plan=cloud");
    await act(async () => {
      render(<WaitingRoomClient />);
    });
    expect(pushMock).toHaveBeenCalledWith(
      `/el/auth/login?next=${encodeURIComponent("/portal/waiting?plan=cloud")}`
    );
  });

  it("waiting status — indicator, order block, auto-refresh note", async () => {
    fetchWithAuthMock.mockResolvedValue(
      okJson({
        status: "waiting",
        plan: "cloud",
        planLabel: "Cloud Architecture & Migration",
        email: "t@x.gr",
        name: "Themis",
        submittedAt: "2026-01-05T10:00:00Z",
      })
    );
    let c: HTMLElement | undefined;
    await act(async () => {
      c = render(<WaitingRoomClient />).container;
    });
    expect(c!.textContent).toContain("ORDER RECEIVED");
    expect(c!.textContent).toContain("Welcome, Themis");
    expect(c!.textContent).toContain("Portal setup");
    expect(c!.textContent).toContain("pending review");
    expect(c!.textContent).toContain("refreshes automatically");
    expect(c!.textContent).toContain("Email confirmation");
  });

  it("plan param → enroll POST then refreshed status; none → browse services", async () => {
    searchParamsMap = new URLSearchParams("plan=analytics");
    const calls: string[] = [];
    fetchWithAuthMock.mockImplementation(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (String(url).includes("enroll")) return okJson({ ok: true });
      if (calls.filter((x) => x.includes("/api/portal/me")).length === 1)
        return okJson({ status: "none" });
      return okJson({ status: "waiting", plan: "analytics", email: "t@x.gr" });
    });
    let c: HTMLElement | undefined;
    await act(async () => {
      c = render(<WaitingRoomClient />).container;
    });
    const enroll = calls.find((x) => x.includes("enroll"));
    expect(enroll).toBe("POST /api/portal/enroll");
    expect(c!.textContent).toContain("ORDER RECEIVED");
  });

  it("approved → router.push to portal token; error path shows", async () => {
    fetchWithAuthMock.mockResolvedValue(
      okJson({ status: "approved", portalToken: "tok123" })
    );
    await act(async () => {
      render(<WaitingRoomClient />);
    });
    expect(pushMock).toHaveBeenCalledWith("/portal/tok123");

    cleanup();
    pushMock.mockReset();
    fetchWithAuthMock.mockResolvedValue(okJson({ status: "none" }));
    let c: HTMLElement | undefined;
    await act(async () => {
      c = render(<WaitingRoomClient />).container;
    });
    expect(c!.textContent).toContain("signed in");
    expect(c!.textContent).toContain("Browse services");

    cleanup();
    fetchWithAuthMock.mockResolvedValue(okJson({}, 503));
    await act(async () => {
      c = render(<WaitingRoomClient />).container;
    });
    expect(c!.textContent).toContain("Portal status check failed (HTTP 503)");
  });
});
