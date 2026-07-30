"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

/**
 * Admin Dashboard — the platform command center.
 * Aligned with every surface of the one-stop-shop platform:
 * growth (leads → campaigns → ROI), clients (portals, deliverables,
 * payments, health), the public website (blog, CMS, store, docs),
 * and system health.
 */

interface PortalHealth {
  score: number;
  band: "healthy" | "watch" | "at_risk";
}

interface PortalSummary {
  deliverables?: { status: string }[];
  paymentLinks?: { status: string }[];
  health?: PortalHealth;
}

interface DashStats {
  leads: number | null;
  spendCents: number | null;
  roas: number | null;
  revenue: number | null;
  orders: number | null;
  reviewsPending: number | null;
  openPayments: number | null;
  pendingClients: number | null;
  atRiskClients: number | null;
  errors: number | null;
  health: { status: string; version: string } | null;
}

const EMPTY_STATS: DashStats = {
  leads: null,
  spendCents: null,
  roas: null,
  revenue: null,
  orders: null,
  reviewsPending: null,
  openPayments: null,
  pendingClients: null,
  atRiskClients: null,
  errors: null,
  health: null,
};

async function safeJson<T>(result: PromiseSettledResult<Response>): Promise<T | null> {
  if (result.status !== "fulfilled" || !result.value.ok) return null;
  try {
    return (await result.value.json()) as T;
  } catch {
    return null;
  }
}

interface NavCard {
  title: string;
  description: string;
  icon: string;
  href: string;
  stat?: (s: DashStats) => string | null;
}

interface NavGroup {
  label: string;
  accent: string;
  cards: NavCard[];
}

/** Compact card constructor — keeps the nav config dense (and CPD-quiet). */
function card(
  title: string,
  description: string,
  icon: string,
  href: string,
  stat?: NavCard["stat"]
): NavCard {
  return { title, description, icon, href, stat };
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Growth — leads to revenue",
    accent: "text-neon-cyan",
    cards: [
      card(
        "Lead Inbox",
        "Unified leads from EspoCRM + portal enrollments",
        "📥",
        "/admin/leads",
        (s) => (s.leads === null ? null : `${s.leads} leads`)
      ),
      card(
        "Campaign ROI",
        "Spend → leads → revenue across all channels",
        "🎯",
        "/admin/analytics/unified",
        (s) => (s.roas === null ? null : `ROAS ${s.roas}×`)
      ),
      card("Campaigns", "Meta, Google, LinkedIn, TikTok, X ads", "📣", "/admin/campaigns", (s) =>
        s.spendCents === null ? null : `€${(s.spendCents / 100).toFixed(0)} spend`
      ),
      card("Content Calendar", "Plan and publish social posts via Postiz", "🗓", "/admin/calendar"),
      card(
        "Postiz",
        "Compose, schedule and review posts on connected social channels",
        "📨",
        "/admin/postiz"
      ),
      card(
        "Email Campaigns",
        "ActiveCampaign sends and automations",
        "📧",
        "/admin/email/campaigns"
      ),
      card("Pipeline", "EspoCRM deals by stage", "🔀", "/admin/pipeline"),
    ],
  },
  {
    label: "Clients — the front-end promise",
    accent: "text-neon-green",
    cards: [
      card(
        "Client Portals",
        "Timelines, deliverables, approvals, payments",
        "🤝",
        "/admin/client-portals",
        (s) => (s.atRiskClients === null ? null : `${s.atRiskClients} need attention`)
      ),
      card("Orders & Revenue", "Stripe checkouts and order history", "💳", "/admin/orders", (s) =>
        s.orders === null ? null : `${s.orders} orders · €${(s.revenue ?? 0).toFixed(0)}`
      ),
      card("Subscriptions", "Recurring plans and MRR", "🔁", "/admin/subscriptions"),
      card("CRM", "EspoCRM contacts, companies, tickets", "◉", "/admin/crm"),
    ],
  },
  {
    label: "Website — what visitors see",
    accent: "text-neon-magenta",
    cards: [
      card("Blog", "Notion-backed posts on /blog", "✍️", "/admin/blog"),
      card("Case Studies", "CMS for /case-studies and /work", "💼", "/admin/cms/case-studies"),
      card("Services", "CMS for the /services page", "📦", "/admin/cms/services"),
      card("Testimonials", "Social proof shown across the site", "⭐", "/admin/cms/testimonials"),
      card("FAQs", "CMS for FAQ sections", "❓", "/admin/cms/faqs"),
      card("Docs", "Notion-backed docs on /docs", "📚", "/admin/docs"),
      card("Form Submissions", "Contact entries stored in Notion", "📝", "/admin/notion"),
      card("SEO", "Search Console performance and keywords", "🔍", "/admin/analytics/seo"),
    ],
  },
  {
    label: "System — keep it running",
    accent: "text-yellow-400",
    cards: [
      card(
        "Self-hosted Apps",
        "One-click admin ingress to EspoCRM, AppFlowy, n8n, Postiz, Grafana, Kuma",
        "🖥",
        "/admin/selfhosted"
      ),
      card("Integrations", "Live status of every connected service", "🔌", "/admin/integrations"),
      card("AWS Cost", "Per-service spend (Athena view, R9 ETL)", "💸", "/admin/cost"),
      card("Errors", "Unresolved Sentry issues", "⚠️", "/admin/errors", (s) =>
        s.errors === null ? null : `${s.errors} unresolved`
      ),
      card("KPI Dashboard", "GSC, analytics, projects, tasks in one view", "📊", "/admin/kpi"),
      card("Users", "Account users and admin access", "👤", "/admin/users"),
      card("Notifications", "Slack routing and test sends", "🔔", "/admin/notifications"),
      card("Settings", "Site configuration and preferences", "⚙️", "/admin/settings"),
    ],
  },
];

