/**
 * Tests for the /api/admin/postiz/* route cluster: integrations (+[id],
 * connect, settings, trigger), is-connected, groups, notifications,
 * posts/[id] (+status, missing-content, release-id), analytics post +
 * integration.
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

const postiz = vi.hoisted(() => ({
  deleteIntegration: vi.fn(),
  isApiKeyValid: vi.fn(),
  listGroups: vi.fn(),
  listNotifications: vi.fn(),
  getIntegrationConnectUrl: vi.fn(),
  getIntegrationSettings: vi.fn(),
  triggerIntegrationTool: vi.fn(),
  changePostStatus: vi.fn(),
  getPostMissingContent: vi.fn(),
  updatePostReleaseId: vi.fn(),
  getPostStats: vi.fn(),
  deletePostsByGroup: vi.fn(),
  getIntegrationAnalytics: vi.fn(),
  listPostizIntegrations: vi.fn(),
  listPosts: vi.fn(),
}));
vi.mock("@/lib/postiz", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/postiz")>();
  return { ...actual, ...postiz };
});

const sa = vi.hoisted(() => ({
  listAccountsAsIntegrations: vi.fn(),
  getChannelAnalytics: vi.fn(),
  deletePostById: vi.fn(),
  updatePostFromBody: vi.fn(),
  createPostFromBody: vi.fn(),
  uploadFileToSocialAuto: vi.fn(),
}));
vi.mock("@/lib/socialauto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/socialauto")>();
  return { ...actual, ...sa };
});

const n8n = vi.hoisted(() => ({
  isN8nConfigured: vi.fn(),
  listRecentExecutions: vi.fn(),
}));
vi.mock("@/lib/n8n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/n8n")>();
  return { ...actual, ...n8n };
});

import { GET as integrationsGet } from "@/app/api/admin/postiz/integrations/route";
import { DELETE as integrationDelete } from "@/app/api/admin/postiz/integrations/[id]/route";
import { GET as connectGet } from "@/app/api/admin/postiz/integrations/[id]/connect/route";
import { GET as settingsGet } from "@/app/api/admin/postiz/integrations/[id]/settings/route";
import { POST as triggerPost } from "@/app/api/admin/postiz/integrations/[id]/trigger/route";
import { GET as isConnectedGet } from "@/app/api/admin/postiz/is-connected/route";
import { GET as groupsGet } from "@/app/api/admin/postiz/groups/route";
import { GET as notificationsGet } from "@/app/api/admin/postiz/notifications/route";
import { DELETE as postDelete, PUT as postPut } from "@/app/api/admin/postiz/posts/[id]/route";
import { PUT as statusPut } from "@/app/api/admin/postiz/posts/[id]/status/route";
import { GET as missingGet } from "@/app/api/admin/postiz/posts/[id]/missing-content/route";
import { PUT as releasePut } from "@/app/api/admin/postiz/posts/[id]/release-id/route";
import { GET as postStatsGet } from "@/app/api/admin/postiz/analytics/post/[id]/route";
import { GET as channelStatsGet } from "@/app/api/admin/postiz/analytics/integration/[id]/route";
import { GET as summaryGet } from "@/app/api/admin/postiz/analytics/summary/route";
import { DELETE as groupDelete } from "@/app/api/admin/postiz/posts/group/[id]/route";
import { POST as bulkPost } from "@/app/api/admin/postiz/posts/bulk/route";
import { POST as uploadPost } from "@/app/api/admin/postiz/upload-file/route";
import { GET as n8nExecGet } from "@/app/api/admin/n8n/executions/route";

const P = "http://localhost/api/admin/postiz";
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (url: string, init?: RequestInit) => new NextRequest(url, { method: "GET", ...init });
const post = (url: string, body: unknown, method = "POST") =>
  new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

let PostizApiError: typeof import("@/lib/postiz").PostizApiError;
let PostizNotConfiguredError: typeof import("@/lib/postiz").PostizNotConfiguredError;

beforeEach(async () => {
  vi.clearAllMocks();
  apiAuth.ok = true;
  ({ PostizApiError, PostizNotConfiguredError } = await import("@/lib/postiz"));
});

describe("saAdminRoute-backed routes", () => {
  it("integrations GET: 401 non-admin, lists, maps SA errors", async () => {
    apiAuth.ok = false;
    expect((await integrationsGet(req(`${P}/integrations`), ctx(""))).status).toBe(401);
    apiAuth.ok = true;

    sa.listAccountsAsIntegrations.mockResolvedValue([{ id: "i1" }]);
    const j = await (await integrationsGet(req(`${P}/integrations`), ctx(""))).json();
    expect(j.integrations).toEqual([{ id: "i1" }]);

    const { SocialAutoApiError, SocialAutoNotConfiguredError } = await import("@/lib/socialauto");
    sa.listAccountsAsIntegrations.mockRejectedValue(new SocialAutoApiError(429, "slow"));
    expect((await integrationsGet(req(`${P}/integrations`), ctx(""))).status).toBe(429);
    sa.listAccountsAsIntegrations.mockRejectedValue(new SocialAutoNotConfiguredError());
    expect((await integrationsGet(req(`${P}/integrations`), ctx(""))).status).toBe(503);
  });

  it("channel analytics: missing id 400, lookback, metrics", async () => {
    sa.getChannelAnalytics.mockResolvedValue({ views: 10 });
    const j = await (
      await channelStatsGet(req(`${P}/analytics/integration/i1?date=30`), ctx("i1"))
    ).json();
    expect(j).toEqual({ metrics: { views: 10 }, lookbackDays: 30 });
    expect(sa.getChannelAnalytics).toHaveBeenCalledWith("i1", 30);
  });

  it("posts/[id] DELETE + PUT", async () => {
    sa.deletePostById.mockResolvedValue(undefined);
    const j = await (
      await postDelete(new NextRequest(`${P}/posts/p1`, { method: "DELETE" }), ctx("p1"))
    ).json();
    expect(j.deleted).toBe(true);

    sa.updatePostFromBody.mockResolvedValue({ ok: true });
    const res = await postPut(
      post(`${P}/posts/p1`, { type: "schedule", posts: [{}] }, "PUT"),
      ctx("p1")
    );
    expect((await res.json()).result).toEqual({ ok: true });
    expect(sa.updatePostFromBody).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ type: "schedule" })
    );

    // invalid payload → 400 via real readCreateBody
    expect((await postPut(post(`${P}/posts/p1`, {}, "PUT"), ctx("p1"))).status).toBe(400);
    expect((await postPut(post(`${P}/posts/p1`, "{bad", "PUT"), ctx("p1"))).status).toBe(400);
  });
});

describe("integration [id] routes", () => {
  it("DELETE: missing id, delete, 404-idempotent, NotConfigured, upstream", async () => {
    postiz.deleteIntegration.mockResolvedValue(undefined);
    const j = await (
      await integrationDelete(
        new NextRequest(`${P}/integrations/i1`, { method: "DELETE" }),
        ctx("i1")
      )
    ).json();
    expect(j.deleted).toBe(true);

    postiz.deleteIntegration.mockRejectedValue(new PostizApiError(404, "gone"));
    const j2 = await (
      await integrationDelete(
        new NextRequest(`${P}/integrations/i1`, { method: "DELETE" }),
        ctx("i1")
      )
    ).json();
    expect(j2.deleted).toBe(true); // idempotent

    postiz.deleteIntegration.mockRejectedValue(new PostizApiError(500, "down"));
    expect(
      (
        await integrationDelete(
          new NextRequest(`${P}/integrations/i1`, { method: "DELETE" }),
          ctx("i1")
        )
      ).status
    ).toBe(502);

    postiz.deleteIntegration.mockRejectedValue(new PostizNotConfiguredError());
    expect(
      (
        await integrationDelete(
          new NextRequest(`${P}/integrations/i1`, { method: "DELETE" }),
          ctx("i1")
        )
      ).status
    ).toBe(503);
  });

  it("connect GET: provider → oauth url + errors", async () => {
    postiz.getIntegrationConnectUrl.mockResolvedValue({ url: "https://oauth" });
    const j = await (
      await connectGet(req(`${P}/integrations/linkedin/connect`), ctx("linkedin"))
    ).json();
    expect(j.url).toBe("https://oauth");

    postiz.getIntegrationConnectUrl.mockRejectedValue(new PostizNotConfiguredError());
    expect((await connectGet(req(`${P}/integrations/x/connect`), ctx("x"))).status).toBe(503);

    postiz.getIntegrationConnectUrl.mockRejectedValue(new PostizApiError(400, "bad provider"));
    expect((await connectGet(req(`${P}/integrations/x/connect`), ctx("x"))).status).toBe(502);
  });

  it("settings GET + trigger POST", async () => {
    postiz.getIntegrationSettings.mockResolvedValue({ maxLength: 3000 });
    const j = await (await settingsGet(req(`${P}/integrations/i1/settings`), ctx("i1"))).json();
    expect(j.maxLength).toBe(3000);

    expect(
      (await triggerPost(post(`${P}/integrations/i1/trigger`, "{bad"), ctx("i1"))).status
    ).toBe(400);
    expect((await triggerPost(post(`${P}/integrations/i1/trigger`, {}), ctx("i1"))).status).toBe(
      400
    );

    postiz.triggerIntegrationTool.mockResolvedValue({ channels: ["c1"] });
    const j2 = await (
      await triggerPost(
        post(`${P}/integrations/i1/trigger`, { tool: "list_channels", data: { a: 1 } }),
        ctx("i1")
      )
    ).json();
    expect(j2.channels).toEqual(["c1"]);
    expect(postiz.triggerIntegrationTool).toHaveBeenCalledWith("i1", {
      tool: "list_channels",
      data: { a: 1 },
    });

    postiz.triggerIntegrationTool.mockRejectedValue(new PostizNotConfiguredError());
    expect(
      (await triggerPost(post(`${P}/integrations/i1/trigger`, { tool: "t" }), ctx("i1"))).status
    ).toBe(503);
  });

  it("trigger maps PostizApiError to 502 and rethrows unknown errors", async () => {
    postiz.triggerIntegrationTool.mockRejectedValue(new PostizApiError(429, "rate limited"));
    const res = await triggerPost(post(`${P}/integrations/i1/trigger`, { tool: "t" }), ctx("i1"));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("postiz_upstream");
    expect(body.status).toBe(429);

    postiz.triggerIntegrationTool.mockRejectedValue(new TypeError("boom"));
    await expect(
      triggerPost(post(`${P}/integrations/i1/trigger`, { tool: "t" }), ctx("i1"))
    ).rejects.toThrow(TypeError);
  });
});

describe("is-connected / groups / notifications", () => {
  it("is-connected: valid, not-configured 503, bad-key 401, upstream 502, network 503", async () => {
    postiz.isApiKeyValid.mockResolvedValue({ connected: true });
    expect((await (await isConnectedGet(req(`${P}/is-connected`))).json()).connected).toBe(true);

    postiz.isApiKeyValid.mockRejectedValue(new PostizNotConfiguredError());
    expect((await isConnectedGet(req(`${P}/is-connected`))).status).toBe(503);

    postiz.isApiKeyValid.mockRejectedValue(new PostizApiError(401, "bad key"));
    const j = await (await isConnectedGet(req(`${P}/is-connected`))).json();
    expect(j).toEqual({ connected: false, error: "invalid_api_key" });

    postiz.isApiKeyValid.mockRejectedValue(new PostizApiError(500, "x"));
    expect((await isConnectedGet(req(`${P}/is-connected`))).status).toBe(502);

    postiz.isApiKeyValid.mockRejectedValue(new Error("ENOTFOUND"));
    const res = await isConnectedGet(req(`${P}/is-connected`));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("postiz_unreachable");
  });

  it("groups: list + hint ladder; notifications: page param + errors", async () => {
    postiz.listGroups.mockResolvedValue([{ name: "g" }]);
    const j = await (await groupsGet(req(`${P}/groups`))).json();
    expect(j.groups).toEqual([{ name: "g" }]);

    postiz.listGroups.mockRejectedValue(new PostizApiError(500, "x"));
    const j2 = await (await groupsGet(req(`${P}/groups`))).json();
    expect(j2.hint).toContain("pod likely down");

    postiz.listGroups.mockRejectedValue(new PostizApiError(403, "x"));
    const j3 = await (await groupsGet(req(`${P}/groups`))).json();
    expect(j3.hint).toContain("API key rejected");

    postiz.listGroups.mockRejectedValue(new PostizApiError(404, "x"));
    const j4 = await (await groupsGet(req(`${P}/groups`))).json();
    expect(j4.hint).toContain("non-2xx");

    postiz.listGroups.mockRejectedValue(new PostizNotConfiguredError());
    expect((await groupsGet(req(`${P}/groups`))).status).toBe(503);

    postiz.listGroups.mockRejectedValue(new Error("net"));
    expect((await groupsGet(req(`${P}/groups`))).status).toBe(404);

    postiz.listNotifications.mockResolvedValue([{ id: "n1" }]);
    const j5 = await (await notificationsGet(req(`${P}/notifications?page=3`))).json();
    expect(j5).toEqual({ items: [{ id: "n1" }], page: 3 });
    expect(postiz.listNotifications).toHaveBeenCalledWith(3);

    // invalid/negative page → 1
    await notificationsGet(req(`${P}/notifications?page=-2`));
    expect(postiz.listNotifications).toHaveBeenLastCalledWith(1);

    postiz.listNotifications.mockRejectedValue(new PostizApiError(500, "x"));
    expect((await notificationsGet(req(`${P}/notifications`))).status).toBe(502);
  });
});

describe("posts/[id] variants", () => {
  it("status PUT: validation + changePostStatus + 400-passthrough", async () => {
    expect((await statusPut(post(`${P}/posts/p1/status`, "{bad", "PUT"), ctx("p1"))).status).toBe(
      400
    );
    expect(
      (await statusPut(post(`${P}/posts/p1/status`, { status: "nope" }, "PUT"), ctx("p1"))).status
    ).toBe(400);

    postiz.changePostStatus.mockResolvedValue({ ok: true });
    const j = await (
      await statusPut(post(`${P}/posts/p1/status`, { status: "draft" }, "PUT"), ctx("p1"))
    ).json();
    expect(j.ok).toBe(true);
    expect(postiz.changePostStatus).toHaveBeenCalledWith("p1", "draft");

    postiz.changePostStatus.mockRejectedValue(new PostizApiError(400, "x"));
    expect(
      (await statusPut(post(`${P}/posts/p1/status`, { status: "draft" }, "PUT"), ctx("p1"))).status
    ).toBe(400);

    postiz.changePostStatus.mockRejectedValue(new PostizApiError(500, "x"));
    expect(
      (await statusPut(post(`${P}/posts/p1/status`, { status: "draft" }, "PUT"), ctx("p1"))).status
    ).toBe(502);

    postiz.changePostStatus.mockRejectedValue(new PostizNotConfiguredError());
    expect(
      (await statusPut(post(`${P}/posts/p1/status`, { status: "draft" }, "PUT"), ctx("p1"))).status
    ).toBe(503);
  });

  it("missing-content GET + release-id PUT", async () => {
    postiz.getPostMissingContent.mockResolvedValue([{ id: "c1" }]);
    const j = await (await missingGet(req(`${P}/posts/p1/missing-content`), ctx("p1"))).json();
    expect(j.items).toEqual([{ id: "c1" }]);

    postiz.getPostMissingContent.mockRejectedValue(new PostizNotConfiguredError());
    expect((await missingGet(req(`${P}/posts/p1/missing-content`), ctx("p1"))).status).toBe(503);

    expect(
      (await releasePut(post(`${P}/posts/p1/release-id`, "{bad", "PUT"), ctx("p1"))).status
    ).toBe(400);
    expect(
      (await releasePut(post(`${P}/posts/p1/release-id`, { releaseId: 42 }, "PUT"), ctx("p1")))
        .status
    ).toBe(400);

    postiz.updatePostReleaseId.mockResolvedValue({ linked: true });
    const j2 = await (
      await releasePut(post(`${P}/posts/p1/release-id`, { releaseId: "abc" }, "PUT"), ctx("p1"))
    ).json();
    expect(j2.linked).toBe(true);
    expect(postiz.updatePostReleaseId).toHaveBeenCalledWith("p1", "abc");
  });

  it("post stats GET: lookback allowlist + metrics", async () => {
    postiz.getPostStats.mockResolvedValue({ clicks: 3 });
    const j = await (await postStatsGet(req(`${P}/analytics/post/p1?date=90`), ctx("p1"))).json();
    expect(j).toEqual({ metrics: { clicks: 3 }, lookbackDays: 90 });
    expect(postiz.getPostStats).toHaveBeenCalledWith("p1", 90);

    // non-allowlisted → default 7
    await postStatsGet(req(`${P}/analytics/post/p1?date=15`), ctx("p1"));
    expect(postiz.getPostStats).toHaveBeenLastCalledWith("p1", 7);

    postiz.getPostStats.mockRejectedValue(new PostizApiError(502, "x"));
    expect((await postStatsGet(req(`${P}/analytics/post/p1`), ctx("p1"))).status).toBe(502);
  });
});

describe("residual error-mapping tails", () => {
  it("postiz routes rethrow unknown errors and map the typed ones", async () => {
    // integrations/[id] DELETE — generic throw propagates
    postiz.deleteIntegration.mockRejectedValue(new TypeError("boom"));
    await expect(
      integrationDelete(req(`${P}/integrations/i1`, { method: "DELETE" }), ctx("i1"))
    ).rejects.toThrow(TypeError);

    // integrations/[id]/connect — generic throw propagates
    postiz.getIntegrationConnectUrl.mockRejectedValue(new TypeError("boom"));
    await expect(connectGet(req(`${P}/integrations/x/connect`), ctx("x"))).rejects.toThrow(
      TypeError
    );

    // notifications — not-configured → 503, generic → rethrow
    postiz.listNotifications.mockRejectedValue(new PostizNotConfiguredError());
    expect((await notificationsGet(req(`${P}/notifications`))).status).toBe(503);
    postiz.listNotifications.mockRejectedValue(new TypeError("boom"));
    await expect(notificationsGet(req(`${P}/notifications`))).rejects.toThrow(TypeError);

    // analytics/post/[id] — not-configured → 503, generic → rethrow
    postiz.getPostStats.mockRejectedValue(new PostizNotConfiguredError());
    expect((await postStatsGet(req(`${P}/analytics/post/p1`), ctx("p1"))).status).toBe(503);
    postiz.getPostStats.mockRejectedValue(new TypeError("boom"));
    await expect(postStatsGet(req(`${P}/analytics/post/p1`), ctx("p1"))).rejects.toThrow(TypeError);

    // posts/[id]/status — generic → rethrow
    postiz.changePostStatus.mockRejectedValue(new TypeError("boom"));
    await expect(
      statusPut(post(`${P}/posts/p1/status`, { status: "draft" }, "PUT"), ctx("p1"))
    ).rejects.toThrow(TypeError);

    // posts/group/[id] — generic → rethrow
    postiz.deletePostsByGroup.mockRejectedValue(new TypeError("boom"));
    await expect(
      groupDelete(req(`${P}/posts/group/g1`, { method: "DELETE" }), ctx("g1"))
    ).rejects.toThrow(TypeError);

    // analytics/summary — upstream throw propagates
    postiz.listPostizIntegrations.mockRejectedValue(new TypeError("boom"));
    await expect(summaryGet(req(`${P}/analytics/summary`))).rejects.toThrow(TypeError);
  });

  it("posts/bulk uses String(err) for non-Error rejections", async () => {
    sa.createPostFromBody.mockRejectedValue({ code: "E_X" });
    const res = await bulkPost(
      post(`${P}/posts/bulk`, {
        items: [{ type: "schedule", posts: [{ integration: "i1", content: "c" }] }],
      })
    );
    const j = await res.json();
    expect(j.results[0].ok).toBe(false);
    expect(j.results[0].error).toBe("[object Object]");
  });

  it("upload-file returns invalid_multipart when formData() throws", async () => {
    const res = await uploadPost(post(`${P}/upload-file`, { not: "multipart" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_multipart");
  });

  it("n8n executions → 503 when not configured", async () => {
    n8n.isN8nConfigured.mockResolvedValue(false);
    expect((await n8nExecGet(req("http://localhost/api/admin/n8n/executions"))).status).toBe(503);
  });
});
