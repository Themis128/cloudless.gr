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
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
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
  alerts: { active_count: 0, resolved_count: 0, by_severity: {}, alerts: [] },
  stats: {},
  summary: "",
  monitors: [],
  insight: { summary: "", bullets: [], metrics_cited: [], confidence: "" },
  snapshot: { history: [] },
  analytics: { series: [] },
};

const AI_STATUS = {
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
  for (const [frag, body] of hoisted.routes) {
    if (url.includes(frag)) return okJson(body);
  }
  return okJson();
};

vi.mock("@/lib/fetch-with-auth", () => ({
  // Deferred: page modules import fetch-with-auth before this file's consts init.
  fetchWithAuth: vi.fn((...args: Parameters<typeof fetch>) => routedFetch(...args)),
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
import AbTestsPage from "@/app/[locale]/admin/ab-tests/page";
import AiGeneratorPage from "@/app/[locale]/admin/ai-generator/page";
import AnalyticsDatalakePage from "@/app/[locale]/admin/analytics/datalake/page";
import AnalyticsEnginePage from "@/app/[locale]/admin/analytics/engine/page";
import AnalyticsExplorePage from "@/app/[locale]/admin/analytics/explore/page";
import AnalyticsFunnelPage from "@/app/[locale]/admin/analytics/funnel/page";
import AnalyticsSocialPage from "@/app/[locale]/admin/analytics/social/page";
import AnalyticsUnifiedPage from "@/app/[locale]/admin/analytics/unified/page";
import AnalyticsWorkspacesPage from "@/app/[locale]/admin/analytics/workspaces/page";
import AppFlowyAnalyticsPage from "@/app/[locale]/admin/appflowy/analytics/page";
import AppFlowyRootPage from "@/app/[locale]/admin/appflowy/page";
import AppFlowyStatusPage from "@/app/[locale]/admin/appflowy/status/page";
import AppFlowySubmissionsPage from "@/app/[locale]/admin/appflowy/submissions/page";
import AuditsPage from "@/app/[locale]/admin/audits/page";
import AutomationPage from "@/app/[locale]/admin/automation/page";
import AdminBlogPage from "@/app/[locale]/admin/blog/page";
import CampaignsAnomaliesPage from "@/app/[locale]/admin/campaigns/anomalies/page";
import CampaignsGooglePage from "@/app/[locale]/admin/campaigns/google/page";
import CampaignsLinkedinPage from "@/app/[locale]/admin/campaigns/linkedin/page";
import CampaignsMetaPage from "@/app/[locale]/admin/campaigns/meta/page";
import CampaignsTiktokPage from "@/app/[locale]/admin/campaigns/tiktok/page";
import CampaignsXPage from "@/app/[locale]/admin/campaigns/x/page";
import CostPage from "@/app/[locale]/admin/cost/page";
import CrmDetailPage from "@/app/[locale]/admin/crm/[id]/page";
import CrmCompaniesPage from "@/app/[locale]/admin/crm/companies/page";
import CrmPage from "@/app/[locale]/admin/crm/page";
import CrmTicketsPage from "@/app/[locale]/admin/crm/tickets/page";
import AdminDocsPage from "@/app/[locale]/admin/docs/page";
import EmailCampaignsPage from "@/app/[locale]/admin/email/campaigns/page";
import EmailPage from "@/app/[locale]/admin/email/page";
import GrafanaPage from "@/app/[locale]/admin/grafana/page";
import HeadlampPage from "@/app/[locale]/admin/headlamp/page";
import IntegrationsPage from "@/app/[locale]/admin/integrations/page";
import InvoicesPage from "@/app/[locale]/admin/invoices/page";
import KpiPage from "@/app/[locale]/admin/kpi/page";
import LeadsPage from "@/app/[locale]/admin/leads/page";
import NotificationsPage from "@/app/[locale]/admin/notifications/page";
import OrdersPage from "@/app/[locale]/admin/orders/page";
import PipelinePage from "@/app/[locale]/admin/pipeline/page";
import ReportsDetailPage from "@/app/[locale]/admin/reports/[id]/page";
import ReportsPage from "@/app/[locale]/admin/reports/page";
import SelfhostedPage from "@/app/[locale]/admin/selfhosted/page";
import SocialOpsPage from "@/app/[locale]/admin/social-ops/page";
import UsersPage from "@/app/[locale]/admin/users/page";
import VoiceBriefPage from "@/app/[locale]/admin/voice-brief/page";

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
          esp32: {
            stale: false,
            ip: "192.168.1.50",
            firmware_ver: "1.0.0",
            rssi: -55,
            uptime_s: 3600,
            free_ram_bytes: 200000,
            last_heartbeat: "2026-01-01T00:00:00Z",
          },
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
    hoisted.routes = [["/api/admin/ai/status", AI_STATUS]];
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

  it("ab-tests", async () => {
    await renderPage(<AbTestsPage />);
  });
  it("ai-generator", async () => {
    hoisted.routes = [["/api/admin/ai/status", AI_STATUS]];
    await renderPage(<AiGeneratorPage />);
  });
  it("analytics/datalake", async () => {
    hoisted.routes = [["datalake", { sections: [] }]];
    await renderPage(<AnalyticsDatalakePage />);
  });
  it("analytics/engine", async () => {
    await renderPage(<AnalyticsEnginePage />);
  });
  it("analytics/explore", async () => {
    await renderPage(<AnalyticsExplorePage />);
  });
  it("analytics/funnel", async () => {
    await renderPage(<AnalyticsFunnelPage />);
  });
  it("analytics/social", async () => {
    hoisted.routes = [
      ["postiz/analytics/summary", { totals: {}, channels: [], topPosts: [] }],
      ["social-attribution", { totals: {}, channels: [], topPosts: [], rows: [] }],
    ];
    await renderPage(<AnalyticsSocialPage />);
  });
  it("analytics/unified", async () => {
    hoisted.routes = [
      [
        "/api/admin/analytics/roi",
        {
          totals: {
            spendCents: 0,
            newLeads: null,
            costPerLeadCents: null,
            roas: null,
            revenueCents: 0,
          },
          windowDays: 0,
          channels: [],
        },
      ],
    ];
    await renderPage(<AnalyticsUnifiedPage />);
  });
  it("analytics/workspaces", async () => {
    hoisted.routes = [
      [
        "analytics/workspaces",
        {
          workspaces: [],
          orgWide: {
            portals: { total: 0 },
            deliverables: { total: 0 },
            revenue: { paidAmountCents: 0, openAmountCents: 0, currency: "EUR" },
            calendar: { total: 0 },
          },
        },
      ],
    ];
    await renderPage(<AnalyticsWorkspacesPage />);
  });
  it("appflowy/analytics", async () => {
    hoisted.routes = [
      [
        "appflowy/analytics",
        { totalEvents: 0, byType: {}, topPages: [], topSources: [], recentEvents: [], days: [] },
      ],
    ];
    await renderPage(<AppFlowyAnalyticsPage />);
  });
  it("appflowy", async () => {
    await renderPage(<AppFlowyRootPage />);
  });
  it("appflowy/status", async () => {
    hoisted.routes = [["appflowy/status", { databases: [] }]];
    await renderPage(<AppFlowyStatusPage />);
  });
  it("appflowy/submissions", async () => {
    await renderPage(<AppFlowySubmissionsPage />);
  });
  it("audits", async () => {
    hoisted.routes = [["audits/latest", { repo: "x", audits: {} }]];
    await renderPage(<AuditsPage />);
  });
  it("automation", async () => {
    hoisted.routes = [
      [
        "n8n/health",
        {
          ok: true,
          workflows: { total: 0, active: 0 },
          executions: { recent: 0, errors: 0 },
        },
      ],
      ["n8n/workflows", { workflows: [] }],
      ["n8n/executions", { executions: [] }],
    ];
    await renderPage(<AutomationPage />);
  });
  it("blog", async () => {
    await renderPage(<AdminBlogPage />);
  });
  it("campaigns/anomalies", async () => {
    await renderPage(<CampaignsAnomaliesPage />);
  });
  it("campaigns/google", async () => {
    await renderPage(<CampaignsGooglePage />);
  });
  it("campaigns/linkedin", async () => {
    await renderPage(<CampaignsLinkedinPage />);
  });
  it("campaigns/meta", async () => {
    await renderPage(<CampaignsMetaPage />);
  });
  it("campaigns/tiktok", async () => {
    await renderPage(<CampaignsTiktokPage />);
  });
  it("campaigns/x", async () => {
    await renderPage(<CampaignsXPage />);
  });
  it("cost", async () => {
    hoisted.routes = [["/api/admin/cost", { topServices: [], dailyTrend: [] }]];
    await renderPage(<CostPage />);
  });
  it("crm/[id]", async () => {
    await renderPage(<CrmDetailPage />);
  });
  it("crm/companies", async () => {
    await renderPage(<CrmCompaniesPage />);
  });
  it("crm", async () => {
    await renderPage(<CrmPage />);
  });
  it("crm/tickets", async () => {
    await renderPage(<CrmTicketsPage />);
  });
  it("docs", async () => {
    await renderPage(<AdminDocsPage />);
  });
  it("email/campaigns", async () => {
    await renderPage(<EmailCampaignsPage />);
  });
  it("email", async () => {
    hoisted.routes = [
      [
        "email/contacts",
        { contacts: [], total: 0, fetchedAt: "2026-01-01T00:00:00Z" },
      ],
    ];
    await renderPage(<EmailPage />);
  });
  it("grafana", async () => {
    await renderPage(<GrafanaPage />);
  });
  it("headlamp", async () => {
    await renderPage(<HeadlampPage />);
  });
  it("integrations", async () => {
    await renderPage(<IntegrationsPage />);
  });
  it("invoices", async () => {
    await renderPage(<InvoicesPage />);
  });
  it("kpi", async () => {
    hoisted.routes = [
      [
        "/api/admin/kpi",
        {
          projects: { total: 0, activeCount: 0, byStatus: {} },
          tasks: { summary: {}, overdueCount: 0 },
          fetchedAt: "2026-01-01T00:00:00Z",
        },
      ],
    ];
    await renderPage(<KpiPage />);
  });
  it("leads", async () => {
    await renderPage(<LeadsPage />);
  });
  it("notifications", async () => {
    hoisted.routes = [
      ["notifications/analytics", { byDay: {}, byCategory: {}, window: { since: "2026-01-01" } }],
      ["/api/admin/notifications", { notifications: [] }],
    ];
    await renderPage(<NotificationsPage />);
  });
  it("orders", async () => {
    await renderPage(<OrdersPage />);
  });
  it("pipeline", async () => {
    hoisted.routes = [
      ["pipeline/stats", { byStage: {} }],
      ["pipeline/board", { stages: [], deals: [] }],
    ];
    await renderPage(<PipelinePage />);
  });
  it("reports/[id]", async () => {
    await renderPage(<ReportsDetailPage />);
  });
  it("reports", async () => {
    await renderPage(<ReportsPage />);
  });
  it("selfhosted", async () => {
    await renderPage(<SelfhostedPage />);
  });
  it("social-ops", async () => {
    hoisted.routes = [["postiz/ops", { accounts: [] }]];
    await renderPage(<SocialOpsPage />);
  });
  it("users", async () => {
    await renderPage(<UsersPage />);
  });
  it("voice-brief", async () => {
    await renderPage(<VoiceBriefPage />);
  });
});
