/**
 * Components tail batch — HtmlLangSync, PushNotificationPrompt,
 * WorkspaceSwitcher, RecommendationGrid, partners generateMetadata.
 * Real component code; mocks only at navigation/context/fetch seams.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";

const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));
vi.mock("next-intl", () => ({
  useLocale: () => "el",
}));

const mockUseWorkspace = vi.fn();
vi.mock("@/context/WorkspaceContext", () => ({
  useWorkspace: () => mockUseWorkspace(),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...p }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...p}>{children}</a>
  ),
}));
vi.mock("@/components/store/ProductIcon", () => ({
  default: () => <span data-testid="icon" />,
}));
vi.mock("@/components/HolographicCard", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ScrollReveal", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
const mockTrack = vi.fn();
vi.mock("@/lib/funnel-client", () => ({
  trackFunnelEvent: (...a: unknown[]) => mockTrack(...a),
}));

import HtmlLangSync from "@/components/HtmlLangSync";
import PushNotificationPrompt from "@/components/PushNotificationPrompt";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import RecommendationGrid from "@/components/store/RecommendationGrid";

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  sessionStorage.clear();
  document.documentElement.lang = "";
});

// --- HtmlLangSync ----------------------------------------------------------

describe("HtmlLangSync", () => {
  it("syncs <html lang> from the pathname locale", () => {
    mockPathname.mockReturnValue("/fr/services");
    render(<HtmlLangSync />);
    expect(document.documentElement.lang).toBe("fr");
  });

  it("falls back to the intl locale, and no-ops when already correct", () => {
    mockPathname.mockReturnValue("/page-without-locale");
    document.documentElement.lang = "el";
    render(<HtmlLangSync />);
    expect(document.documentElement.lang).toBe("el");
  });
});

// --- PushNotificationPrompt ------------------------------------------------

describe("PushNotificationPrompt", () => {
  const win = window as unknown as { Notification?: unknown };

  afterEach(() => {
    delete win.Notification;
    vi.useRealTimers();
  });

  it("renders nothing when Notification is unsupported", () => {
    delete win.Notification;
    const { container } = render(<PushNotificationPrompt />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when permission was already decided", () => {
    win.Notification = { permission: "denied", requestPermission: vi.fn() };
    const { container } = render(<PushNotificationPrompt />);
    expect(container.innerHTML).toBe("");
  });

  it("stays hidden when dismissed this session", () => {
    win.Notification = { permission: "default", requestPermission: vi.fn() };
    sessionStorage.setItem("cloudless-push-dismissed", "1");
    const { container } = render(<PushNotificationPrompt />);
    expect(container.innerHTML).toBe("");
  });

  it("reveals on the 2nd visit and closes on enable", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    win.Notification = { permission: "default", requestPermission };
    sessionStorage.setItem("cloudless-visits", "3");
    vi.useFakeTimers();
    render(<PushNotificationPrompt />);
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    const btn = screen.getByRole("button", { name: "Enable" });
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(requestPermission).toHaveBeenCalled();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

// --- WorkspaceSwitcher -----------------------------------------------------

describe("WorkspaceSwitcher", () => {
  it("renders nothing while loading or with no workspaces", () => {
    mockUseWorkspace.mockReturnValue({ workspaces: [], current: null, loaded: false, switchTo: vi.fn() });
    const { container } = render(<WorkspaceSwitcher />);
    expect(container.innerHTML).toBe("");

    mockUseWorkspace.mockReturnValue({ workspaces: [], current: null, loaded: true, switchTo: vi.fn() });
    const { container: c2 } = render(<WorkspaceSwitcher />);
    expect(c2.innerHTML).toBe("");
  });

  it("opens the list, switches workspace, and closes on outside click", () => {
    const switchTo = vi.fn();
    mockUseWorkspace.mockReturnValue({
      workspaces: [
        { id: "w1", name: "Personal" },
        { id: "w2", name: "Client Acme" },
      ],
      current: { id: "w1", name: "Personal" },
      loaded: true,
      switchTo,
    });
    render(<WorkspaceSwitcher />);
    // closed list
    expect(screen.queryByText("Client Acme")).toBeNull();
    fireEvent.click(screen.getByText("Personal"));
    const item = screen.getByText("Client Acme");
    fireEvent.click(item);
    expect(switchTo).toHaveBeenCalledWith("w2");
    // reopen then outside-mousedown closes
    fireEvent.click(screen.getByText("Personal"));
    expect(screen.getByText("Client Acme")).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Client Acme")).toBeNull();
  });
});

// --- RecommendationGrid ----------------------------------------------------

const prod = (id: string, category = "service"): never =>
  ({ id, name: `P-${id}`, category, price: 1000, currency: "eur" } as never);

describe("RecommendationGrid", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hides the grid entirely on an enabled 'b' experiment variant", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ enabled: true, variant: "b" }), { status: 200 })
    ));
    const { container } = render(<RecommendationGrid type="similar" productIds={["x"]} />);
    await vi.waitFor(() =>
      expect(mockTrack).toHaveBeenCalledWith("rec_impression", expect.objectContaining({ shown: false }))
    );
    expect(container.querySelector("a")).toBeNull();
  });

  it("renders fetched products and tracks rec_click", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("experiments")) {
        return new Response(JSON.stringify({ enabled: false }), { status: 200 });
      }
      return new Response(JSON.stringify([prod("srv-a"), prod("srv-b")]), { status: 200 });
    }));
    render(<RecommendationGrid type="trending" limit={4} />);
    const link = await screen.findByText("P-srv-a");
    fireEvent.click(link);
    expect(mockTrack).toHaveBeenCalledWith(
      "rec_click",
      expect.objectContaining({ product_id: "srv-a", ab_variant: "a" })
    );
  });

  it("falls back to curated products when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("experiments")) {
        return new Response(JSON.stringify({ enabled: false }), { status: 200 });
      }
      return new Response("boom", { status: 500 });
    }));
    const { container } = render(
      <RecommendationGrid type="similar" productIds={["srv-cloud"]} limit={3} />
    );
    await vi.waitFor(() => expect(container.querySelectorAll("a").length).toBeGreaterThan(0));
  });
});

// --- partners generateMetadata ----------------------------------------------

describe("partners page metadata", () => {
  it("uses localized meta when present and defaults for unsupported locales", async () => {
    const { generateMetadata } = await import("@/app/[locale]/partners/page");
    const en = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(en.title).toBeTruthy();
    const el = await generateMetadata({ params: Promise.resolve({ locale: "el" }) });
    expect(el.title).toBeTruthy();
    const bad = await generateMetadata({ params: Promise.resolve({ locale: "xx" }) });
    expect(bad.title).toBeTruthy();
  });
});
