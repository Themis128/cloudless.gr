/**
 * Smoke-render tests for the admin `page.tsx` client components.
 *
 * Every admin page is a "use client" component that fetches on mount via
 * `fetch`/`fetchWithAuth` and renders a data-driven JSX tree. Stubbing the
 * fetch layer with a benign `{}` response exercises the whole render path
 * (the bulk of each file) plus the mount-time fetch effects.
 *
 * @vitest-environment jsdom
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

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
  usePathname: () => "/admin",
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/admin",
  useSearchParams: () => ({ get: () => null }),
  useParams: () => ({}),
  redirect: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", username: "admin", email: "a@b.c", role: "admin" },
    isAdmin: true,
    isLoading: false,
    configError: null,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const GENERIC_BODY = {
  // Kitchen-sink body: pages destructure list fields without fallbacks,
  // so every common collection key resolves to an empty array.
  sitemaps: [],
  items: [],
  data: [],
  results: [],
  list: [],
  integrations: [],
  posts: [],
  portals: [],
  devices: [],
  events: [],
  rows: [],
  issues: [],
  subscriptions: [],
  watchdogs: [],
  history: [],
  queries: [],
  pages: [],
  usage: { recent: [], daily: [], by_model: [], total: {} },
  alerts: { active_count: 0, resolved_count: 0, by_severity: {}, alerts: [] },
  stats: {},
  summary: {},
  snapshot: { history: [] },
  analytics: { series: [] },
};

const okJson = (body: unknown = GENERIC_BODY) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

// Per-test URL → body overrides, checked as URL substrings in order.
// vi.hoisted keeps the shared state above the hoisted vi.mock factories.
const hoisted = vi.hoisted(() => ({ routes: [] as [string, unknown][] }));

const routedFetch = async (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input.url;
  console.log("FETCH>", url, "routes:", hoisted.routes.length);
  for (const [frag, body] of hoisted.routes) {
    if (url.includes(frag)) return okJson(body);
  }
  return okJson();
};

vi.mock("@/lib/fetch-with-auth", () => ({
  // Deferred: page modules import fetch-with-auth before this file's consts init.
  fetchWithAuth: vi.fn((...args: Parameters<typeof fetch>) => {
    console.log("FWA>", String(args[0]));
    return routedFetch(...args);
  }),
}));

// ── page imports (after mocks) ────────────────────────────────────────────────

import AdminDashboardPage from "@/app/[locale]/admin/page";
import AdminPostizPage from "@/app/[locale]/admin/postiz/page";
import AdminLangGraphPage from "@/app/[locale]/admin/langgraph/page";
import AdminClientPortalsPage from "@/app/[locale]/admin/client-portals/page";
import AdminAnalyticsPage from "@/app/[locale]/admin/analytics/page";
import AdminGscPage from "@/app/[locale]/admin/gsc/page";
import AdminCampaignsPage from "@/app/[locale]/admin/campaigns/page";
import AdminEsp32ManagerPage from "@/app/[locale]/admin/esp32-manager/page";
import AdminDeliveryPage from "@/app/[locale]/admin/delivery/page";
import AdminEsp32Page from "@/app/[locale]/admin/esp32/page";
import AdminMonitorPage from "@/app/[locale]/admin/monitor/page";
import AIAssistantPage from "@/app/[locale]/admin/ai-assistant/page";
import ConsultationsPage from "@/app/[locale]/admin/consultations/page";
import CalendarPage from "@/app/[locale]/admin/calendar/page";
import WorkspacesPage from "@/app/[locale]/admin/workspaces/page";
import AdminProjectsPage from "@/app/[locale]/admin/projects/page";
import AdminSettingsPage from "@/app/[locale]/admin/settings/page";
import ClusterStatusPage from "@/app/[locale]/admin/cluster/page";
import AdminErrorsPage from "@/app/[locale]/admin/errors/page";
import TasksKanbanPage from "@/app/[locale]/admin/appflowy/tasks/page";
import AppFlowyProjectsPage from "@/app/[locale]/admin/appflowy/projects/page";
import AdminCaseStudiesPage from "@/app/[locale]/admin/cms/case-studies/page";
import AdminServicesPage from "@/app/[locale]/admin/cms/services/page";
import AdminFaqsPage from "@/app/[locale]/admin/cms/faqs/page";
import AdminTestimonialsPage from "@/app/[locale]/admin/cms/testimonials/page";
import SeoAnalyticsPage from "@/app/[locale]/admin/analytics/seo/page";
import ProductDescriptionsPage from "@/app/[locale]/admin/product-descriptions/page";
import SubscriptionsPage from "@/app/[locale]/admin/subscriptions/page";

// ── harness ───────────────────────────────────────────────────────────────────

async function renderPage(el: React.ReactElement): Promise<void> {
  let container: HTMLElement | undefined;
  await React.act(async () => {
    ({ container } = render(el));
  });
  expect(container!.innerHTML.length).toBeGreaterThan(0);
}

describe("admin pages — smoke render", () => {
  beforeEach(() => {
    hoisted.routes = [];
    vi.stubGlobal("fetch", vi.fn(routedFetch));
    // jsdom lacks Element#scrollIntoView — several log/stream panes call it.
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("admin dashboard", async () => {
    await renderPage(<AdminDashboardPage />);
  });

  it("postiz", async () => {
    await renderPage(<AdminPostizPage />);
  });

  it("langgraph", async () => {
    await renderPage(<AdminLangGraphPage />);
  });

  it("client-portals", async () => {
    await renderPage(<AdminClientPortalsPage />);
  });

  it("analytics", async () => {
    await renderPage(<AdminAnalyticsPage />);
  });

  it("gsc", async () => {
    await renderPage(<AdminGscPage />);
  });

  it("campaigns", async () => {
    await renderPage(<AdminCampaignsPage />);
  });

  it("esp32-manager", async () => {
    await renderPage(<AdminEsp32ManagerPage />);
  });

  it("delivery", async () => {
    await renderPage(<AdminDeliveryPage />);
  });

  it("esp32", async () => {
    await renderPage(<AdminEsp32Page />);
  });

  it("monitor", async () => {
    hoisted.routes = [
      [
        "resource=status",
        {
          pis: {},
          esp32: { stale: false },
          alerts: {
            active_count: 0,
            resolved_count: 0,
            by_severity: { critical: 0, high: 0 },
          },
        },
      ],
      ["resource=alerts", []],
    ];
    await renderPage(<AdminMonitorPage />);
  });

  it("ai-assistant", async () => {
    hoisted.routes = [
      [
        "/api/admin/ai/status",
        {
          configured: true,
          vectorize: { configured: false },
          turnstile: { configured: false },
          espocrmQueue: { configured: false },
          usage: {
            recent: [],
            daily: [],
            by_model: [],
            total: 0,
            ok: 0,
            errors: 0,
            viaGateway: 0,
            workersAiConfigured: false,
            aiGatewayConfigured: false,
            gatewayId: "",
            geminiConfigured: false,
          },
        },
      ],
    ];
    await renderPage(<AIAssistantPage />);
  });

  it("consultations", async () => {
    await renderPage(<ConsultationsPage />);
  });

  it("calendar", async () => {
    await renderPage(<CalendarPage />);
  });

  it("workspaces", async () => {
    await renderPage(<WorkspacesPage />);
  });

  it("projects", async () => {
    await renderPage(<AdminProjectsPage />);
  });

  it("settings", async () => {
    await renderPage(<AdminSettingsPage />);
  });

  it("cluster", async () => {
    await renderPage(<ClusterStatusPage />);
  });

  it("errors", async () => {
    await renderPage(<AdminErrorsPage />);
  });

  it("appflowy tasks", async () => {
    await renderPage(<TasksKanbanPage />);
  });

  it("appflowy projects", async () => {
    await renderPage(<AppFlowyProjectsPage />);
  });

  it("cms case-studies", async () => {
    await renderPage(<AdminCaseStudiesPage />);
  });

  it("cms services", async () => {
    await renderPage(<AdminServicesPage />);
  });

  it("cms faqs", async () => {
    await renderPage(<AdminFaqsPage />);
  });

  it("cms testimonials", async () => {
    await renderPage(<AdminTestimonialsPage />);
  });

  it("analytics seo", async () => {
    await renderPage(<SeoAnalyticsPage />);
  });

  it("product descriptions", async () => {
    await renderPage(<ProductDescriptionsPage />);
  });

  it("subscriptions", async () => {
    await renderPage(<SubscriptionsPage />);
  });
});
