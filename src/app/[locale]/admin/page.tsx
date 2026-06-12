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

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Growth — leads to revenue",
    accent: "text-neon-cyan",
    cards: [
      {
        title: "Lead Inbox",
        description: "Unified leads from HubSpot + portal enrollments",
        icon: "📥",
        href: "/admin/leads",
        stat: (s) => (s.leads === null ? null : `${s.leads} leads`),
      },
      {
        title: "Campaign ROI",
        description: "Spend → leads → revenue across all channels",
        icon: "🎯",
        href: "/admin/analytics/unified",
        stat: (s) => (s.roas === null ? null : `ROAS ${s.roas}×`),
      },
      {
        title: "Campaigns",
        description: "Meta, Google, LinkedIn, TikTok, X ads",
        icon: "📣",
        href: "/admin/campaigns",
        stat: (s) => (s.spendCents === null ? null : `€${(s.spendCents / 100).toFixed(0)} spend`),
      },
      {
        title: "Content Calendar",
        description: "Plan and publish social posts via Postiz",
        icon: "🗓",
        href: "/admin/calendar",
      },
      {
        title: "Email Campaigns",
        description: "ActiveCampaign sends and automations",
        icon: "📧",
        href: "/admin/email/campaigns",
      },
      {
        title: "Pipeline",
        description: "HubSpot deals by stage",
        icon: "🔀",
        href: "/admin/pipeline",
      },
    ],
  },
  {
    label: "Clients — the front-end promise",
    accent: "text-neon-green",
    cards: [
      {
        title: "Client Portals",
        description: "Timelines, deliverables, approvals, payments",
        icon: "🤝",
        href: "/admin/client-portals",
        stat: (s) => (s.atRiskClients === null ? null : `${s.atRiskClients} need attention`),
      },
      {
        title: "Orders & Revenue",
        description: "Stripe checkouts and order history",
        icon: "💳",
        href: "/admin/orders",
        stat: (s) =>
          s.orders === null ? null : `${s.orders} orders · €${(s.revenue ?? 0).toFixed(0)}`,
      },
      {
        title: "Subscriptions",
        description: "Recurring plans and MRR",
        icon: "🔁",
        href: "/admin/subscriptions",
      },
      {
        title: "CRM",
        description: "HubSpot contacts, companies, tickets",
        icon: "◉",
        href: "/admin/crm",
      },
    ],
  },
  {
    label: "Website — what visitors see",
    accent: "text-neon-magenta",
    cards: [
      {
        title: "Blog",
        description: "Notion-backed posts on /blog",
        icon: "✍️",
        href: "/admin/blog",
      },
      {
        title: "Case Studies",
        description: "CMS for /case-studies and /work",
        icon: "💼",
        href: "/admin/cms/case-studies",
      },
      {
        title: "Services",
        description: "CMS for the /services page",
        icon: "📦",
        href: "/admin/cms/services",
      },
      {
        title: "Testimonials",
        description: "Social proof shown across the site",
        icon: "⭐",
        href: "/admin/cms/testimonials",
      },
      {
        title: "FAQs",
        description: "CMS for FAQ sections",
        icon: "❓",
        href: "/admin/cms/faqs",
      },
      {
        title: "Docs",
        description: "Notion-backed docs on /docs",
        icon: "📚",
        href: "/admin/docs",
      },
      {
        title: "Form Submissions",
        description: "Contact entries stored in Notion",
        icon: "📝",
        href: "/admin/notion",
      },
      {
        title: "SEO",
        description: "Search Console performance and keywords",
        icon: "🔍",
        href: "/admin/analytics/seo",
      },
    ],
  },
  {
    label: "System — keep it running",
    accent: "text-yellow-400",
    cards: [
      {
        title: "Integrations",
        description: "Live status of every connected service",
        icon: "🔌",
        href: "/admin/integrations",
      },
      {
        title: "Errors",
        description: "Unresolved Sentry issues",
        icon: "⚠️",
        href: "/admin/errors",
        stat: (s) => (s.errors === null ? null : `${s.errors} unresolved`),
      },
      {
        title: "KPI Dashboard",
        description: "GSC, analytics, projects, tasks in one view",
        icon: "📊",
        href: "/admin/kpi",
      },
      {
        title: "Users",
        description: "Cognito accounts and admin access",
        icon: "👤",
        href: "/admin/users",
      },
      {
        title: "Notifications",
        description: "Slack routing and test sends",
        icon: "🔔",
        href: "/admin/notifications",
      },
      {
        title: "Settings",
        description: "Site configuration and preferences",
        icon: "⚙️",
        href: "/admin/settings",
      },
    ],
  },
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
