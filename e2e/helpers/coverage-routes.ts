/**
 * Master list of every page + API route in the app.
 * Source-of-truth for the 100%-coverage specs.
 *
 * Generated once, hand-maintained. Re-derive with:
 *   find src/app -name 'page.*' -o -name 'route.*'
 */

export const PUBLIC_PAGES = [
  "/en",
  "/en/store",
  "/en/services",
  "/en/blog",
  "/en/contact",
  "/en/privacy",
  "/en/terms",
  "/en/docs",
  "/en/refund",
  "/en/cookies",
  "/en/work",
  "/en/case-studies",
] as const;

export const DYNAMIC_PUBLIC_PAGES = [
  // Examples — tests should hit a real slug if available, else assert 200|404
  { template: "/en/blog/:slug", sample: "/en/blog/hello-world" },
  { template: "/en/case-studies/:slug", sample: "/en/case-studies/sample" },
  { template: "/en/docs/:slug", sample: "/en/docs/getting-started" },
  { template: "/en/store/:id", sample: "/en/store/sample" },
  { template: "/en/store/success", sample: "/en/store/success" },
  { template: "/portal/:token", sample: "/portal/dummy-token" },
] as const;

export const AUTH_PAGES = [
  "/en/auth/login",
  "/en/auth/signup",
  "/en/auth/forgot-password",
  "/en/auth/post-login",
] as const;

export const DASHBOARD_PAGES = [
  "/en/dashboard",
  "/en/dashboard/consultations",
  "/en/dashboard/profile",
  "/en/dashboard/purchases",
  "/en/dashboard/settings",
] as const;

export const ADMIN_PAGES = [
  "/en/admin",
  "/en/admin/ab-tests",
  "/en/admin/ai-assistant",
  "/en/admin/ai-generator",
  "/en/admin/analytics",
  "/en/admin/analytics/seo",
  "/en/admin/analytics/funnel",
  "/en/admin/analytics/unified",
  "/en/admin/blog",
  "/en/admin/calendar",
  "/en/admin/campaigns",
  "/en/admin/campaigns/anomalies",
  "/en/admin/campaigns/google",
  "/en/admin/campaigns/linkedin",
  "/en/admin/campaigns/meta",
  "/en/admin/campaigns/tiktok",
  "/en/admin/campaigns/x",
  "/en/admin/client-portals",
  "/en/admin/cms/case-studies",
  "/en/admin/cms/faqs",
  "/en/admin/cms/services",
  "/en/admin/cms/testimonials",
  "/en/admin/crm",
  "/en/admin/crm/companies",
  "/en/admin/crm/tickets",
  "/en/admin/docs",
  "/en/admin/email",
  "/en/admin/email/campaigns",
  "/en/admin/errors",
  "/en/admin/esp32",
  "/en/admin/esp32-manager",
  "/en/admin/integrations",
  "/en/admin/kpi",
  "/en/admin/leads",
  "/en/admin/monitor",
  "/en/admin/notifications",
  "/en/admin/appflowy",
  "/en/admin/appflowy/analytics",
  "/en/admin/appflowy/projects",
  "/en/admin/appflowy/status",
  "/en/admin/appflowy/submissions",
  "/en/admin/appflowy/tasks",
  "/en/admin/orders",
  "/en/admin/pipeline",
  "/en/admin/projects",
  "/en/admin/reports",
  "/en/admin/settings",
  "/en/admin/subscriptions",
  "/en/admin/users",
  "/en/admin/voice-brief",
  "/en/admin/workspaces",
] as const;

export const PUBLIC_API_GET = [
  "/api/health",
  "/api/services",
  "/api/case-studies",
  "/api/blog/posts",
  "/api/faqs",
  "/api/testimonials",
  "/api/docs",
  "/api/pwa-manifest",
  "/api/calendar/availability",
] as const;

export const PUBLIC_API_DYNAMIC = [
  { template: "/api/blog/:slug", sample: "/api/blog/hello-world" },
  { template: "/api/case-studies/:slug", sample: "/api/case-studies/sample" },
  { template: "/api/docs/:slug", sample: "/api/docs/getting-started" },
  { template: "/api/portal/:token", sample: "/api/portal/dummy-token" },
] as const;

export const PUBLIC_API_POST_FORM = [
  "/api/contact",
  "/api/subscribe",
  "/api/unsubscribe",
  "/api/calendar/book",
  "/api/checkout",
  "/api/track",
  "/api/csp-report",
  "/api/crm/contact",
  "/api/agent/book",
  "/api/chat",
  "/api/portal/enroll",
  "/api/portal/me",
] as const;

export const WEBHOOK_APIS = [
  "/api/webhooks/stripe",
  "/api/webhooks/content",
  "/api/webhooks/espocrm",
] as const;

