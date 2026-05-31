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
  "/en/admin/analytics",
  "/en/admin/analytics/unified",
  "/en/admin/blog",
  "/en/admin/calendar",
  "/en/admin/campaigns",
  "/en/admin/campaigns/google",
  "/en/admin/campaigns/linkedin",
  "/en/admin/campaigns/tiktok",
  "/en/admin/campaigns/x",
  "/en/admin/client-portals",
  "/en/admin/crm",
  "/en/admin/crm/companies",
  "/en/admin/crm/tickets",
  "/en/admin/docs",
  "/en/admin/email",
  "/en/admin/errors",
  "/en/admin/esp32",
  "/en/admin/esp32-manager",
  "/en/admin/hubspot",
  "/en/admin/integrations",
  "/en/admin/kpi",
  "/en/admin/monitor",
  "/en/admin/notifications",
  "/en/admin/notion",
  "/en/admin/notion/analytics",
  "/en/admin/notion/projects",
  "/en/admin/notion/status",
  "/en/admin/notion/submissions",
  "/en/admin/notion/tasks",
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
  "/api/hubspot/ticket",
  "/api/notion-image",
  "/api/agent/book",
  "/api/chat",
  "/api/portal/enroll",
  "/api/portal/me",
] as const;

export const WEBHOOK_APIS = [
  "/api/webhooks/stripe",
  "/api/webhooks/notion",
  "/api/webhooks/hubspot",
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
  "/api/admin/users",
  "/api/admin/subscriptions",
  "/api/admin/ab-tests",
  "/api/admin/orders",
  "/api/admin/workspaces",
  "/api/admin/reports",
  "/api/admin/pending-clients",
  "/api/admin/client-portals",
  "/api/admin/notifications",
  "/api/admin/voice-brief",
  "/api/admin/esp32",
  "/api/admin/cache",
  "/api/admin/kpi",
  "/api/admin/calendar",
] as const;

export const AUTH_API = "/api/auth/session"; // NextAuth handler
