/**
 * Tests for /api/admin/n8n/{health,workflows,executions,workflows/[id]/trigger}
 * and /api/admin/insights{,/[domain],/refresh}.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const apiAuth = vi.hoisted(() => ({ ok: true, user: { email: "a@b" } }));
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () =>
    apiAuth.ok
      ? { ok: true, user: apiAuth.user }
      : { ok: false, response: NextResponse.json({ error: "no" }, { status: 401 }) }
  ),
}));

const n8n = vi.hoisted(() => ({
  isN8nConfigured: vi.fn(),
  pingN8nHealth: vi.fn(),
  listWorkflows: vi.fn(),
  listRecentExecutions: vi.fn(),
  triggerWorkflowByWebhookPath: vi.fn(),
}));
vi.mock("@/lib/n8n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/n8n")>();
  return { ...actual, ...n8n };
});

const lake = vi.hoisted(() => ({
  listInsightDomains: vi.fn(),
  getInsight: vi.fn(),
}));
vi.mock("@/lib/datalake-serve", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/datalake-serve")>();
  return { ...actual, ...lake };
});

const notifications = vi.hoisted(() => ({ recordNotification: vi.fn() }));
vi.mock("@/lib/admin-notifications", () => notifications);

import { GET as healthGet } from "@/app/api/admin/n8n/health/route";
import { GET as workflowsGet } from "@/app/api/admin/n8n/workflows/route";
import { GET as executionsGet } from "@/app/api/admin/n8n/executions/route";
import { POST as triggerPost } from "@/app/api/admin/n8n/workflows/[id]/trigger/route";
import { GET as insightsGet } from "@/app/api/admin/insights/route";
import { GET as domainGet } from "@/app/api/admin/insights/[domain]/route";
import { POST as refreshPost } from "@/app/api/admin/insights/refresh/route";

const N = "http://localhost/api/admin/n8n";
const I = "http://localhost/api/admin/insights";

beforeEach(() => {
  vi.clearAllMocks();
  apiAuth.ok = true;
});

describe("n8n routes", () => {
  it("health: 503 unconfigured; aggregates health + counts", async () => {
    n8n.isN8nConfigured.mockResolvedValue(false);
    expect((await healthGet(new NextRequest(`${N}/health`))).status).toBe(503);

    n8n.isN8nConfigured.mockResolvedValue(true);
    n8n.pingN8nHealth.mockResolvedValue(true);
    n8n.listWorkflows.mockResolvedValue([
      { active: true },
      { active: false },
      { active: true },
    ]);
    n8n.listRecentExecutions.mockResolvedValue([
      { status: "error" },
      { status: "running" },
      { status: "success" },
    ]);
    const j = await (await healthGet(new NextRequest(`${N}/health`))).json();
    expect(j).toMatchObject({
      ok: true,
      configured: true,
      workflows: { total: 3, active: 2 },
      executions: { recent: 3, errors: 1, running: 1 },
    });

    // upstream failures degrade to empty arrays
    n8n.listWorkflows.mockRejectedValue(new Error("n8n down"));
    n8n.listRecentExecutions.mockRejectedValue(new Error("n8n down"));
    const j2 = await (await healthGet(new NextRequest(`${N}/health`))).json();
    expect(j2.workflows).toEqual({ total: 0, active: 0 });
  });

  it("workflows: 503, activeOnly filter flag", async () => {
    n8n.isN8nConfigured.mockResolvedValue(false);
    expect((await workflowsGet(new NextRequest(`${N}/workflows`))).status).toBe(
      503
    );

    n8n.isN8nConfigured.mockResolvedValue(true);
    n8n.listWorkflows.mockResolvedValue([{ id: "w" }]);
    const j = await (
      await workflowsGet(new NextRequest(`${N}/workflows?active=true`))
    ).json();
    expect(j.workflows).toHaveLength(1);
    expect(n8n.listWorkflows).toHaveBeenCalledWith(true);

    await workflowsGet(new NextRequest(`${N}/workflows`));
    expect(n8n.listWorkflows).toHaveBeenLastCalledWith(false);
  });

  it("executions: clamps limit to [1,250]", async () => {
    n8n.isN8nConfigured.mockResolvedValue(true);
    n8n.listRecentExecutions.mockResolvedValue([]);
    await executionsGet(new NextRequest(`${N}/executions?limit=999`));
    expect(n8n.listRecentExecutions).toHaveBeenCalledWith(250);
    await executionsGet(new NextRequest(`${N}/executions`));
    expect(n8n.listRecentExecutions).toHaveBeenLastCalledWith(50);
  });

  it("trigger: forwards payload, tolerates empty body, maps N8nApiError", async () => {
    n8n.isN8nConfigured.mockResolvedValue(true);
    n8n.triggerWorkflowByWebhookPath.mockResolvedValue({ runId: 1 });

    const j = await (
      await triggerPost(
        new NextRequest(`${N}/workflows/w1/trigger`, {
          method: "POST",
          body: JSON.stringify({ input: "x" }),
          headers: { "content-type": "application/json" },
        }),
        { params: Promise.resolve({ id: "w1" }) }
      )
    ).json();
    expect(j.ok).toBe(true);
    expect(n8n.triggerWorkflowByWebhookPath).toHaveBeenCalledWith("w1", {
      input: "x",
    });

    // no body → empty payload
    await triggerPost(
      new NextRequest(`${N}/workflows/w1/trigger`, { method: "POST" }),
      { params: Promise.resolve({ id: "w1" }) }
    );
    expect(n8n.triggerWorkflowByWebhookPath).toHaveBeenLastCalledWith("w1", {});

    const { N8nApiError } = await import("@/lib/n8n");
    n8n.triggerWorkflowByWebhookPath.mockRejectedValue(
      new N8nApiError(500, "boom")
    );
    expect(
      (
        await triggerPost(
          new NextRequest(`${N}/workflows/w1/trigger`, { method: "POST" }),
          { params: Promise.resolve({ id: "w1" }) }
        )
      ).status
    ).toBe(502);

    // Non-N8nApiError propagates (the route rethrows unknown failures)
    n8n.triggerWorkflowByWebhookPath.mockRejectedValue(new Error("socket hangup"));
    await expect(
      triggerPost(
        new NextRequest(`${N}/workflows/w1/trigger`, { method: "POST" }),
        { params: Promise.resolve({ id: "w1" }) }
      )
    ).rejects.toThrow("socket hangup");

    n8n.isN8nConfigured.mockResolvedValue(false);
    expect(
      (
        await triggerPost(
          new NextRequest(`${N}/workflows/w1/trigger`, { method: "POST" }),
          { params: Promise.resolve({ id: "w1" }) }
        )
      ).status
    ).toBe(503);

    // Non-N8nApiError propagates to the framework (unhandled)
    n8n.isN8nConfigured.mockResolvedValue(true);
    n8n.triggerWorkflowByWebhookPath.mockRejectedValue(new Error("worker crash"));
    await expect(
      triggerPost(new NextRequest(`${N}/workflows/w1/trigger`, { method: "POST" }), {
        params: Promise.resolve({ id: "w1" }),
      })
    ).rejects.toThrow("worker crash");
  });
});

describe("insights routes", () => {
  it("list: domains index passthrough", async () => {
    lake.listInsightDomains.mockResolvedValue({ domains: ["seo"] });
    const j = await (await insightsGet(new NextRequest(I))).json();
    expect(j).toEqual({
      cache: "cloudflare",
      source: "datalake-gold",
      domains: ["seo"],
    });
  });

  it("[domain]: allowlist check, missing insight → stub 200, hit → spread", async () => {
    const bad = await domainGet(new NextRequest(`${I}/bogus`), {
      params: Promise.resolve({ domain: "bogus" }),
    });
    expect(bad.status).toBe(400);

    lake.getInsight.mockResolvedValue(null);
    const j = await (
      await domainGet(new NextRequest(`${I}/seo`), {
        params: Promise.resolve({ domain: "seo" }),
      })
    ).json();
    expect(j.domain).toBe("seo");
    expect(j.error).toContain("not available");

    lake.getInsight.mockResolvedValue({
      summary: "s",
      bullets: ["b"],
      generated_at: "t",
    });
    const j2 = await (
      await domainGet(new NextRequest(`${I}/seo`), {
        params: Promise.resolve({ domain: "seo" }),
      })
    ).json();
    expect(j2).toMatchObject({ summary: "s", source: "datalake-gold" });
    expect(lake.getInsight).toHaveBeenCalledWith("seo");
  });

  it("refresh: records + calls hook when configured", async () => {
    vi.stubGlobal("fetch", vi.fn());

    // no hook → skipped
    vi.unstubAllEnvs();
    const j = await (
      await refreshPost(new NextRequest(`${I}/refresh`, { method: "POST" }))
    ).json();
    expect(j.hookStatus).toBe("skipped");
    expect(notifications.recordNotification).toHaveBeenCalledWith(
      expect.objectContaining({ actor: "a@b" })
    );

    // hook ok / failed
    vi.stubEnv("INSIGHTS_REFRESH_HOOK_URL", "https://hook.example.com");
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);
    const j2 = await (
      await refreshPost(new NextRequest(`${I}/refresh`, { method: "POST" }))
    ).json();
    expect(j2.hookStatus).toBe("ok");
    expect(j2.message).toContain("accepted");

    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    expect(
      (
        await (
          await refreshPost(
            new NextRequest(`${I}/refresh`, { method: "POST" })
          )
        ).json()
      ).hookStatus
    ).toBe("failed");

    vi.mocked(fetch).mockRejectedValue(new Error("net"));
    expect(
      (
        await (
          await refreshPost(
            new NextRequest(`${I}/refresh`, { method: "POST" })
          )
        ).json()
      ).hookStatus
    ).toBe("failed");
  });
});
