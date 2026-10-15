/**
 * Tail coverage: client-portals route (all PATCH actions), integrations/status
 * (ping matrix), esp32 route (LAN guard + proxies), auth/activate (redirect +
 * OTP + HTTP-D1 fallback), lib/appflowy-faqs (mapping/sort/filter paths).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const rm = vi.hoisted(() => ({
  createUser: vi.fn(),
  validateSecret: vi.fn(),
  validateStrength: vi.fn(),
  recordNotification: vi.fn(),
  sendActivationEmail: vi.fn(),
  notifyTeam: vi.fn(),
  slackReg: vi.fn(),
  trackEvent: vi.fn(),
  isD1Limit: vi.fn(),
  verifyTurnstile: vi.fn(),
}));

const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  rateLimit: vi.fn(),
  getAuthDbFromEnv: vi.fn(),
  markEmailVerified: vi.fn(),
  verifyOtp: vi.fn(),
  verifyToken: vi.fn(),
  canonicalOrigin: vi.fn(),
  readPortals: vi.fn(),
  writePortals: vi.fn(),
  getActiveWorkspaceId: vi.fn(),
  scoreClientHealth: vi.fn(),
  getConfig: vi.fn(),
  verifyACToken: vi.fn(),
  leadAutoStatus: vi.fn(),
  normalizeMetaId: vi.fn(),
  metaGraphUrl: vi.fn(),
  afConfigured: vi.fn(),
  afWorkspaces: vi.fn(),
  afViews: vi.fn(),
  afDoc: vi.fn(),
  afText: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({ requireAdmin: m.requireAdmin }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: m.rateLimit,
  getClientIp: () => "1.2.3.4",
}));
// rm is declared below via hoisted split — see register section
vi.mock("@/lib/auth-activation", () => ({
  verifyActivationOtp: m.verifyOtp,
  verifyActivationToken: m.verifyToken,
}));
vi.mock("@/lib/canonical-origin", () => ({ canonicalOrigin: m.canonicalOrigin }));
vi.mock("@/lib/auth-d1", () => ({
  getAuthDbFromEnv: m.getAuthDbFromEnv,
  markEmailVerified: m.markEmailVerified,
  createUser: rm.createUser,
  validateSessionSecret: rm.validateSecret,
  validatePasswordStrength: rm.validateStrength,
}));
vi.mock("@/lib/client-portals", () => ({
  computePortalExpiry: vi.fn(() => "2027-01-01"),
  filterPortalsByWorkspace: vi.fn((all: unknown[]) => all),
  newDeliverable: vi.fn((d: Record<string, unknown>) => ({ id: "d1", status: "pending", ...d })),
  newPaymentLink: vi.fn((l: Record<string, unknown>) => ({ id: "pl1", status: "pending", ...l })),
  readPortals: m.readPortals,
  writePortals: m.writePortals,
}));
vi.mock("@/lib/workspace-server", () => ({ getActiveWorkspaceId: m.getActiveWorkspaceId }));
vi.mock("@/lib/client-health", () => ({ scoreClientHealth: m.scoreClientHealth }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: m.getConfig }));
vi.mock("@/lib/activecampaign", () => ({
  verifyActiveCampaignToken: m.verifyACToken,
  getLeadAutomationStatus: m.leadAutoStatus,
}));
vi.mock("@/lib/meta-graph", () => ({
  META_ACCOUNT_STATUS_LABEL: { 3: "UNSETTLED" },
  formatMetaDisableReason: () => "policy",
  metaGraphUrl: m.metaGraphUrl,
  normalizeMetaAdAccountId: m.normalizeMetaId,
}));
vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: m.afConfigured,
  listAllWorkspaces: m.afWorkspaces,
  listAllViewsDeep: m.afViews,
  getDocument: m.afDoc,
  extractDocText: m.afText,
  fetchViewMarkdownMap: async (_ws: string, views: { view_id: string }[]) =>
    new Map(
      await Promise.all(
        views.map(async (v) => {
          try {
            return [v.view_id, await m.afText(await m.afDoc(_ws, v.view_id))] as const;
          } catch {
            return [v.view_id, null] as const;
          }
        })
      )
    ),
}));
vi.mock("@/lib/cms-static", () => ({
  staticFaqs: [{ id: "s1", question: "SQ", answer: "SA", category: "general", locales: [] }],
  staticTestimonials: [{ id: "st1", name: "Static T", quote: "q", featured: false }],
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const req = (url: string, init?: RequestInit) =>
  new NextRequest(`https://x.test${url}`, init as never);

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  m.requireAdmin.mockResolvedValue({ ok: true });
  m.rateLimit.mockReturnValue({ ok: true });
  m.canonicalOrigin.mockReturnValue("https://cloudless.gr");
  m.getActiveWorkspaceId.mockResolvedValue("w1");
  m.scoreClientHealth.mockReturnValue(80);
  m.readPortals.mockResolvedValue([]);
  m.writePortals.mockResolvedValue(undefined);
  m.getConfig.mockResolvedValue({});
  m.verifyACToken.mockResolvedValue({ status: "not_configured" });
  m.leadAutoStatus.mockResolvedValue({ apiConfigured: false, leadAutomationIdSet: false });
});

import * as portalsRoute from "@/app/api/admin/client-portals/route";
import * as statusRoute from "@/app/api/admin/integrations/status/route";
import * as esp32Route from "@/app/api/admin/esp32/route";
import * as activateRoute from "@/app/api/auth/activate/route";
import { getFaqs, getFaqsByCategory, getAllFaqsAdmin } from "@/lib/appflowy-faqs";

describe("client-portals route", () => {
  const portal = {
    token: "t1", label: "L", clientEmail: "c@x.co", clientName: "C",
    createdAt: "d", expiresAt: "e",
    steps: [{ id: "s1", name: "Step", status: "pending", comments: [{ id: "cm1" }] }],
    deliverables: [{ id: "d1", title: "D" }],
    paymentLinks: [{ id: "pl1", status: "pending" }],
  };

  it("GET lists with health; auth + error paths", async () => {
    m.readPortals.mockResolvedValueOnce([portal]);
    const res = await portalsRoute.GET(req("/api/admin/client-portals"));
    const body = await res.json();
    expect(body.portals[0].health).toBe(80);
    expect(body.workspaceId).toBe("w1");

    m.readPortals.mockResolvedValueOnce([]);
    await portalsRoute.GET(req("/api/admin/client-portals?all=1"));
    expect(m.getActiveWorkspaceId).toHaveBeenCalledTimes(1); // not called for ?all=1

    m.requireAdmin.mockResolvedValueOnce({ ok: false, response: new Response("x", { status: 401 }) });
    expect((await portalsRoute.GET(req("/x"))).status).toBe(401);

    m.readPortals.mockRejectedValueOnce(new Error("boom"));
    expect((await portalsRoute.GET(req("/x"))).status).toBe(500);
  });

  it("POST validates + creates with custom steps and workspace override", async () => {
    const res400 = await portalsRoute.POST(
      req("/x", { method: "POST", body: JSON.stringify({ label: "L" }) })
    );
    expect(res400.status).toBe(400);

    const res = await portalsRoute.POST(
      req("/x", { method: "POST", body: JSON.stringify({ label: "L", clientEmail: "e@x.co", stepNames: ["A", "B"], workspaceId: "wX" }) })
    );
    expect(res.status).toBe(201);
    const { portal: p } = await res.json();
    expect(p.steps).toHaveLength(2);
    expect(p.workspaceId).toBe("wX");

    // write failure → 502
    m.writePortals.mockRejectedValueOnce(new Error("ssm down"));
    const res502 = await portalsRoute.POST(
      req("/x", { method: "POST", body: JSON.stringify({ label: "L", clientEmail: "e@x.co" }) })
    );
    expect(res502.status).toBe(502);
  });

  it("PATCH dispatches every action", async () => {
    // fresh copy per read so mutations don't leak between actions
    m.readPortals.mockImplementation(() =>
      Promise.resolve([JSON.parse(JSON.stringify(portal))])
    );
    const patch = (body: Record<string, unknown>) =>
      portalsRoute.PATCH(req("/x", { method: "PATCH", body: JSON.stringify({ token: "t1", ...body }) }));

    expect((await patch({})).status).toBe(400); // missing action
    m.readPortals.mockResolvedValueOnce([{ ...portal, token: "other" }]);
    expect((await patch({ action: "add-step", name: "N" })).status).toBe(404);

    expect((await patch({ action: "update-step", stepId: "s1", status: "completed" })).status).toBe(200);
    expect((await patch({ action: "update-step", stepId: "nope", status: "x" })).status).toBe(404);
    expect((await patch({ action: "add-comment", stepId: "s1", text: "" })).status).toBe(400);
    expect((await patch({ action: "add-comment", stepId: "s1", author: "A", text: "hi" })).status).toBe(200);
    expect((await patch({ action: "delete-comment", stepId: "s1", commentId: "cm1" })).status).toBe(200);
    expect((await patch({ action: "add-step", name: " " })).status).toBe(400);
    expect((await patch({ action: "add-step", name: "New" })).status).toBe(200);
    expect((await patch({ action: "delete-step", stepId: "s1" })).status).toBe(200);
    expect((await patch({ action: "rename-step", stepId: "s1", name: "R" })).status).toBe(200);
    expect((await patch({ action: "rename-step", stepId: "x", name: "R" })).status).toBe(404);
    expect((await patch({ action: "add-deliverable", title: "T", url: "u" })).status).toBe(200);
    expect((await patch({ action: "add-deliverable", title: "" })).status).toBe(400);
    expect((await patch({ action: "update-deliverable", deliverableId: "d1", status: "done", title: "T2", url: "", description: "d" })).status).toBe(200);
    expect((await patch({ action: "update-deliverable", deliverableId: "x" })).status).toBe(404);
    expect((await patch({ action: "delete-deliverable", deliverableId: "d1" })).status).toBe(200);
    expect((await patch({ action: "add-payment-link", label: "L", url: "u", amountCents: 100 })).status).toBe(200);
    expect((await patch({ action: "add-payment-link", label: "", url: "u" })).status).toBe(400);
    expect((await patch({ action: "update-payment-link", paymentLinkId: "pl1", status: "paid" })).status).toBe(200);
    expect((await patch({ action: "update-payment-link", paymentLinkId: "x", status: "paid" })).status).toBe(404);
    expect((await patch({ action: "delete-payment-link", paymentLinkId: "pl1" })).status).toBe(200);
    expect((await patch({ action: "set-reports-enabled", enabled: true })).status).toBe(200);
    expect((await patch({ action: "extend-token", ttlDays: 30 })).status).toBe(200);
    expect((await patch({ action: "extend-token" })).status).toBe(200);
    const rot = await patch({ action: "rotate-token", ttlDays: 5 });
    expect(rot.status).toBe(200);
    expect((await patch({ action: "bogus" })).status).toBe(400);
  });

  it("DELETE removes by token; 400 without", async () => {
    expect((await portalsRoute.DELETE(req("/x", { method: "DELETE", body: "{}" }))).status).toBe(400);
    m.readPortals.mockResolvedValueOnce([portal]);
    expect((await portalsRoute.DELETE(req("/x", { method: "DELETE", body: JSON.stringify({ token: "t1" }) }))).status).toBe(200);
    expect(m.writePortals).toHaveBeenCalledWith([]);
  });
});

describe("integrations/status route", () => {
  it("builds the full report matrix from pings", async () => {
    m.getConfig.mockResolvedValue({
      STRIPE_SECRET_KEY: "sk", ESPOCRM_BASE_URL: "https://espo", ESPOCRM_API_KEY: "k",
      SLACK_BOT_TOKEN: "xoxb", NOTION_API_KEY: "nt", POSTIZ_API_URL: "https://postiz",
      POSTIZ_API_KEY: "pk", APPFLOWY_API_URL: "https://af", N8N_API_URL: "https://n8n",
      N8N_API_KEY: "nk", META_AD_ACCOUNT_ID: "act_1", META_ACCESS_TOKEN: "mt", META_PIXEL_ID: "px",
      LINKEDIN_ACCESS_TOKEN: "lt", LINKEDIN_AD_ACCOUNT_ID: "la", LINKEDIN_ORGANIZATION_URN: "lo",
      TIKTOK_APP_ID: "ti", TIKTOK_APP_SECRET: "ts",
      X_API_KEY: "xk", X_ACCESS_TOKEN: "xt", X_API_SECRET: "xs", X_ACCESS_SECRET: "xs2",
      GOOGLE_ADS_DEVELOPER_TOKEN: "gd", GOOGLE_ADS_CUSTOMER_ID: "gc",
      GOOGLE_CLIENT_EMAIL: "ge", GOOGLE_PRIVATE_KEY: "gp", GOOGLE_CALENDAR_ID: "gcid",
      GEMINI_API_KEY: "gm",
    });
    m.verifyACToken.mockResolvedValue({ status: "valid", message: "ok" });
    m.leadAutoStatus.mockResolvedValue({ apiConfigured: true, leadAutomationIdSet: false });
    m.normalizeMetaId.mockReturnValue("act_1");
    m.metaGraphUrl.mockReturnValue("https://graph.facebook.com/v21/act_1");
    process.env.NEXT_PUBLIC_SENTRY_DSN = "dsn";
    process.env.CLOUDFLARE_ACCOUNT_ID = "ca";
    process.env.CLOUDFLARE_API_TOKEN = "ct";
    process.env.TURNSTILE_SECRET_KEY = "ts";
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "tsite";
    process.env.CLOUDFLARE_AI_GATEWAY_ID = "gw";
    process.env.ESPOCRM_QUEUE_PRODUCER_URL = "u";
    process.env.ESPOCRM_QUEUE_PRODUCER_SECRET = "s";

    // URL-keyed fetch responses for all pings
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("stripe.com")) return new Response("{}", { status: 200 });
      if (url.includes("/api/v1/App/user")) return new Response("{}", { status: 401 });
      if (url.includes("slack.com")) return json({ ok: true, team: "T" });
      if (url.includes("notion.com")) return new Response("{}", { status: 401 });
      if (url.includes("/api/public/v1/groups")) return new Response("x", { status: 404 });
      if (url.includes("postiz")) return new Response("{}", { status: 200 });
      if (url.includes("/api/health")) return new Response("ok", { status: 200 });
      if (url.includes("/api/v1/workflows")) return new Response("{}", { status: 401 });
      if (url.includes("graph.facebook")) return json({ account_status: 2, disable_reason: 1, name: "Acct" });
      return new Response("{}", { status: 200 });
    });

    const res = await statusRoute.GET(req("/api/admin/integrations/status"));
    const body = await res.json();
    expect(body.summary.total).toBe(22);
    const byId = Object.fromEntries(body.integrations.map((i: { id: string }) => [i.id, i]));
    expect(byId.stripe.status).toBe("configured");
    expect(byId.espocrm.status).toBe("degraded");
    expect(byId.slack.message).toBe("Workspace: T");
    expect(byId.notion.status).toBe("degraded");
    expect(byId.postiz.message).toContain("/groups");
    expect(byId.appflowy.status).toBe("configured");
    expect(byId.n8n.status).toBe("degraded");
    expect(byId.meta.status).toBe("degraded");
    expect(byId.meta.message).toContain("DISABLED");
    expect(byId.activecampaign.status).toBe("degraded");
    expect(byId.activecampaign.message).toContain("LEAD_AUTOMATION");
    expect(byId.tiktok.status).toBe("degraded");
    expect(byId.tiktok.setupUrl).toBe("/api/admin/oauth/tiktok");
    expect(byId.x.status).toBe("degraded");
    expect(byId.x.message).toContain("X_AD_ACCOUNT_ID");
    expect(byId.workers_ai ?? byId["workers-ai"]).toBeDefined();

    // auth failure propagates
    m.requireAdmin.mockResolvedValueOnce({ ok: false, response: new Response("x", { status: 401 }) });
    expect((await statusRoute.GET(req("/x"))).status).toBe(401);
  });

  it("handles ping errors and unconfigured services", async () => {
    m.getConfig.mockResolvedValue({ STRIPE_SECRET_KEY: "sk", POSTIZ_API_URL: "https://postiz", POSTIZ_API_KEY: "k" });
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("stripe.com")) throw new Error("net");
      if (url.includes("postiz")) return new Response("x", { status: 503 });
      return new Response("{}", { status: 200 });
    });
    const res = await statusRoute.GET(req("/x"));
    const body = await res.json();
    const byId = Object.fromEntries(body.integrations.map((i: { id: string }) => [i.id, i]));
    expect(byId.stripe).toMatchObject({ status: "error", message: "Connection failed." });
    expect(byId.postiz.status).toBe("error");
    expect(byId.postiz.message).toContain("pod/container may be down");
    expect(byId.espocrm.status).toBe("not_configured");
  });

  it("survives a groups-probe rejection and reports an active Meta account", async () => {
    m.getConfig.mockResolvedValue({
      POSTIZ_API_URL: "https://postiz", POSTIZ_API_KEY: "pk",
      META_AD_ACCOUNT_ID: "act_1", META_ACCESS_TOKEN: "mt", META_PIXEL_ID: "px",
    });
    m.normalizeMetaId.mockReturnValue("act_1");
    m.metaGraphUrl.mockReturnValue("https://graph.facebook.com/v21/act_1");
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/public/v1/groups")) throw new Error("reset");
      if (url.includes("postiz")) return new Response("{}", { status: 200 });
      if (url.includes("graph.facebook"))
        return json({ account_status: 1, name: "Main Acct" });
      return new Response("{}", { status: 200 });
    });
    const res = await statusRoute.GET(req("/x"));
    const body = await res.json();
    const byId = Object.fromEntries(body.integrations.map((i: { id: string }) => [i.id, i]));
    expect(byId.postiz.status).toBe("configured");
    expect(byId.meta).toMatchObject({
      status: "configured",
      message: "Ad account: Main Acct",
    });
  });
});

describe("esp32 route", () => {
  it("GET devices wraps single status; error paths", async () => {
    mockFetch.mockResolvedValueOnce(json({ device_id: "esp32-a", ip: "1.2.3.4", rssi: -50 }));
    const res = await esp32Route.GET(req("/x?action=devices"));
    const list = await res.json();
    expect(list[0].device_id).toBe("esp32-a");

    mockFetch.mockResolvedValueOnce(json({ id: 7 }));
    const res2 = await esp32Route.GET(req("/x?action=devices"));
    expect((await res2.json())[0].device_id).toBe("esp32-7");

    mockFetch.mockResolvedValueOnce(new Response("x", { status: 500 }));
    expect((await esp32Route.GET(req("/x?action=devices"))).status).toBe(404);
    mockFetch.mockRejectedValueOnce(new Error("net"));
    expect((await esp32Route.GET(req("/x?action=devices"))).status).toBe(404);
  });

  it("GET config proxy + unknown action + auth", async () => {
    mockFetch.mockResolvedValueOnce(json({ led: 1 }));
    const res = await esp32Route.GET(req("/x?action=config&device_id=dev-1"));
    expect(await res.json()).toEqual({ led: 1 });
    expect(String(mockFetch.mock.calls[0][0])).toContain("/api/esp32/dev-1/config");

    expect((await esp32Route.GET(req("/x?action=bogus"))).status).toBe(400);
    m.requireAdmin.mockResolvedValueOnce({ ok: false, response: new Response("x", { status: 401 }) });
    expect((await esp32Route.GET(req("/x"))).status).toBe(401);
  });

  it("proxyRequest maps upstream 404 + network failure", async () => {
    mockFetch.mockResolvedValueOnce(new Response("x", { status: 404 }));
    const res = await esp32Route.GET(req("/x?action=config"));
    expect(res.status).toBe(404);
    expect((await res.json()).offline).toBe(true);
    mockFetch.mockRejectedValueOnce(new Error("net"));
    expect((await esp32Route.GET(req("/x?action=config"))).status).toBe(404);
  });

  it("POST command/ota + PUT config proxy through; bad device_id sanitized", async () => {
    mockFetch.mockResolvedValue(json({ ok: true }));
    await esp32Route.POST(req("/x?action=command&device_id=dev%2F..", { method: "POST", body: "{}" }));
    expect(String(mockFetch.mock.calls[0][0])).toContain("/api/esp32/esp32-leds/command"); // sanitized
    await esp32Route.POST(req("/x?action=ota", { method: "POST", body: "{}" }));
    expect(String(mockFetch.mock.calls[1][0])).toContain("/api/esp32/ota");
    expect((await esp32Route.POST(req("/x?action=bogus", { method: "POST", body: "{}" }))).status).toBe(400);
    await esp32Route.PUT(req("/x?device_id=d1", { method: "PUT", body: "{}" }));
    expect(String(mockFetch.mock.calls.at(-1)![0])).toContain("/api/esp32/d1/config");
  });
});

describe("auth/activate route", () => {
  it("GET redirects: invalid token, db error, success", async () => {
    m.verifyToken.mockReturnValue(false);
    let res = await activateRoute.GET(req("/api/auth/activate?email=a@b.c&token=t"));
    expect(res.headers.get("location")).toBe("https://cloudless.gr/en/auth/signup?activated=invalid");

    m.verifyToken.mockReturnValue(true);
    m.getAuthDbFromEnv.mockReturnValue(null); // no db, no CF env → confirmUserD1 false
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    res = await activateRoute.GET(req("/api/auth/activate?email=a@b.c&token=t"));
    expect(res.headers.get("location")).toContain("activated=error");

    const db = { prepare: vi.fn() };
    m.getAuthDbFromEnv.mockReturnValue(db);
    m.markEmailVerified.mockResolvedValue(true);
    res = await activateRoute.GET(req("/api/auth/activate?email=a@b.c&token=t"));
    expect(res.headers.get("location")).toBe("https://cloudless.gr/en/auth/login?activated=1");
  });

  it("GET uses the HTTP-D1 fallback when no binding but CF env present", async () => {
    m.verifyToken.mockReturnValue(true);
    m.getAuthDbFromEnv.mockReturnValue(null);
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct";
    process.env.CLOUDFLARE_API_TOKEN = "tok";
    mockFetch.mockResolvedValueOnce(json({ success: true, result: [{ results: [], success: true, meta: { changes: 1 } }] }));
    m.markEmailVerified.mockImplementation(async (db: { prepare: (q: string) => { bind: () => { run: () => Promise<unknown> } } }) => {
      await db.prepare("UPDATE user SET x=1").bind().run();
      return true;
    });
    const res = await activateRoute.GET(req("/api/auth/activate?email=a@b.c&token=t"));
    expect(res.headers.get("location")).toContain("activated=1");
    expect(String(mockFetch.mock.calls[0][0])).toContain("api.cloudflare.com");
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
  });

  it("POST validates body, OTP, and confirms", async () => {
    expect((await activateRoute.POST(req("/x", { method: "POST", body: "bad" }))).status).toBe(400);
    expect((await activateRoute.POST(req("/x", { method: "POST", body: JSON.stringify({ email: "e@x.co" }) }))).status).toBe(400);

    m.verifyOtp.mockReturnValue(false);
    expect((await activateRoute.POST(req("/x", { method: "POST", body: JSON.stringify({ email: "e@x.co", otp: "1", token: "t" }) }))).status).toBe(400);

    m.verifyOtp.mockReturnValue(true);
    m.getAuthDbFromEnv.mockReturnValue(null);
    expect((await activateRoute.POST(req("/x", { method: "POST", body: JSON.stringify({ email: "e@x.co", otp: "1", token: "t" }) }))).status).toBe(503);

    m.getAuthDbFromEnv.mockReturnValue({ prepare: vi.fn() });
    m.markEmailVerified.mockResolvedValue(true);
    expect((await activateRoute.POST(req("/x", { method: "POST", body: JSON.stringify({ email: "e@x.co", otp: "1", token: "t" }) }))).status).toBe(200);
  });

  it("rate limit propagates 429", async () => {
    m.rateLimit.mockReturnValueOnce({ ok: false, response: new Response("rl", { status: 429 }) });
    expect((await activateRoute.GET(req("/x"))).status).toBe(429);
  });
});

describe("appflowy-faqs lib", () => {
  const views = [
    { view_id: "v1", name: "[FAQ] What?", layout: 0, last_edited_time: "2026-01-02" },
    { view_id: "v2", name: "[FAQ] How?", layout: 0, last_edited_time: "2026-01-01" },
    { view_id: "v3", name: "Not a faq", layout: 0, last_edited_time: "" },
  ];

  it("getFaqs returns [] unconfigured / no workspace; maps + sorts published faqs", async () => {
    m.afConfigured.mockResolvedValue(false);
    expect(await getFaqs()).toEqual([]);

    m.afConfigured.mockResolvedValue(true);
    m.afWorkspaces.mockResolvedValue([]);
    expect(await getFaqs()).toEqual([]);

    m.afWorkspaces.mockResolvedValue([{ workspace_id: "w1" }]);
    m.afViews.mockResolvedValue(views);
    m.afDoc.mockResolvedValue({});
    m.afText
      .mockResolvedValueOnce("**Answer**: A1\n**Published**: true\n**Order**: 2\n**Category**: pricing\n**Locale**: en")
      .mockResolvedValueOnce("**Answer**: A2\n**Published**: yes\n**Order**: 1\n**Locale**: el");
    const faqs = await getFaqs("en");
    expect(faqs).toHaveLength(1); // v2 is el-only
    expect(faqs[0].question).toBe("What?");
    expect(faqs[0].category).toBe("pricing");
    expect(faqs[0].order).toBe(2);

    // no locale filter → both, sorted by order
    m.afViews.mockResolvedValue(views);
    m.afText
      .mockResolvedValueOnce("**Answer**: A1\n**Published**: true\n**Order**: 2")
      .mockResolvedValueOnce("**Answer**: A2\n**Published**: true\n**Order**: 1");
    const all = await getFaqs();
    expect(all.map((f) => f.question)).toEqual(["How?", "What?"]);
  });

  it("doc failures degrade to empty markdown; unpublished filtered", async () => {
    m.afConfigured.mockResolvedValue(true);
    m.afWorkspaces.mockResolvedValue([{ workspace_id: "w" }]);
    m.afViews.mockResolvedValue(views.slice(0, 2));
    m.afDoc.mockRejectedValue(new Error("x"));
    m.afText.mockRejectedValue(new Error("x"));
    expect(await getFaqs()).toEqual([]); // published defaults false

    m.afViews.mockRejectedValueOnce(new Error("views down"));
    expect(await getFaqs()).toEqual([]);
  });

  it("getFaqsByCategory filters; getAllFaqsAdmin serves statics unconfigured", async () => {
    m.afConfigured.mockResolvedValue(true);
    m.afWorkspaces.mockResolvedValue([{ workspace_id: "w" }]);
    m.afViews.mockResolvedValue(views.slice(0, 2));
    m.afDoc.mockResolvedValue({});
    m.afText
      .mockResolvedValueOnce("**Published**: true\n**Category**: pricing")
      .mockResolvedValueOnce("**Published**: true\n**Category**: technical");
    expect((await getFaqsByCategory("pricing" as never)).map((f) => f.category)).toEqual(["pricing"]);

    m.afConfigured.mockResolvedValue(false);
    const admin = await getAllFaqsAdmin();
    expect(admin).toHaveLength(1);
    expect(admin[0].question).toBe("SQ");
    expect(admin[0].published).toBe(true);
  });

  it("getAllFaqsAdmin lists all + falls back to statics on error", async () => {
    m.afConfigured.mockResolvedValue(true);
    m.afWorkspaces.mockResolvedValue([{ workspace_id: "w" }]);
    m.afViews.mockResolvedValue(views.slice(0, 2));
    m.afDoc.mockResolvedValue({});
    m.afText.mockResolvedValue("**Answer**: A\n**Published**: false");
    const admin = await getAllFaqsAdmin();
    expect(admin).toHaveLength(2); // unpublished included

    m.afViews.mockRejectedValueOnce(new Error("down"));
    const fallback = await getAllFaqsAdmin();
    expect(fallback[0].question).toBe("SQ");
  });
});

// ── auth/register + appflowy-testimonials ────────────────────────────────────


vi.mock("@/lib/admin-notifications", () => ({ recordNotification: rm.recordNotification }));
vi.mock("@/lib/email", () => ({
  sendActivationEmail: rm.sendActivationEmail,
  notifyTeam: rm.notifyTeam,
}));
vi.mock("@/lib/slack-notify", () => ({ slackRegistrationNotify: rm.slackReg }));
vi.mock("@/lib/analytics", () => ({ trackAnalyticsEvent: rm.trackEvent }));
vi.mock("@/lib/d1-http", () => ({ isD1WriteLimitError: rm.isD1Limit }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstileToken: rm.verifyTurnstile }));

import * as registerRoute from "@/app/api/auth/register/route";
import { getTestimonials, getFeaturedTestimonials, getAllTestimonialsAdmin } from "@/lib/appflowy-testimonials";

describe("auth/register route", () => {
  const post = (body: unknown) =>
    registerRoute.POST(req("/x", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

  beforeEach(() => {
    rm.createUser.mockResolvedValue({ id: "u1" });
    rm.validateSecret.mockReturnValue({ valid: true });
    rm.validateStrength.mockReturnValue({ valid: true });
    rm.isD1Limit.mockReturnValue(false);
    rm.verifyTurnstile.mockResolvedValue({ ok: true });
    rm.sendActivationEmail.mockResolvedValue(undefined);
    rm.notifyTeam.mockResolvedValue(undefined);
    rm.slackReg.mockResolvedValue(undefined);
    rm.trackEvent.mockResolvedValue(undefined);
    m.getAuthDbFromEnv.mockReturnValue({ prepare: vi.fn() });
    m.rateLimit.mockReturnValue({ ok: true });
  });

  it("503s when no db anywhere; 400 bad body; 400 missing fields", async () => {
    m.getAuthDbFromEnv.mockReturnValue(null);
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    expect((await post({})).status).toBe(503);
    m.getAuthDbFromEnv.mockReturnValue({ prepare: vi.fn() }); // restore db for the rest

    expect((await post("not json")).status).toBe(400);
    expect((await post({ email: "e@x.co" })).status).toBe(400);
  });

  it("403 on turnstile failure; rate limits propagate", async () => {
    rm.verifyTurnstile.mockResolvedValue({ ok: false, error: "bot" });
    expect((await post({ email: "e@x.co", password: "p" })).status).toBe(403);

    rm.verifyTurnstile.mockResolvedValue({ ok: true });
    m.rateLimit.mockReturnValue({ ok: false, response: new Response("rl", { status: 429 }) });
    expect((await post({ email: "e@x.co", password: "p" }))).toMatchObject({ status: 429 });
  });

  it("400 weak password; 200-token on success with notifications", async () => {
    rm.validateStrength.mockReturnValue({ valid: false, error: "weak" });
    expect((await post({ email: "e@x.co", password: "p" }))).toMatchObject({ status: 400 });

    rm.validateStrength.mockReturnValue({ valid: true });
    const res = await post({ email: "e@x.co", password: "p", name: "Full Name" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.token).toBeTruthy();
    expect(rm.createUser).toHaveBeenCalledWith(expect.anything(), "e@x.co", "p", "Full Name");
    expect(rm.sendActivationEmail).toHaveBeenCalledWith("e@x.co", body.token);
    expect(rm.recordNotification).toHaveBeenCalledWith(expect.objectContaining({ title: "New user sign-up" }));
    expect(rm.slackReg).toHaveBeenCalledWith("e@x.co");
    expect(rm.notifyTeam).toHaveBeenCalled();
    expect(rm.trackEvent).toHaveBeenCalledWith(expect.objectContaining({ event: "signup", critical: true }));
  });

  it("hides existing-user enumeration; 500 other errors; 503 D1 write limit", async () => {
    rm.createUser.mockResolvedValue({ error: "User already exists" });
    const res = await post({ email: "e@x.co", password: "p" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    rm.createUser.mockResolvedValue({ error: "DB exploded" });
    expect((await post({ email: "e@x.co", password: "p" }))).toMatchObject({ status: 500 });

    rm.createUser.mockRejectedValue(new Error("limit"));
    rm.isD1Limit.mockReturnValue(true);
    expect((await post({ email: "e@x.co", password: "p" }))).toMatchObject({ status: 503 });

    rm.isD1Limit.mockReturnValue(false);
    expect((await post({ email: "e@x.co", password: "p" }))).toMatchObject({ status: 500 });
  });
});

describe("appflowy-testimonials lib", () => {
  const views = [
    { view_id: "t1", name: "[Testimonial] Jane", layout: 0, last_edited_time: "d" },
    { view_id: "t2", name: "[Testimonial] Bob", layout: 0, last_edited_time: "d" },
    { view_id: "x", name: "Other", layout: 0, last_edited_time: "" },
  ];

  beforeEach(() => {
    m.afConfigured.mockResolvedValue(true);
    m.afWorkspaces.mockResolvedValue([{ workspace_id: "w" }]);
    m.afViews.mockResolvedValue(views);
    m.afDoc.mockResolvedValue({});
  });

  it("maps fields, caps rating at 5, filters featured", async () => {
    m.afText
      .mockResolvedValueOnce("**Company**: Acme\n**Role**: CTO\n**Quote**: Great\n**Rating**: 9\n**Featured**: true\n**Avatar**: /a.png\n**Service**: Cloud")
      .mockResolvedValueOnce("**Quote**: Nice\n**Rating**: 0");
    const out = await getTestimonials();
    expect(out[0]).toMatchObject({ name: "Jane", company: "Acme", rating: 5, featured: true, avatar: "/a.png", service: "Cloud" });
    expect(out[1].rating).toBeUndefined();
    expect(out[1].featured).toBe(false);

    m.afText
      .mockResolvedValueOnce("**Featured**: yes")
      .mockResolvedValueOnce("plain quote text");
    const featured = await getFeaturedTestimonials();
    expect(featured).toHaveLength(1);
    expect(featured[0].name).toBe("Jane");
  });

  it("unconfigured/empty-workspace/doc-fail/list-fail paths", async () => {
    m.afConfigured.mockResolvedValue(false);
    expect(await getTestimonials()).toEqual([]);

    m.afConfigured.mockResolvedValue(true);
    m.afWorkspaces.mockResolvedValue([]);
    expect(await getTestimonials()).toEqual([]);

    m.afWorkspaces.mockResolvedValue([{ workspace_id: "w" }]);
    m.afDoc.mockRejectedValue(new Error("x"));
    m.afText.mockRejectedValue(new Error("x"));
    const out = await getTestimonials();
    expect(out[0].quote).toBe(""); // markdown empty → quote falls back to "" (empty markdown)

    m.afViews.mockRejectedValueOnce(new Error("down"));
    expect(await getTestimonials()).toEqual([]);
  });

  it("getAllTestimonialsAdmin: statics unconfigured, all listed otherwise", async () => {
    m.afConfigured.mockResolvedValue(false);
    expect(await getAllTestimonialsAdmin()).toHaveLength(1);
    m.afConfigured.mockResolvedValue(true);
    m.afText.mockResolvedValue("**Quote**: q");
    expect(await getAllTestimonialsAdmin()).toHaveLength(2);
    m.afViews.mockRejectedValueOnce(new Error("down"));
    expect((await getAllTestimonialsAdmin())[0].name).toBe("Static T");
  });
});


describe("esp32 route — LAN guard tails", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("GET + PUT return offline 404 when ALERT_API is a private LAN address", async () => {
    vi.stubEnv("ALERT_API_URL", "http://192.168.1.50:8080");
    vi.resetModules();
    const mod = await import("@/app/api/admin/esp32/route");
    const res = await mod.GET(req("/x?action=devices"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.offline).toBe(true);
    expect(data.error).toContain("not reachable");
    const put = await mod.PUT(req("/x?device_id=d1", { method: "PUT", body: "{}" }));
    expect(put.status).toBe(404);
    expect((await put.json()).offline).toBe(true);
    const post = await mod.POST(
      req("/x?action=command&device_id=d1", { method: "POST", body: "{}" })
    );
    expect(post.status).toBe(404);
    expect((await post.json()).offline).toBe(true);
  });

  it("malformed ALERT_API_URL is not treated as private — falls through to proxy", async () => {
    vi.stubEnv("ALERT_API_URL", ":::not-a-url");
    vi.resetModules();
    const mod = await import("@/app/api/admin/esp32/route");
    mockFetch.mockRejectedValueOnce(new Error("net"));
    const res = await mod.GET(req("/x?action=config&device_id=d1"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Pi unreachable");
  });
});
