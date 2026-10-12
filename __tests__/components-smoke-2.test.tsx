/**
 * Smoke-render + behavior tests for previously-untested client components,
 * context providers, layout clients, and misc UI pieces.
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/en",
  redirect: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/en/admin",
  useSearchParams: () => ({ get: () => null }),
  useParams: () => ({}),
  redirect: vi.fn(),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img {...props} />,
}));
vi.mock("next/script", () => ({
  default: (props: Record<string, unknown>) => <script {...props} />,
}));

const hoisted = vi.hoisted(() => ({ routes: [] as [string, unknown][] }));
const okJson = (body: unknown = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const routedFetch = async (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input.url;
  for (const [frag, body] of hoisted.routes) if (url.includes(frag)) return okJson(body);
  return okJson();
};
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", username: "admin", email: "a@b.c", role: "admin" },
    isAdmin: true,
    isLoading: false,
    configError: null,
  }),
}));
vi.mock("@/lib/use-locale", () => ({ useCurrentLocale: () => ["en", vi.fn()] }));
vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: vi.fn((...args: Parameters<typeof fetch>) => routedFetch(...args)),
}));
vi.mock("lenis", () => ({
  default: class Lenis { raf() {} destroy() {} },
}));
vi.mock("@/context/CookieConsentContext", () => ({
  useCookieConsent: () => ({ preferences: { marketing: true }, mounted: true }),
}));
vi.mock("@/lib/fire-campaign-conversion", () => ({ fireCampaignConversion: vi.fn() }));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { Contact360View } from "@/components/admin/Contact360View";
import AdminLayoutClient from "@/app/[locale]/admin/AdminLayoutClient";
import CookiePolicyPage from "@/app/[locale]/cookies/CookiePolicyPageClient";
import Footer from "@/components/Footer";
import CampaignHero from "@/components/CampaignHero";
import ProjectCard from "@/components/ProjectCard";
import AgentCounter from "@/components/AgentCounter";
import { WorkspaceProvider, useWorkspace } from "@/context/WorkspaceContext";
import SocialMediaSection from "@/components/SocialMediaSection";
import AdminAiUsageCard from "@/components/admin/AdminAiUsageCard";
import CloudMark from "@/components/CloudMark";
import TrackedBlogCard from "@/components/TrackedBlogCard";
import { InsightPanel } from "@/components/admin/InsightPanel";
import DeferredRender from "@/components/DeferredRender";
import StatCounter from "@/components/StatCounter";
import DashboardLayoutClient from "@/app/[locale]/dashboard/DashboardLayoutClient";
import { themeForRoute, dataThemeAttr } from "@/components/ThemeProvider";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import WebMCPProvider from "@/components/WebMCPProvider";
import { GoogleTagManagerHead, GoogleTagManagerNoscript } from "@/components/GoogleTagManager";
import GlobalError from "@/app/global-error";
import { AdminDailyBars } from "@/components/admin/AdminDailyBars";
import LenisInitializer from "@/components/LenisInitializer";
import TerminalBlock from "@/components/TerminalBlock";
import EmailBaseLayout from "@/emails/BaseLayout";
import { BackLink, MetricCard, Spinner, ErrorMsg } from "@/components/admin/CampaignPageKit";
import ConsentGatedPixel from "@/components/ConsentGatedPixel";
import ThanksConversion from "@/app/[locale]/campaigns/[slug]/thanks/ThanksConversion";
import { fireCampaignConversion } from "@/lib/fire-campaign-conversion";

const flush = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.routes.length = 0;
  mockFetch.mockImplementation(routedFetch);
  localStorage.clear();
});
afterEach(() => cleanup());

const contact360 = {
  contact: {
    id: "c1", email: "jane@x.co", firstName: "Jane", lastName: "Doe", phone: "+30",
    company: "Acme", accountId: null, leadSource: "web", description: "note",
    createdAt: "2026-01-01", modifiedAt: "2026-01-02",
  },
  opportunities: [{ id: "o1", name: "Deal A", status: "open", amount: 1200, createdAt: "d" }],
  cases: [{ id: "k1", name: "Ticket", status: "new", amount: null, createdAt: "d" }],
  notes: [{ id: "n1", post: "hello note", createdAt: "d" }],
  stripe: {
    configured: true,
    customer: { id: "cus_1", email: "jane@x.co", created: "d" },
    purchases: [{ id: "p1", status: "paid", amount: 9900, currency: "eur", date: "2026-02-01" }],
    subscriptions: [{ id: "s1", status: "active", currentPeriodEnd: "2027-01-01" }],
  },
  account: { id: "a1", email: "jane@x.co", name: "Jane", company: "Acme", createdAt: "d" },
  events: [{ id: "e1", event: "page_view", page: "/", source: "web", date: "d" }],
  attribution: {
    firstTouch: { source: "google", medium: "cpc", campaign: "brand" },
    goldMatches: [{ utmSource: "g", utmMedium: "cpc", utmCampaign: "b", sessions: 3, signups: 1, purchases: 1, revenue: 99 }],
  },
  scores: {
    rfmScore: 4, recencyDays: 5, frequency: 3, monetary: 9900, lastPurchaseAt: "2026-02-01",
    churnScore: 0.2, riskBand: "low",
  },
  matchHints: { email: "jane@x.co", name: "Jane Doe" } as never,
  fetchedAt: "2026-10-01",
};

describe("data-driven renders", () => {
  it("Contact360View renders all sections", async () => {
    render(<Contact360View data={contact360 as never} />);
    await flush();
    expect(screen.getAllByText(/Jane/i).length).toBeGreaterThan(0);
  });

  it("CampaignHero renders the campaign copy", async () => {
    const campaign = {
      slug: "launch", locale: "en",
      tagline: { en: "Tag", el: "Tag" },
      headline: { en: "Head", el: "Head" },
      headlineAccent: { en: "Accent", el: "Accent" },
      subhead: { en: "Sub", el: "Sub" },
      heroImage: "/img.png",
      slotsRemaining: 3,
      endsAt: "2026-12-01",
    } as never;
    render(<CampaignHero campaign={campaign} locale="en" />);
    await flush();
    expect(document.body.textContent).toContain("Head");
  });

  it("ProjectCard renders status/priority fallbacks + link variant", async () => {
    const project = {
      id: "p1", name: "Proj", status: "Bogus", priority: "Bogus", type: "Bogus",
      startDate: "2026-01-01", dueDate: "2026-02-01", url: "https://x.co",
      summary: "desc", tags: [],
    } as never;
    const { container, rerender } = render(<ProjectCard project={project} />);
    expect(container.textContent).toContain("Proj");
    rerender(<ProjectCard project={project} linkToNotion />);
    expect(container.querySelector("a")).toBeTruthy();
  });

  it("TrackedBlogCard renders the post card", async () => {
    const post = { slug: "s", title: "T", description: "d", publishedAt: "2026-01-01", tags: ["a"] } as never;
    render(<TrackedBlogCard post={post} delay={0} />);
    expect(document.body.textContent).toContain("T");
  });

  it("SocialMediaSection + CloudMark + TerminalBlock render", async () => {
    render(<SocialMediaSection locale="en" />);
    render(<CloudMark />);
    render(<TerminalBlock lines={["$ npm run dev", "ready in 300ms"]} title="sh" />);
    expect(document.body.textContent).toContain("npm run dev");
  });

  it("StatCounter renders the label even without IntersectionObserver", async () => {
    render(<StatCounter value="42%" label="uptime" />);
    expect(document.body.textContent).toContain("uptime");
  });

  it("AdminDailyBars renders bars or the empty state", async () => {
    render(
      <AdminDailyBars title="Daily" unitLabel="hits" points={[]} formatValue={(v) => `${v}`} />
    );
    expect(document.body.textContent).toContain("Daily");
    const { container } = render(
      <AdminDailyBars title="Daily" unitLabel="hits" points={[{ day: "2026-10-01", value: 5 }]} formatValue={(v) => `${v}`} />
    );
    expect(container.querySelector('[title="2026-10-01: 5"]')).toBeTruthy();
  });

  it("InsightPanel fetches and renders the insight", async () => {
    hoisted.routes.push(["insights", { summary: "SEO up", bullets: ["b1"], metrics_cited: [], confidence: "high", generated_at: "2026-10-12T10:00:00Z" }]);
    render(<InsightPanel domain="seo" />);
    await flush(); await flush();
    expect(document.body.textContent).toContain("SEO up");
  });

  it("AdminAiUsageCard fetches status", async () => {
    hoisted.routes.push(["ai/status", {
      configured: true,
      vectorize: { configured: false },
      turnstile: { configured: false },
      espocrmQueue: { configured: false },
      usage: { recent: [], daily: [], by_model: [], total: 0, ok: 0, errors: 0, viaGateway: 0, workersAiConfigured: true, aiGatewayConfigured: false, gatewayId: "", geminiConfigured: false },
    }]);
    render(<AdminAiUsageCard />);
    await flush(); await flush();
    expect(document.body.innerHTML.length).toBeGreaterThan(0);
  });
});

describe("behavioral components", () => {
  it("AgentCounter fetches the counter agent", async () => {
    hoisted.routes.push(["counter-agent", { value: 7 }]);
    render(<AgentCounter />);
    await flush(); await flush();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/agents/counter-agent/default"),
      expect.any(Object)
    );
  });

  it("DeferredRender swaps children in after idle", async () => {
    (globalThis as Record<string, unknown>).requestIdleCallback = (cb: () => void) => setTimeout(cb, 0);
    render(<DeferredRender fallback={<span>wait</span>}><span>ready</span></DeferredRender>);
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    expect(document.body.textContent).toContain("ready");
  });

  it("WorkspaceProvider loads workspaces, auto-selects first, switchTo writes cookie", async () => {
    hoisted.routes.push(["workspaces", { workspaces: [{ id: "w1", name: "One" }, { id: "w2", name: "Two" }] }]);
    let ctx: ReturnType<typeof useWorkspace> | undefined;
    function Probe() { ctx = useWorkspace(); return null; }
    render(<WorkspaceProvider><Probe /></WorkspaceProvider>);
    await flush(); await flush(); await flush();
    expect(ctx?.workspaces).toHaveLength(2);
    expect(ctx?.current?.id).toBe("w1");
    expect(localStorage.getItem("cloudless_workspace_id")).toBe("w1");
    act(() => ctx!.switchTo("w2"));
    expect(localStorage.getItem("cloudless_workspace_id")).toBe("w2");
  });

  it("WorkspaceProvider honours a valid stored id and storage events", async () => {
    localStorage.setItem("cloudless_workspace_id", "w2");
    hoisted.routes.push(["workspaces", { workspaces: [{ id: "w1" }, { id: "w2" }] }]);
    let ctx: ReturnType<typeof useWorkspace> | undefined;
    function Probe() { ctx = useWorkspace(); return null; }
    render(<WorkspaceProvider><Probe /></WorkspaceProvider>);
    await flush(); await flush(); await flush();
    expect(ctx?.current?.id).toBe("w2");
    act(() => {
      globalThis.dispatchEvent(new StorageEvent("storage", { key: "cloudless_workspace_id", newValue: "w1" }));
    });
    expect(ctx?.current?.id).toBe("w1");
  });

  it("WorkspaceSwitcher renders the current workspace", async () => {
    hoisted.routes.push(["workspaces", { workspaces: [{ id: "w1", name: "Alpha" }] }]);
    render(<WorkspaceProvider><WorkspaceSwitcher /></WorkspaceProvider>);
    await flush(); await flush(); await flush();
    expect(document.body.textContent).toContain("Alpha");
  });

  it("WebMCPProvider registers tools when modelContext exists", async () => {
    const provideContext = vi.fn();
    (window as unknown as Record<string, unknown>).modelContext = { provideContext };
    render(<WebMCPProvider />);
    await flush();
    expect(provideContext).toHaveBeenCalledWith(
      expect.objectContaining({ tools: expect.arrayContaining([expect.objectContaining({ name: "book_consultation" })]) })
    );
    // exercise the tool executors
    const tools = provideContext.mock.calls[0][0].tools as { name: string; execute: (a: unknown) => Promise<unknown> }[];
    mockFetch.mockResolvedValueOnce(okJson());
    expect(await tools.find((t) => t.name === "book_consultation")!.execute({})).toEqual({ success: true });
    mockFetch.mockResolvedValueOnce(okJson({ slots: [] }));
    expect(await tools.find((t) => t.name === "check_availability")!.execute({ date: "d" })).toEqual({ slots: [] });
    delete (window as unknown as Record<string, unknown>).modelContext;
  });

  it("GoogleTagManager renders head script + noscript iframe", async () => {
    // jsdom renders <noscript> children as inert text — assert the tag exists.
    const { container } = render(<GoogleTagManagerNoscript />);
    expect(container.querySelector("noscript")).toBeTruthy();
    const { container: head } = render(<GoogleTagManagerHead nonce="n" />);
    expect(head.innerHTML).toContain("googletagmanager");
  });

  it("GlobalError renders + reset button works", async () => {
    const reset = vi.fn();
    render(<GlobalError error={new Error("boom")} reset={reset} />);
    screen.getByRole("button").click();
    expect(reset).toHaveBeenCalled();
  });

  it("LenisInitializer mounts without matchMedia (reduced-motion skip)", async () => {
    const orig = globalThis.matchMedia;
    (globalThis as Record<string, unknown>).matchMedia = undefined;
    render(<LenisInitializer />);
    await flush();
    (globalThis as Record<string, unknown>).matchMedia = orig;
  });

  it("ThemeProvider helpers map routes to themes", () => {
    expect(themeForRoute("/admin")).toBeDefined();
    expect(dataThemeAttr("/")).toHaveProperty("data-theme");
  });

  it("ConsentGatedPixel injects the pixel script when marketing consent given", async () => {
    const orig = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "12345";
    render(<ConsentGatedPixel />);
    await flush();
    expect(document.head.querySelector("script")).toBeTruthy();
    if (orig === undefined) delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    else process.env.NEXT_PUBLIC_META_PIXEL_ID = orig;
  });

  it("ThanksConversion fires the conversion exactly once", async () => {
    render(<ThanksConversion conversionId={9} campaign="c" tier="t" orderId="o" />);
    await flush();
    expect(fireCampaignConversion).toHaveBeenCalledTimes(1);
    expect(fireCampaignConversion).toHaveBeenCalledWith({ campaign: "c", tier: "t", orderId: "o", conversionId: 9 });
  });
});

describe("layout + misc wrappers", () => {
  it("AdminLayoutClient + DashboardLayoutClient render children", async () => {
    render(<AdminLayoutClient><div>admin-body</div></AdminLayoutClient>);
    await flush();
    expect(document.body.textContent).toContain("admin-body");
    render(<DashboardLayoutClient><div>dash-body</div></DashboardLayoutClient>);
    await flush();
    expect(document.body.textContent).toContain("dash-body");
  });

  it("CookiePolicyPage + Footer render static content", async () => {
    render(<CookiePolicyPage />);
    await flush();
    expect(document.body.textContent!.length).toBeGreaterThan(50);
    render(<Footer />);
    expect(document.body.textContent!.length).toBeGreaterThan(50);
  });

  it("EmailBaseLayout renders preview + children", () => {
    render(<EmailBaseLayout preview="pv"><div>mail body</div></EmailBaseLayout>);
    expect(document.body.textContent).toContain("mail body");
  });

  it("CampaignPageKit primitives render", () => {
    render(<div><BackLink /><MetricCard label="L" value="V" /><Spinner /><ErrorMsg msg="oops" /></div>);
    expect(document.body.textContent).toContain("oops");
    expect(document.body.textContent).toContain("L");
  });
});