export const SLACK_APIS = [
  "/api/slack/events",
  "/api/slack/commands",
  "/api/slack/interactions",
] as const;

export const CRON_APIS = [
  "/api/cron/calendar-digest",
  "/api/cron/report-cleanup",
  "/api/cron/slack-digest",
  "/api/cron/voice-brief",
  "/api/cron/analytics-rollup",
] as const;

export const USER_APIS = [
  "/api/user/consultations",
  "/api/user/purchases",
  "/api/newsletter/send",
] as const;

export const ADMIN_APIS = [
  "/api/admin/ab-tests",
  "/api/admin/ai/analytics-orchestration",
  "/api/admin/ai/analytics-orchestration/pdf",
  "/api/admin/ai/audience",
  "/api/admin/ai/generate",
  "/api/admin/ai/campaign",
  "/api/admin/ai/copy",
  "/api/admin/ai/report-insights",
  "/api/admin/analytics/countries",
  "/api/admin/analytics/ctr-opportunities",
  "/api/admin/analytics/devices",
  "/api/admin/analytics/history",
  "/api/admin/analytics/keywords",
  "/api/admin/analytics/pages",
  "/api/admin/analytics/products",
  "/api/admin/analytics/query-pages",
  "/api/admin/analytics/search-intent",
  "/api/admin/analytics/seo",
  "/api/admin/analytics/unified",
  "/api/admin/analytics/web",
  "/api/admin/cache",
  "/api/admin/calendar",
  "/api/admin/calendar/create",
  "/api/admin/ad-analytics/anomalies",
  "/api/admin/campaigns/google",
  "/api/admin/campaigns/google/insights",
  "/api/admin/campaigns/linkedin",
  "/api/admin/campaigns/linkedin/insights",
  "/api/admin/campaigns/tiktok",
  "/api/admin/campaigns/tiktok/insights",
  "/api/admin/campaigns/x",
  "/api/admin/campaigns/x/insights",
  "/api/admin/client-portals",
  "/api/admin/crm/companies",
  "/api/admin/crm/contacts",
  "/api/admin/crm/deals",
  "/api/admin/crm/owners",
  "/api/admin/crm/pipelines",
  "/api/admin/crm/tickets",
  "/api/admin/email/automations",
  "/api/admin/email/campaigns",
  "/api/admin/email/contacts",
  "/api/admin/email/lists",
  "/api/admin/email/stats",
  "/api/admin/esp32",
  "/api/admin/integrations/status",
  "/api/admin/kpi",
  "/api/admin/notifications",
  "/api/admin/notifications/test",
  "/api/admin/appflowy/analytics",
  "/api/admin/appflowy/blog",
  "/api/admin/appflowy/comments",
  "/api/admin/appflowy/docs",
  "/api/admin/appflowy/projects",
  "/api/admin/appflowy/search",
  "/api/admin/appflowy/status",
  "/api/admin/appflowy/submissions",
  "/api/admin/appflowy/tasks",
  "/api/admin/oauth/tiktok",
  "/api/admin/oauth/tiktok/callback",
  "/api/admin/ops/errors",
  "/api/admin/ops/monitor",
  "/api/admin/orders",
  "/api/admin/pending-clients",
  "/api/admin/pipeline/board",
  "/api/admin/pipeline/stats",
  "/api/admin/reports",
  "/api/admin/reports/generate",
  "/api/admin/subscriptions",
  "/api/admin/users",
  "/api/admin/voice-brief",
  "/api/admin/workspaces",
] as const;

// Dynamic admin APIs: paths with [param] segments need a sample value to
// exercise. The unauth flow still expects 401/403/404; the auth flow expects
// non-5xx (the sample may legitimately 404 on lookup, which is fine).
export const ADMIN_API_DYNAMIC = [
  { template: "/api/admin/calendar/[id]", sample: "/api/admin/calendar/sample-id" },
  { template: "/api/admin/email/campaigns/[id]", sample: "/api/admin/email/campaigns/sample-id" },
  { template: "/api/admin/ops/errors/[id]", sample: "/api/admin/ops/errors/sample-id" },
  {
    template: "/api/admin/pipeline/deals/[id]/move",
    sample: "/api/admin/pipeline/deals/sample-id/move",
  },
  {
    template: "/api/admin/pipeline/deals/[id]/notes",
    sample: "/api/admin/pipeline/deals/sample-id/notes",
  },
  { template: "/api/admin/reports/[id]", sample: "/api/admin/reports/sample-id" },
  { template: "/api/admin/reports/[id]/pdf", sample: "/api/admin/reports/sample-id/pdf" },
  {
    template: "/api/admin/crm/contacts/[id]",
    sample: "/api/admin/crm/contacts/abcdefghijklmnopq",
  },
] as const;

export const AUTH_API = "/api/auth/session"; // NextAuth handler
