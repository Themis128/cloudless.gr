/**
 * Tests for GET /api/admin/analytics, GET /api/admin/postiz/health and
 * POST /api/webhooks/n8n/trigger.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const apiAuth = vi.hoisted(() => ({ ok: true }));
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () =>
    apiAuth.ok
      ? { ok: true, user: { id: "u1" } }
      : { ok: false, response: NextResponse.json({ error: "no" }, { status: 401 }) }
  ),
}));

const cfg = vi.hoisted(() => ({ values: {} as Record<string, string> }));
vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn(async () => cfg.values),
}));

const apiErrors = vi.hoisted(() => ({ mapIntegrationError: vi.fn() }));
vi.mock("@/lib/api-errors", () => apiErrors);

const stripeLib = vi.hoisted(() => ({ getStripe: vi.fn() }));
vi.mock("@/lib/stripe", () => stripeLib);

const postiz = vi.hoisted(() => ({
  isPostizConfigured: vi.fn(),
  listIntegrations: vi.fn(),
}));
vi.mock("@/lib/postiz", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/postiz")>();
  return {
    ...actual,
    isPostizConfigured: postiz.isPostizConfigured,
    listIntegrations: postiz.listIntegrations,
  };
});

const n8n = vi.hoisted(() => ({ triggerWorkflowByWebhookPath: vi.fn() }));
vi.mock("@/lib/n8n", () => n8n);

import { GET as adminAnalytics } from "@/app/api/admin/analytics/route";
import { GET as postizHealth } from "@/app/api/admin/postiz/health/route";
import { POST as n8nTrigger } from "@/app/api/webhooks/n8n/trigger/route";

const ANALYTICS = "http://localhost/api/admin/analytics";
const HEALTH = "http://localhost/api/admin/postiz/health";
const TRIGGER = "http://localhost/api/webhooks/n8n/trigger";

describe("GET /api/admin/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    apiAuth.ok = true;
    cfg.values = {};
    apiErrors.mapIntegrationError.mockReturnValue(null);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("401s non-admin", async () => {
    apiAuth.ok = false;
    expect((await adminAnalytics(new NextRequest(ANALYTICS))).status).toBe(401);
  });

  it("returns zeros when nothing is configured", async () => {
    const j = await (await adminAnalytics(new NextRequest(ANALYTICS))).json();
    expect(j.web).toEqual({ pageViews: 0, uniqueVisitors: 0, topPages: [] });
    expect(j.commerce.totalRevenue).toBe(0);
    expect(j.seo.clicks).toBe(0);
    expect(j.fetchedAt).toBeTruthy();
  });

  it("fetches web analytics from CF when token+bucket set", async () => {
    cfg.values = { APPFLOWY_API_URL: "x" };
    vi.stubEnv("ANALYTICS_ENGINE_TOKEN", "tok");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acc");
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        totalCount: 42,
        uniqueVisitors: 9,
        topPages: [{ path: "/", views: 10 }],
      }),
    } as Response);
    const j = await (await adminAnalytics(new NextRequest(ANALYTICS))).json();
    expect(j.web).toEqual({
      pageViews: 42,
      uniqueVisitors: 9,
      topPages: [{ path: "/", views: 10 }],
    });
  });

  it("falls back to zeros when CF fetch fails or !ok", async () => {
    cfg.values = { APPFLOWY_API_URL: "x" };
    vi.stubEnv("ANALYTICS_ENGINE_TOKEN", "tok");
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    const j1 = await (await adminAnalytics(new NextRequest(ANALYTICS))).json();
    expect(j1.web.pageViews).toBe(0);

    vi.mocked(fetch).mockRejectedValue(new Error("net"));
    const j2 = await (await adminAnalytics(new NextRequest(ANALYTICS))).json();
    expect(j2.web.pageViews).toBe(0);
  });

  it("computes commerce from Stripe charges; zeros on failure", async () => {
    cfg.values = { STRIPE_SECRET_KEY: "sk" };
    stripeLib.getStripe.mockResolvedValue({
      charges: {
        list: vi.fn(async () => ({
          data: [{ amount: 1000 }, { amount: 2500 }, { amount: null }],
        })),
      },
    });
    const j = await (await adminAnalytics(new NextRequest(ANALYTICS))).json();
    expect(j.commerce.totalRevenue).toBe(35);
    expect(j.commerce.ordersCount).toBe(3);
    expect(j.commerce.conversionRate).toBeCloseTo(0.023);

    stripeLib.getStripe.mockResolvedValue(null);
    const j2 = await (await adminAnalytics(new NextRequest(ANALYTICS))).json();
    expect(j2.commerce.totalRevenue).toBe(0);

    stripeLib.getStripe.mockRejectedValue(new Error("stripe down"));
    const j3 = await (await adminAnalytics(new NextRequest(ANALYTICS))).json();
    expect(j3.commerce.totalRevenue).toBe(0);
  });
});

describe("GET /api/admin/postiz/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiAuth.ok = true;
    postiz.isPostizConfigured.mockResolvedValue(true);
    postiz.listIntegrations.mockResolvedValue([]);
  });

  it("401s non-admin", async () => {
    apiAuth.ok = false;
    expect((await postizHealth(new NextRequest(HEALTH))).status).toBe(401);
  });

  it("503s unconfigured (json + prom)", async () => {
    postiz.isPostizConfigured.mockResolvedValue(false);
    const res = await postizHealth(new NextRequest(HEALTH));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("postiz_not_configured");

    const prom = await postizHealth(new NextRequest(`${HEALTH}?format=prom`));
    expect(prom.status).toBe(200);
    const text = await prom.text();
    expect(text).toContain("postiz_up 0");
    expect(text).toContain("postiz_integrations_total 0");
  });

  it("reports integrations + disabled count (json + prom)", async () => {
    postiz.listIntegrations.mockResolvedValue([
      { id: "1" },
      { id: "2", disabled: true },
      { id: "3", disabled: true },
    ]);
    const j = await (await postizHealth(new NextRequest(HEALTH))).json();
    expect(j).toMatchObject({
      ok: true,
      configured: true,
      integrations: 3,
      disabled: 2,
    });
    expect(j.latencyMs).toBeTypeOf("number");

    const prom = await postizHealth(new NextRequest(`${HEALTH}?format=prom`));
    const text = await prom.text();
    expect(text).toContain("postiz_up 1");
    expect(text).toContain("postiz_integrations_disabled_total 2");
  });

  it("handles PostizNotConfiguredError thrown mid-flight", async () => {
    const { PostizNotConfiguredError } = await import("@/lib/postiz");
    postiz.listIntegrations.mockRejectedValue(new PostizNotConfiguredError("nope"));
    const res = await postizHealth(new NextRequest(HEALTH));
    expect(res.status).toBe(503);
    const prom = await postizHealth(new NextRequest(`${HEALTH}?format=prom`));
    expect(await prom.text()).toContain("postiz_up 0");
  });

  it("502s on PostizApiError; rethrows unexpected errors", async () => {
    const { PostizApiError } = await import("@/lib/postiz");
    postiz.listIntegrations.mockRejectedValue(
      new PostizApiError(500, "upstream broke")
    );
    const res = await postizHealth(new NextRequest(HEALTH));
    expect(res.status).toBe(502);
    const j = await res.json();
    expect(j.error).toBe("postiz_upstream");
    expect(j.status).toBe(500);

    const prom = await postizHealth(new NextRequest(`${HEALTH}?format=prom`));
    expect(await prom.text()).toContain("postiz_up 0");

    postiz.listIntegrations.mockRejectedValue(new Error("weird"));
    await expect(postizHealth(new NextRequest(HEALTH))).rejects.toThrow("weird");
  });
});

describe("POST /api/webhooks/n8n/trigger", () => {
  const trigger = (body: unknown, secret = "shared-secret") =>
    n8nTrigger(
      new NextRequest(TRIGGER, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(secret ? { "x-n8n-trigger-secret": secret } : {}),
        },
        body: typeof body === "string" ? body : JSON.stringify(body),
      })
    );

  beforeEach(() => {
    vi.clearAllMocks();
    cfg.values = {
      NOTION_WEBHOOK_SECRET: "shared-secret",
      N8N_WORKFLOW_LEAD_ENRICH_ID: "wf-lead",
      N8N_WORKFLOW_NEWSLETTER_NURTURE_ID: "",
    };
    n8n.triggerWorkflowByWebhookPath.mockResolvedValue({ executionId: "e1" });
  });

  it("401s without/with-wrong/with-missing secret", async () => {
    expect((await trigger({}, "wrong-len")).status).toBe(401);
    expect((await trigger({}, "")).status).toBe(401);
    cfg.values.NOTION_WEBHOOK_SECRET = "";
    expect((await trigger({})).status).toBe(401);
  });

  it("400s on invalid JSON and unknown alias", async () => {
    expect((await trigger("{bad")).status).toBe(400);
    const j = await (
      await trigger({ name: "does-not-exist" })
    ).json();
    expect(j.error).toContain("unknown workflow alias");
  });

  it("204s when no workflow ID resolves", async () => {
    const res = await trigger({});
    expect(res.status).toBe(204);
    const res2 = await trigger({ name: "newsletter-nurture" });
    expect(res2.status).toBe(204);
  });

  it("resolves name aliases via SSM and triggers", async () => {
    const j = await (
      await trigger({ name: "lead-enrich", payload: { lead: 1 } })
    ).json();
    expect(j.ok).toBe(true);
    expect(n8n.triggerWorkflowByWebhookPath).toHaveBeenCalledWith("wf-lead", {
      lead: 1,
    });

    await trigger({ workflowId: "wf-direct" });
    expect(n8n.triggerWorkflowByWebhookPath).toHaveBeenCalledWith("wf-direct", {});
  });

  it("503s on not-configured, 502s on upstream failure", async () => {
    n8n.triggerWorkflowByWebhookPath.mockRejectedValue(
      new Error("n8n not configured")
    );
    expect((await trigger({ workflowId: "w" })).status).toBe(503);

    n8n.triggerWorkflowByWebhookPath.mockRejectedValue(new Error("500 crash"));
    expect((await trigger({ workflowId: "w" })).status).toBe(502);
  });
});
