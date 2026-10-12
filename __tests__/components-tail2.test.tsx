/**
 * Tail coverage: CommandPalette (open/navigate), AgentCounter (agent RPC),
 * ChunkReloadGuard (error recovery), ContactFormSection (campaign flow),
 * StoreGrid (semantic search), Navbar (user menu/sign-out).
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as Record<string, unknown>).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = function () {};

// ── shared mocks ────────────────────────────────────────────────────────────

const routerPush = vi.hoisted(() => vi.fn());
const searchParamsRef = vi.hoisted(() => ({ current: new URLSearchParams("") }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
  useRouter: () => ({ push: routerPush, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/en",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
  usePathname: () => "/en/contact",
  useSearchParams: () => searchParamsRef.current,
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img {...props} />,
}));
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en", vi.fn()] }));
vi.mock("@/components/ScrollReveal", () => ({
  default: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/SocialLinks", () => ({ default: () => <div /> }));
vi.mock("@/components/TurnstileWidget", () => ({
  default: ({ onToken }: { onToken?: (t: string) => void }) => (
    <button type="button" data-testid="turnstile" onClick={() => onToken?.("tok-1")} />
  ),
}));
const trackPixelEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/meta-pixel", () => ({ trackPixelEvent }));
const fireCampaignConversion = vi.hoisted(() => vi.fn());
vi.mock("@/lib/fire-campaign-conversion", () => ({ fireCampaignConversion }));
const trackFunnelEvent = vi.hoisted(() => vi.fn());
vi.mock("@/lib/funnel-client", () => ({ trackFunnelEvent }));

const signOutMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  current: {
    user: { name: "Pat", email: "p@x.dev" } as { name: string; email: string } | null,
    isAdmin: true,
    isLoading: false,
    signOut: signOutMock,
  },
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => authState.current }));
vi.mock("@/context/CartContext", () => ({
  useCart: () => ({ addItem: vi.fn(), toggleCart: vi.fn(), items: [] }),
}));
vi.mock("@/components/store/CartButton", () => ({ default: () => <div /> }));
vi.mock("@/components/LocaleSwitcher", () => ({ default: () => <div /> }));
vi.mock("@/components/ThemeSwitcher", () => ({
  default: () => <div />,
  ThemeSwitcherInline: () => <div />,
}));
vi.mock("@/components/Logo", () => ({ default: () => <div /> }));

import CommandPalette from "@/components/CommandPalette";
import AgentCounter from "@/components/AgentCounter";
import ChunkReloadGuard from "@/components/ChunkReloadGuard";
import ContactFormSection from "@/components/ContactFormSection";
import StoreGrid from "@/components/store/StoreGrid";
import Navbar from "@/components/Navbar";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
  sessionStorage.clear();
});
afterEach(() => cleanup());

// ── CommandPalette ──────────────────────────────────────────────────────────

describe("CommandPalette", () => {
  it("opens on ctrl+k, navigates on item click, closes on backdrop", async () => {
    const { container } = render(<CommandPalette />);
    expect(container.innerHTML).toBe("");

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
      );
    });
    expect(container.textContent).toContain("Services");

    const item = [...container.querySelectorAll("[cmdk-item]")].find((el) =>
      el.textContent?.includes("Blog")
    )!;
    await act(async () => fireEvent.click(item));
    expect(routerPush).toHaveBeenCalledWith("/blog");
    expect(container.innerHTML).toBe("");

    // reopen then close via backdrop
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
      );
    });
    expect(container.textContent).toContain("Store");
    await act(async () =>
      fireEvent.click(container.querySelector(".backdrop-blur-sm")!)
    );
    expect(container.innerHTML).toBe("");
  });
});

// ── AgentCounter ────────────────────────────────────────────────────────────

describe("AgentCounter", () => {
  it("loads count and runs increment/decrement/reset RPCs", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ count: 7 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ count: 8 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ count: 7 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ count: 0 }), { status: 200 }));

    const { container, getByText } = render(<AgentCounter />);
    await waitFor(() => expect(container.textContent).toContain("7"));
    expect(mockFetch.mock.calls[0][0]).toContain("/api/agents/counter-agent/default?method=getCount");

    for (const label of [/^\+|increment/i, /decrement|^-$/i, /reset/i]) {
      const btn = [...container.querySelectorAll("button")].find((b) =>
        label.test(b.textContent ?? "")
      );
      if (btn) await act(async () => fireEvent.click(btn));
    }
    await waitFor(() =>
      expect(mockFetch.mock.calls.some((c) => String(c[0]).includes("method=reset"))).toBe(true)
    );
    expect(getByText("0")).toBeTruthy();
  });

  it("shows error state when the agent call fails", async () => {
    mockFetch.mockResolvedValue(new Response("x", { status: 500 }));
    const { container } = render(<AgentCounter />);
    await waitFor(() => expect(container.textContent).toMatch(/failed|error|500/i));
  });
});

// ── ChunkReloadGuard ────────────────────────────────────────────────────────

describe("ChunkReloadGuard", () => {
  it("reloads once on a chunk error, ignores repeats and non-chunk errors", async () => {
    render(<ChunkReloadGuard />);
    const recover = () =>
      sessionStorage.getItem("cl-chunk-reload");

    fireEvent(window, new ErrorEvent("error", { message: "boom" }));
    expect(recover()).toBeNull();

    fireEvent(
      window,
      new ErrorEvent("error", { message: "Loading chunk abc-123 failed" })
    );
    expect(recover()).toBe("1"); // flag set → reload attempted once

    fireEvent(
      window,
      new ErrorEvent("error", { message: "Loading chunk abc-123 failed" })
    );
    expect(recover()).toBe("1"); // still deduped

    sessionStorage.clear();
    fireEvent(
      window,
      new Event("unhandledrejection") as unknown as PromiseRejectionEvent
    );
    fireEvent(
      window,
      Object.assign(new Event("unhandledrejection"), {
        reason: new Error("ChunkLoadError: fail"),
      }) as unknown as PromiseRejectionEvent
    );
    expect(recover()).toBe("1");
  });
});

// ── ContactFormSection campaign flow ────────────────────────────────────────

describe("ContactFormSection campaign flow", () => {
  it("prefills the fit-call message and fires campaign conversion on submit", async () => {
    searchParamsRef.current = new URLSearchParams(
      "topic=fit-call&campaign=shop-online&products=p1,p2&tier=growth&price=%E2%82%AC499"
    );
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ eventId: "evt-9" }), { status: 200 })
    );

    const { container } = render(<ContactFormSection source="test-src" />);
    const msg = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(msg.value).toContain("fit call");
    expect(msg.value).toContain("shop-online");
    expect(msg.value).toContain("growth");

    fireEvent.change(container.querySelector('input[name="name"]')!, {
      target: { value: "Pat" },
    });
    fireEvent.change(container.querySelector('input[name="email"]')!, {
      target: { value: "p@x.dev" },
    });
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });

    expect(trackPixelEvent).toHaveBeenCalledWith(
      "Lead",
      expect.objectContaining({ source: "test-src" }),
      "evt-9"
    );
    expect(fireCampaignConversion).toHaveBeenCalledWith(
      expect.objectContaining({ campaign: "shop-online", tier: "growth" })
    );
    searchParamsRef.current = new URLSearchParams("");
  });
});

// ── StoreGrid semantic search ───────────────────────────────────────────────

describe("StoreGrid semantic search", () => {
  it("orders results by /api/search hit ids and tracks the funnel", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ source: "r2", hits: [{ id: "phy-tshirt" }] }),
        { status: 200 }
      )
    );
    const { container } = render(<StoreGrid />);
    fireEvent.change(container.querySelector('input[type="search"], input[type="text"], input')!, {
      target: { value: "shirt" },
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/search?q=shirt"),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(trackFunnelEvent).toHaveBeenCalledWith(
      "search_result",
      expect.objectContaining({ query: "shirt", source: "r2", result_count: 1 })
    );
    const cards = container.querySelectorAll('a[href^="/store/"]');
    expect(cards[0]?.getAttribute("href")).toBe("/store/phy-tshirt");

    // click-through tracking
    await act(async () => fireEvent.click(cards[0]));
    expect(trackFunnelEvent).toHaveBeenCalledWith(
      "search_click",
      expect.objectContaining({ query: "shirt", product_id: "phy-tshirt" })
    );
  });

  it("falls back to local keyword filter when /api/search fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("search down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<StoreGrid />);
    fireEvent.change(container.querySelector("input")!, { target: { value: "shirt" } });
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(trackFunnelEvent).toHaveBeenCalledWith(
      "search_query",
      expect.objectContaining({ source: "local-fallback" })
    );
    expect(container.textContent).toContain("Cloudless T-Shirt");
    warn.mockRestore();
  });
});

// ── Navbar user menu ────────────────────────────────────────────────────────

describe("Navbar user menu", () => {
  it("opens the account menu, shows the admin link, and signs out", async () => {
    const { container } = render(<Navbar />);
    const avatar = container.querySelector('button[aria-haspopup="true"]')!;
    await act(async () => fireEvent.click(avatar));
    expect(container.textContent).toContain("Admin Panel");

    const signOutBtn = [...container.querySelectorAll("button")].find((b) =>
      /sign out/i.test(b.textContent ?? "")
    )!;
    await act(async () => fireEvent.click(signOutBtn));
    expect(signOutMock).toHaveBeenCalled();
    expect(container.querySelector('button[aria-expanded="true"]')).toBeNull();
  });

  it("closes the menu on outside click", async () => {
    const { container } = render(<Navbar />);
    await act(async () =>
      fireEvent.click(container.querySelector('button[aria-haspopup="true"]')!)
    );
    expect(container.querySelector('button[aria-expanded="true"]')).toBeTruthy();
    await act(async () => fireEvent.mouseDown(document.body));
    expect(container.querySelector('button[aria-expanded="true"]')).toBeNull();
  });
});

describe("Navbar tails", () => {
  const openMobile = (container: HTMLElement) =>
    fireEvent.click(container.querySelector('[data-testid="mobile-menu-button"]')!);
  const menuHidden = (container: HTMLElement) =>
    container.querySelector('[data-testid="mobile-menu"]')!.hasAttribute("hidden");

  it("mobile menu: account links, locale switch, and sign-out close the drawer", async () => {
    const { container } = render(<Navbar />);
    await act(async () => openMobile(container));
    expect(menuHidden(container)).toBe(false);

    const menu = container.querySelector('[data-testid="mobile-menu"]')!;
    expect(menu.textContent).toContain("Dashboard");
    expect(menu.textContent).toContain("Admin Panel");
    expect(menu.textContent).toContain("Sign Out");

    // Locale buttons call the setter and close the menu.
    const el = [...menu.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === "Set language to Greek"
    ) ?? [...menu.querySelectorAll("button")].find((b) => b.textContent?.trim() === "EL");
    await act(async () => fireEvent.click(el!));
    expect(menuHidden(container)).toBe(true);
  });

  it("mobile dashboard/admin/sign-out buttons close the drawer and sign out", async () => {
    const { container } = render(<Navbar />);
    await act(async () => openMobile(container));
    const menu = container.querySelector('[data-testid="mobile-menu"]')!;

    const signOutBtn = [...menu.querySelectorAll("button")].find((b) =>
      /sign out/i.test(b.textContent ?? "")
    )!;
    await act(async () => fireEvent.click(signOutBtn));
    expect(signOutMock).toHaveBeenCalled();
    expect(menuHidden(container)).toBe(true);

    await act(async () => openMobile(container));
    const dashLink = [...menu.querySelectorAll("a")].find((a) =>
      /dashboard/i.test(a.textContent ?? "")
    )!;
    await act(async () => fireEvent.click(dashLink));
    expect(menuHidden(container)).toBe(true);

    await act(async () => openMobile(container));
    const adminLink = [...menu.querySelectorAll("a")].find((a) =>
      /admin panel/i.test(a.textContent ?? "")
    )!;
    await act(async () => fireEvent.click(adminLink));
    expect(menuHidden(container)).toBe(true);
  });

  it("closes the mobile menu when the window resizes to desktop width", async () => {
    const { container } = render(<Navbar />);
    await act(async () => openMobile(container));
    expect(menuHidden(container)).toBe(false);
    const innerWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");
    Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
    await act(async () => fireEvent(window, new Event("resize")));
    expect(menuHidden(container)).toBe(true);
    if (innerWidth) Object.defineProperty(window, "innerWidth", innerWidth);
  });

  it("desktop user menu links close the dropdown", async () => {
    const { container } = render(<Navbar />);
    await act(async () =>
      fireEvent.click(container.querySelector('button[aria-haspopup="true"]')!)
    );
    const dropdown = container.querySelector(".absolute.top-full")!;
    const dash = [...dropdown.querySelectorAll("a")].find((a) =>
      /dashboard/i.test(a.textContent ?? "")
    )!;
    await act(async () => fireEvent.click(dash));
    expect(container.querySelector('button[aria-expanded="true"]')).toBeNull();

    await act(async () =>
      fireEvent.click(container.querySelector('button[aria-haspopup="true"]')!)
    );
    const admin = [...container.querySelectorAll(".absolute.top-full a")].find((a) =>
      /admin panel/i.test(a.textContent ?? "")
    )!;
    await act(async () => fireEvent.click(admin));
    expect(container.querySelector('button[aria-expanded="true"]')).toBeNull();
  });
});

describe("ContactFormSection — tails", () => {
  const fillAndSubmit = async (container: HTMLElement) => {
    fireEvent.change(container.querySelector('input[name="name"]')!, {
      target: { value: "Pat" },
    });
    fireEvent.change(container.querySelector('input[name="email"]')!, {
      target: { value: "p@x.dev" },
    });
    await act(async () => {
      fireEvent.submit(container.querySelector("form")!);
    });
  };

  it("shows the error state on a non-ok response and on a network throw", async () => {
    searchParamsRef.current = new URLSearchParams("");
    mockFetch.mockResolvedValueOnce(new Response("bad", { status: 500 }));
    const { container: c1, unmount } = render(<ContactFormSection source="t" />);
    await fillAndSubmit(c1);
    expect(c1.textContent).toContain("went wrong");
    unmount();

    mockFetch.mockRejectedValueOnce(new Error("offline"));
    const { container: c2 } = render(<ContactFormSection source="t" />);
    await fillAndSubmit(c2);
    expect(c2.textContent).toContain("went wrong");
  });

  it("success screen → 'Send another message' resets back to the form", async () => {
    searchParamsRef.current = new URLSearchParams("");
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const { container } = render(<ContactFormSection source="t" />);
    await fillAndSubmit(container);
    expect(container.textContent).toContain("Message sent successfully");
    await act(async () => {
      fireEvent.click([...container.querySelectorAll("button")].find(b => b.textContent?.includes("Send another message"))!);
    });
    expect(container.querySelector("form")).not.toBeNull();
  });

  it("banner falls back to campaign name, then products, when no tier/price", async () => {
    // campaign without tier/price → "Campaign: <slug>"
    searchParamsRef.current = new URLSearchParams("campaign=shop-online");
    const { container, unmount } = render(<ContactFormSection source="t" />);
    expect(container.textContent).toContain("Campaign: shop-online");
    unmount();

    // fit-call topic + products but no campaign → products text
    searchParamsRef.current = new URLSearchParams("topic=fit-call&products=srv-a,srv-b");
    const { container: c2 } = render(<ContactFormSection source="t" />);
    expect(c2.textContent).toContain("srv-a,srv-b");
    searchParamsRef.current = new URLSearchParams("");
  });
});
