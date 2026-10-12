/**
 * Smoke-render tests for non-admin client components/pages.
 *
 * Same harness as admin-pages-smoke: stub the fetch layer + browser APIs
 * jsdom lacks (matchMedia, scrollIntoView, canvas) and render each
 * component's real JSX tree against benign empty responses.
 *
 * @vitest-environment jsdom
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// ── shared mocks ─────────────────────────────────────────────────────────────

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => ({ get: () => null }),
  useParams: () => ({ token: "test-token" }),
  redirect: vi.fn(),
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ dateTime: (d: unknown) => String(d), number: (n: unknown) => String(n) }),
  useMessages: () => ({}),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: hoisted.authUser,
    isAdmin: false,
    isLoading: false,
    configError: null,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const GENERIC_BODY = {
  items: [],
  data: [],
  results: [],
  messages: [],
  steps: [],
  comments: [],
  deliverables: [],
  events: [],
  products: [],
  notifications: [],
  subscription: null,
  enrolled: false,
};

const okJson = (body: unknown = GENERIC_BODY) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const hoisted = vi.hoisted(() => ({
  routes: [] as [string, unknown][],
  authUser: null as null | { email: string; name?: string },
}));

const routedFetch = async (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input.url;
  for (const [frag, body] of hoisted.routes) {
    if (!url.includes(frag)) continue;
    const status = (body as { __status?: number }).__status;
    if (status) return new Response("{}", { status });
    return okJson(body);
  }
  return okJson();
};

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: vi.fn((...args: Parameters<typeof fetch>) => routedFetch(...args)),
}));

// ── imports (after mocks) ────────────────────────────────────────────────────

import PortalPage from "@/app/portal/[token]/page";
import WaitingRoomClient from "@/app/portal/waiting/WaitingRoomClient";
import ChatWidget from "@/components/ChatWidget";
import CookieConsent from "@/components/CookieConsent";
import TypingText from "@/components/TypingText";
import CloudCockpit from "@/components/CloudCockpit";
import ParticleField from "@/components/ParticleField";
import RecommendationGrid from "@/components/store/RecommendationGrid";
import PlaybookLeadForm from "@/components/PlaybookLeadForm";
import { CookieConsentProvider } from "@/context/CookieConsentContext";

// ── harness ───────────────────────────────────────────────────────────────────

async function renderPage(el: React.ReactElement): Promise<void> {
  let container: HTMLElement | undefined;
  await React.act(async () => {
    ({ container } = render(el));
  });
  expect(container!.innerHTML.length).toBeGreaterThan(0);
}


describe("client components — smoke render", () => {
  beforeEach(() => {
    hoisted.routes = [];
    hoisted.authUser = null;
    vi.stubGlobal("fetch", vi.fn(routedFetch));
    Element.prototype.scrollIntoView = vi.fn();
    // jsdom lacks matchMedia — reduced-motion hooks subscribe to it.
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }));
    // jsdom canvas has no 2d context — return a minimal stub.
    HTMLCanvasElement.prototype.getContext = vi
      .fn()
      .mockReturnValue({ clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() }) as never;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("portal [token]", async () => {
    hoisted.routes = [
      [
        "/api/portal/",
        {
          client: { name: "Ada", label: "Ada Lovelace" },
          projects: [],
          steps: [],
          comments: [],
          deliverables: [],
          invoices: [],
          paymentLinks: [],
          subscriptions: [],
        },
      ],
    ];
    await renderPage(
      <PortalPage params={Promise.resolve({ token: "test-token" })} />
    );
  });

  it("portal waiting room", async () => {
    await renderPage(<WaitingRoomClient />);
  });

  it("portal waiting room — authenticated user sees the all-set panel", async () => {
    hoisted.authUser = { email: "ada@b.co", name: "Ada" };
    hoisted.routes = [
      ["/api/portal/me", { status: "none", email: "ada@b.co", name: "Ada" }],
    ];
    let container: HTMLElement | undefined;
    await React.act(async () => {
      ({ container } = render(<WaitingRoomClient />));
    });
    // The useEffect fires /api/portal/me → status "none" → signed-in panel.
    expect(container!.textContent).toContain("signed in");
  });

  it("ChatWidget", async () => {
    await renderPage(<ChatWidget />);
  });

  it("CookieConsent", async () => {
    let container: HTMLElement | undefined;
    await React.act(async () => {
      ({ container } = render(
        <CookieConsentProvider>
          <CookieConsent />
        </CookieConsentProvider>
      ));
    });
    // The banner defers mount ~1s past first paint (LCP guard) — real wait
    // outside act so the component's mount timer can commit freely.
    await new Promise((r) => setTimeout(r, 1300));
    expect(container!.innerHTML.length).toBeGreaterThan(0);
  });

  it("TypingText", async () => {
    await renderPage(<TypingText texts={["hello", "world"]} />);
  });

  it("CloudCockpit", async () => {
    await renderPage(<CloudCockpit />);
  });

  it("ParticleField", async () => {
    await renderPage(<ParticleField />);
  });

  it("RecommendationGrid similar", async () => {
    hoisted.routes = [["/api/recommendations", { __status: 500 }]];
    await renderPage(<RecommendationGrid type="similar" productIds={["p1"]} />);
  });

  it("RecommendationGrid trending", async () => {
    hoisted.routes = [["/api/recommendations", { __status: 500 }]];
    await renderPage(<RecommendationGrid type="trending" />);
  });

  it("PlaybookLeadForm", async () => {
    await renderPage(<PlaybookLeadForm />);
  });
});