/** One-click shortcuts to the most common owner workflows. */
const QUICK_ACTIONS: { label: string; icon: string; href: string }[] = [
  { label: "New client portal", icon: "➕", href: "/admin/client-portals" },
  { label: "Plan a post", icon: "🗓", href: "/admin/calendar" },
  { label: "Generate content", icon: "🤖", href: "/admin/ai-generator" },
  { label: "Write blog post", icon: "✍️", href: "/admin/blog" },
  { label: "Check leads", icon: "📥", href: "/admin/leads" },
  { label: "View live site", icon: "🌐", href: "/" },
];

function buildActionQueue(s: DashStats): { label: string; count: number; href: string }[] {
  const queue = [
    {
      label: "Deliverables awaiting client review",
      count: s.reviewsPending,
      href: "/admin/client-portals",
    },
    { label: "Open payment links", count: s.openPayments, href: "/admin/client-portals" },
    {
      label: "Clients waiting for portal approval",
      count: s.pendingClients,
      href: "/admin/client-portals",
    },
    {
      label: "Clients needing attention (health)",
      count: s.atRiskClients,
      href: "/admin/client-portals",
    },
    { label: "Unresolved errors", count: s.errors, href: "/admin/errors" },
  ];
  return queue.filter(
    (q): q is { label: string; count: number; href: string } =>
      typeof q.count === "number" && q.count > 0
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [leadsRes, roiRes, ordersRes, portalsRes, pendingRes, errorsRes, healthRes] =
          await Promise.allSettled([
            fetchWithAuth("/api/admin/leads?limit=100"),
            fetchWithAuth("/api/admin/analytics/roi"),
            fetchWithAuth("/api/admin/orders?limit=50"),
            fetchWithAuth("/api/admin/client-portals"),
            fetchWithAuth("/api/admin/pending-clients"),
            fetchWithAuth("/api/admin/ops/errors"),
            fetchWithAuth("/api/health"),
          ]);

        const leads = await safeJson<{ total?: number }>(leadsRes);
        const roi = await safeJson<{
          totals?: { spendCents?: number; roas?: number | null };
        }>(roiRes);
        const orders = await safeJson<{ orders?: { amount?: number }[] }>(ordersRes);
        const portals = await safeJson<{ portals?: PortalSummary[] }>(portalsRes);
        const pending = await safeJson<{ clients?: { status?: string }[] }>(pendingRes);
        const errors = await safeJson<{ total?: number }>(errorsRes);
        const health = await safeJson<{ status: string; version: string }>(healthRes);

        const portalList = portals?.portals ?? [];
        const countIn = (
          pick: (p: PortalSummary) => { status: string }[] | undefined,
          status: string
        ) =>
          portalList.reduce(
            (sum, p) => sum + (pick(p) ?? []).filter((item) => item.status === status).length,
            0
          );

        setStats({
          leads: leads?.total ?? null,
          spendCents: roi?.totals?.spendCents ?? null,
          roas: roi?.totals?.roas ?? null,
          revenue: orders?.orders?.reduce((sum, o) => sum + (o.amount ?? 0), 0) ?? null,
          orders: orders?.orders?.length ?? null,
          reviewsPending: portals ? countIn((p) => p.deliverables, "in_review") : null,
          openPayments: portals ? countIn((p) => p.paymentLinks, "open") : null,
          pendingClients: pending
            ? (pending.clients ?? []).filter((c) => c.status === "waiting").length
            : null,
          atRiskClients: portals
            ? portalList.filter((p) => p.health && p.health.band !== "healthy").length
            : null,
          errors: errors?.total ?? null,
          health: health ? { status: health.status, version: health.version } : null,
        });
      } catch {
        /* stats are best-effort */
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const actionQueue = buildActionQueue(stats);

  return (
    <div>
      <div className="mb-8">
        <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">ADMIN_DASH</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="font-body mt-1 text-slate-400">
          Manage your Cloudless platform — leads, campaigns, clients, website, and systems.
        </p>
      </div>

      {/* Quick actions — most common workflows, one click away */}
      <div className="mb-8 flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="bg-void-light/50 hover:border-neon-magenta/40 flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 font-mono text-xs font-semibold text-slate-200 transition-colors hover:text-white"
          >
            <span aria-hidden>{action.icon}</span>
            {action.label}
          </Link>
        ))}
      </div>

      {/* Action queue — what needs the owner right now */}
      {!loading && actionQueue.length > 0 && (
        <div className="border-neon-cyan/30 bg-neon-cyan/5 mb-8 rounded-xl border p-5">
          <h2 className="font-heading mb-3 text-sm font-semibold text-white">
            ⚡ Needs your attention
          </h2>
          <div className="flex flex-wrap gap-2">
            {actionQueue.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="bg-void hover:border-neon-cyan/50 flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 font-mono text-xs text-slate-300 transition-colors hover:text-white"
              >
                <span className="bg-neon-cyan/15 text-neon-cyan flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-bold">
                  {item.count}
                </span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Grouped management grid */}
      <div className="space-y-10">
        {NAV_GROUPS.map((group) => (
          <section key={group.label}>
            <h2
              className={`mb-3 font-mono text-xs font-semibold tracking-widest uppercase ${group.accent}`}
            >
              {group.label}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.cards.map((card) => {
                const statValue = card.stat ? card.stat(stats) : null;
                return (
                  <Link key={card.title} href={card.href}>
                    <div className="bg-void-light/50 hover:border-neon-magenta/30 h-full rounded-xl border border-slate-800 p-5 transition-all">
                      <div className="mb-3 flex items-start justify-between">
                        <div className="bg-neon-magenta/10 border-neon-magenta/20 flex h-9 w-9 items-center justify-center rounded-lg border text-base">
                          {card.icon}
                        </div>
                        {loading && card.stat ? (
                          <span className="h-4 w-16 animate-pulse rounded bg-slate-800/50" />
                        ) : (
                          <span className="text-neon-green font-mono text-xs">
                            {statValue ?? "Open →"}
                          </span>
                        )}
                      </div>
                      <h3 className="font-heading mb-0.5 text-sm font-semibold text-white">
                        {card.title}
                      </h3>
                      <p className="font-body text-xs text-slate-500">{card.description}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* System Status */}
      <div className="bg-void-light/50 mt-10 rounded-xl border border-slate-800 p-6">
        <h2 className="font-heading mb-4 font-semibold text-white">System Status</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              label: "API",
              status: stats.health?.status === "ok" ? "Operational" : "Unknown",
              ok: stats.health?.status === "ok",
            },
            {
              label: "Version",
              status: stats.health?.version ?? "—",
              ok: !!stats.health?.version,
            },
            {
              label: "Errors",
              status:
                stats.errors !== null
                  ? stats.errors === 0
                    ? "All Clear"
                    : `${stats.errors} unresolved`
                  : "Not connected",
              ok: stats.errors === 0,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-void flex items-center gap-3 rounded-lg border border-slate-800 px-4 py-3"
            >
              <span
                className={`h-2 w-2 rounded-full ${item.ok ? "bg-neon-green" : "bg-slate-600"}`}
              />
              <span className="font-mono text-sm text-slate-400">{item.label}</span>
              <span
                className={`ml-auto font-mono text-xs ${item.ok ? "text-neon-green" : "text-slate-500"}`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
