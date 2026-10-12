/**
 * Tests for GET/POST /api/admin/users, GET /api/cron/gsc-cache-refresh and
 * GET /api/cron/consultation-reminder.
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

const authD1 = vi.hoisted(() => ({
  getAuthDbFromEnv: vi.fn(),
  listUsers: vi.fn(),
  setUserAdminRole: vi.fn(),
  setUserDisabled: vi.fn(),
}));
vi.mock("@/lib/auth-d1", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-d1")>();
  return {
    ...actual,
    getAuthDbFromEnv: authD1.getAuthDbFromEnv,
    listUsers: authD1.listUsers,
    setUserAdminRole: authD1.setUserAdminRole,
    setUserDisabled: authD1.setUserDisabled,
  };
});

const ssm = vi.hoisted(() => ({ getConfig: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ssm);

const gscCache = vi.hoisted(() => ({ readThrough: vi.fn() }));
vi.mock("@/lib/gsc-cache", () => gscCache);

const gsc = vi.hoisted(() => ({
  getSeoSnapshot: vi.fn(),
  getTopKeywords: vi.fn(),
  getTopPages: vi.fn(),
  getWebAnalytics: vi.fn(),
}));
vi.mock("@/lib/gsc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gsc")>();
  return { ...actual, ...gsc };
});

const cronAuth = vi.hoisted(() => ({
  authorized: true,
  isCronAuthorized: vi.fn(async () => cronAuth.authorized),
  cronUnauthorized: vi.fn(
    () => new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  ),
}));
vi.mock("@/lib/cron-auth", () => ({
  isCronAuthorized: cronAuth.isCronAuthorized,
  cronUnauthorized: cronAuth.cronUnauthorized,
}));

const cal = vi.hoisted(() => ({ getUpcomingConsultations: vi.fn() }));
vi.mock("@/lib/cal-com", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cal-com")>();
  return { ...actual, getUpcomingConsultations: cal.getUpcomingConsultations };
});

const integrations = vi.hoisted(() => ({ isConfiguredAsync: vi.fn() }));
vi.mock("@/lib/integrations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrations")>();
  return { ...actual, isConfiguredAsync: integrations.isConfiguredAsync };
});

const slackPost = vi.hoisted(() => vi.fn());
vi.mock("@/lib/slack-notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/slack-notify")>();
  return {
    ...actual,
    SlackClient: class {
      post = slackPost;
    },
  };
});

const email = vi.hoisted(() => ({ notifyTeam: vi.fn() }));
vi.mock("@/lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email")>();
  return { ...actual, notifyTeam: email.notifyTeam };
});

import { GET as usersGet, POST as usersPost } from "@/app/api/admin/users/route";
import { GET as gscRefresh } from "@/app/api/cron/gsc-cache-refresh/route";
import { GET as consultReminder } from "@/app/api/cron/consultation-reminder/route";

const USERS = "http://localhost/api/admin/users";
const GSC = "http://localhost/api/cron/gsc-cache-refresh";
const REMIND = "http://localhost/api/cron/consultation-reminder";

const post = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("/api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiAuth.ok = true;
    authD1.getAuthDbFromEnv.mockReturnValue({ fake: true });
    authD1.listUsers.mockResolvedValue([]);
    authD1.setUserAdminRole.mockResolvedValue(true);
    authD1.setUserDisabled.mockResolvedValue(true);
  });

  it("401s non-admin on GET + POST", async () => {
    apiAuth.ok = false;
    expect((await usersGet(new NextRequest(USERS))).status).toBe(401);
    expect((await usersPost(post(USERS, {}))).status).toBe(401);
  });

  it("503s without db; maps rows to admin shape", async () => {
    authD1.getAuthDbFromEnv.mockReturnValue(null);
    expect((await usersGet(new NextRequest(USERS))).status).toBe(503);

    authD1.getAuthDbFromEnv.mockReturnValue({});
    authD1.listUsers.mockResolvedValue([
      {
        id: "alice",
        email: "a@b",
        disabled: true,
        emailVerified: true,
        role: "admin",
        created_at: 1700000000,
      },
      { id: "bob", email: "b@c", emailVerified: false, role: "user" },
    ]);
    const j = await (
      await usersGet(new NextRequest(`${USERS}?limit=999&filter=a%20b`))
    ).json();
    expect(j.count).toBe(2);
    expect(j.users[0]).toMatchObject({
      username: "alice",
      status: "disabled",
      userStatus: "DISABLED",
      role: "admin",
      created: "2023-11-14T22:13:20.000Z",
    });
    expect(j.users[1].status).toBe("active");
    expect(j.users[1].created).toBeUndefined();
    // limit capped at 60; filter sanitized ("a b" → "ab")
    expect(authD1.listUsers).toHaveBeenCalledWith(expect.anything(), {
      limit: 60,
      emailPrefix: "ab",
    });
  });

  it("GET 500s on db error", async () => {
    authD1.listUsers.mockRejectedValue(new Error("db down"));
    expect((await usersGet(new NextRequest(USERS))).status).toBe(500);
  });

  it("POST validates action + username", async () => {
    expect((await usersPost(post(USERS, {}))).status).toBe(400);
    expect(
      (await usersPost(post(USERS, { action: "nuke", username: "u" }))).status
    ).toBe(400);
    expect(
      (
        await usersPost(
          post(USERS, { action: "enable", username: "bad name!" })
        )
      ).status
    ).toBe(400);
  });

  it("POST 503s without db; enable/disable/promote/demote paths", async () => {
    authD1.getAuthDbFromEnv.mockReturnValue(null);
    expect(
      (await usersPost(post(USERS, { action: "enable", username: "u" }))).status
    ).toBe(503);
    authD1.getAuthDbFromEnv.mockReturnValue({});

    const j1 = await (
      await usersPost(post(USERS, { action: "disable", username: "u" }))
    ).json();
    expect(j1.message).toBe("User disabled");
    expect(authD1.setUserDisabled).toHaveBeenCalledWith(
      expect.anything(),
      "u",
      true
    );

    await usersPost(post(USERS, { action: "enable", username: "u" }));
    expect(authD1.setUserDisabled).toHaveBeenLastCalledWith(
      expect.anything(),
      "u",
      false
    );

    const j2 = await (
      await usersPost(post(USERS, { action: "promote", username: "u" }))
    ).json();
    expect(j2.message).toBe("User promoted to admin");
    const j3 = await (
      await usersPost(post(USERS, { action: "demote", username: "u" }))
    ).json();
    expect(j3.message).toBe("User removed from admin group");
  });

  it("POST 404s missing user; 500s on error", async () => {
    authD1.setUserDisabled.mockResolvedValue(false);
    expect(
      (await usersPost(post(USERS, { action: "disable", username: "u" })))
        .status
    ).toBe(404);

    authD1.setUserAdminRole.mockResolvedValue(false);
    expect(
      (await usersPost(post(USERS, { action: "promote", username: "u" })))
        .status
    ).toBe(404);

    authD1.setUserDisabled.mockRejectedValue(new Error("db down"));
    expect(
      (await usersPost(post(USERS, { action: "enable", username: "u" }))).status
    ).toBe(500);
  });
});

describe("/api/cron/gsc-cache-refresh", () => {
  const get = (bearer = "cron") =>
    gscRefresh(
      new NextRequest(GSC, { headers: { authorization: `Bearer ${bearer}` } })
    );

  beforeEach(() => {
    vi.clearAllMocks();
    ssm.getConfig.mockResolvedValue({
      CRON_SECRET: "cron",
      GOOGLE_CLIENT_EMAIL: "svc@x",
      GOOGLE_PRIVATE_KEY: "k",
    });
    gscCache.readThrough.mockImplementation(
      async (_k: string, _p: unknown, fetcher: () => Promise<unknown>) =>
        fetcher()
    );
    gsc.getSeoSnapshot.mockResolvedValue({});
    gsc.getTopKeywords.mockResolvedValue([]);
    gsc.getTopPages.mockResolvedValue([]);
    gsc.getWebAnalytics.mockResolvedValue({});
  });

  it("401s on missing/wrong secret", async () => {
    ssm.getConfig.mockResolvedValue({ CRON_SECRET: "" });
    expect((await get()).status).toBe(401);
    ssm.getConfig.mockResolvedValue({ CRON_SECRET: "cron" });
    expect((await get("wrong")).status).toBe(401);
  });

  it("503s when GSC not configured", async () => {
    ssm.getConfig.mockResolvedValue({
      CRON_SECRET: "cron",
      GOOGLE_CLIENT_EMAIL: "",
      GOOGLE_PRIVATE_KEY: "",
    });
    expect((await get()).status).toBe(503);
  });

  it("warms both ranges × 4 fetchers; tolerates failures", async () => {
    const j = await (await get()).json();
    expect(j.warmed).toHaveLength(2);
    expect(j.warmed.map((w: { range: number }) => w.range)).toEqual([7, 28]);
    expect(j.warmed.every((w: { ok: boolean }) => w.ok)).toBe(true);
    expect(gsc.getSeoSnapshot).toHaveBeenCalledTimes(2);
    expect(gsc.getTopKeywords).toHaveBeenCalledTimes(2);
    expect(gsc.getTopPages).toHaveBeenCalledTimes(2);
    expect(gsc.getWebAnalytics).toHaveBeenCalledTimes(2);
    // readThrough called 8× with the right cache keys + ttl
    expect(gscCache.readThrough).toHaveBeenCalledTimes(8);
    expect(gscCache.readThrough).toHaveBeenCalledWith(
      "seo",
      { days: 7 },
      expect.any(Function),
      { ttlSeconds: 3600 }
    );
  });

  it("reports per-range errors without failing the job", async () => {
    gsc.getTopPages.mockRejectedValue(new Error("gsc flaky"));
    const j = await (await get()).json();
    expect(j.warmed[0].ok).toBe(false);
    expect(j.warmed[0].errors).toEqual(["gsc flaky"]);
  });
});

describe("/api/cron/consultation-reminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cronAuth.authorized = true;
    integrations.isConfiguredAsync.mockResolvedValue(true);
    cal.getUpcomingConsultations.mockResolvedValue([]);
    slackPost.mockResolvedValue(undefined);
    email.notifyTeam.mockResolvedValue(undefined);
  });

  it("401s unauthorized; skips when calendar unconfigured", async () => {
    cronAuth.authorized = false;
    expect((await consultReminder(new NextRequest(REMIND))).status).toBe(401);

    cronAuth.authorized = true;
    integrations.isConfiguredAsync.mockResolvedValue(false);
    const j = await (await consultReminder(new NextRequest(REMIND))).json();
    expect(j.skipped).toBe(true);
  });

  it("reminds 0 when nothing in the 45-75m window", async () => {
    const in2h = new Date(Date.now() + 2 * 3600_000).toISOString();
    const in10m = new Date(Date.now() + 10 * 60_000).toISOString();
    cal.getUpcomingConsultations.mockResolvedValue([
      { id: "1", start: in2h, title: "later" },
      { id: "2", start: in10m, title: "soon" },
    ]);
    const j = await (await consultReminder(new NextRequest(REMIND))).json();
    expect(j).toEqual({ reminded: 0 });
    expect(slackPost).not.toHaveBeenCalled();

    // upstream failure → treated as empty list
    cal.getUpcomingConsultations.mockRejectedValue(new Error("cal down"));
    const j2 = await (await consultReminder(new NextRequest(REMIND))).json();
    expect(j2.reminded).toBe(0);
  });

  it("posts Slack + email for in-window consultations", async () => {
    const in60m = new Date(Date.now() + 60 * 60_000).toISOString();
    cal.getUpcomingConsultations.mockResolvedValue([
      { id: "a", start: in60m, title: "Audit call", meetLink: "https://meet/x" },
      { id: "b", start: in60m, title: "No link" },
    ]);
    const j = await (await consultReminder(new NextRequest(REMIND))).json();
    expect(j).toEqual({ reminded: 2, total: 2 });
    expect(slackPost).toHaveBeenCalledTimes(2);
    const block = JSON.stringify(slackPost.mock.calls[0][0]);
    expect(block).toContain("Audit call");
    expect(block).toContain("Join Google Meet");
    expect(email.notifyTeam).toHaveBeenCalledTimes(2);
  });

  it("counts partial failures in reminded", async () => {
    const in60m = new Date(Date.now() + 60 * 60_000).toISOString();
    cal.getUpcomingConsultations.mockResolvedValue([
      { id: "a", start: in60m, title: "A" },
      { id: "b", start: in60m, title: "B" },
    ]);
    slackPost
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("slack down"));
    const j = await (await consultReminder(new NextRequest(REMIND))).json();
    expect(j.reminded).toBe(1);
    expect(j.total).toBe(2);
  });
});
