/**
 * Tests for /api/auth/{resend-verification-d1,reset-confirm,session-d1},
 * /api/analytics/{event,r2}, /api/agents/counter-agent/default.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const libs = vi.hoisted(() => ({
  sendActivationEmail: vi.fn(async () => {}),
  consumePasswordResetToken: vi.fn(),
  getAuthDbFromEnv: vi.fn(),
  getUserBySession: vi.fn(),
  deleteSession: vi.fn(),
  isAdmin: vi.fn(),
  isAuthenticated: vi.fn(async () => true),
  sendSocialAutoEventServer: vi.fn(async () => {}),
}));
vi.mock("@/lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email")>();
  return { ...actual, sendActivationEmail: libs.sendActivationEmail };
});
vi.mock("@/lib/auth-d1", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-d1")>();
  return {
    ...actual,
    consumePasswordResetToken: libs.consumePasswordResetToken,
    getAuthDbFromEnv: libs.getAuthDbFromEnv,
    getUserBySession: libs.getUserBySession,
    deleteSession: libs.deleteSession,
    isAdmin: libs.isAdmin,
  };
});
vi.mock("@/lib/auth-middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-middleware")>();
  return { ...actual, isAuthenticated: libs.isAuthenticated };
});
vi.mock("@/lib/socialauto-analytics-server", () => ({
  sendSocialAutoEventServer: libs.sendSocialAutoEventServer,
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    rateLimit: vi.fn(() => ({ ok: true })),
    getClientIp: vi.fn(() => "127.0.0.1"),
  };
});

import { POST as resendPost } from "@/app/api/auth/resend-verification-d1/route";
import { POST as resetConfirmPost } from "@/app/api/auth/reset-confirm/route";
import {
  GET as sessionGet,
  DELETE as sessionDelete,
} from "@/app/api/auth/session-d1/route";
import { POST as eventPost } from "@/app/api/analytics/event/route";
import { GET as r2Get } from "@/app/api/analytics/r2/route";
import { POST as counterPost } from "@/app/api/agents/counter-agent/default/route";

const post = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  libs.isAuthenticated.mockResolvedValue(true);
});

describe("resend-verification-d1", () => {
  it("ok:true on bad/empty bodies; HMAC token for valid email", async () => {
    expect(
      (await (await resendPost(post("http://x/api/auth/resend-verification-d1", "{bad"))).json()).ok
    ).toBe(true);
    expect(
      (await (await resendPost(post("http://x/api/auth/resend-verification-d1", {}))).json()).ok
    ).toBe(true);
    expect(libs.sendActivationEmail).not.toHaveBeenCalled();

    const j = await (
      await resendPost(
        post("http://x/api/auth/resend-verification-d1", { email: "A@B.com " })
      )
    ).json();
    expect(j.ok).toBe(true);
    expect(j.token).toMatch(/^[a-f0-9]{32}\.\d+\.[A-Za-z0-9_-]+$/);
    expect(libs.sendActivationEmail).toHaveBeenCalledWith("a@b.com", j.token);
  });
});

describe("reset-confirm", () => {
  it("503 without db; validates body, match, length; consumes token", async () => {
    libs.getAuthDbFromEnv.mockReturnValue(null);
    expect(
      (await resetConfirmPost(post("http://x/api/auth/reset-confirm", {})))
        .status
    ).toBe(503);

    libs.getAuthDbFromEnv.mockReturnValue({});
    expect(
      (await resetConfirmPost(post("http://x/api/auth/reset-confirm", "{bad")))
        .status
    ).toBe(400);
    expect(
      (await resetConfirmPost(post("http://x/api/auth/reset-confirm", {})))
        .status
    ).toBe(400);
    expect(
      (
        await resetConfirmPost(
          post("http://x/api/auth/reset-confirm", {
            token: "t",
            newPassword: "aaa",
            confirmPassword: "bbb",
          })
        )
      ).status
    ).toBe(400);
    expect(
      (
        await resetConfirmPost(
          post("http://x/api/auth/reset-confirm", {
            token: "t",
            newPassword: "short",
            confirmPassword: "short",
          })
        )
      ).status
    ).toBe(400);

    libs.consumePasswordResetToken.mockResolvedValue({
      success: false,
      error: "expired",
    });
    const j = await (
      await resetConfirmPost(
        post("http://x/api/auth/reset-confirm", {
          token: "t",
          newPassword: "longenough",
          confirmPassword: "longenough",
        })
      )
    ).json();
    expect(j.error).toBe("expired");

    libs.consumePasswordResetToken.mockResolvedValue({ success: true });
    const j2 = await (
      await resetConfirmPost(
        post("http://x/api/auth/reset-confirm", {
          token: "t",
          newPassword: "longenough",
          confirmPassword: "longenough",
        })
      )
    ).json();
    expect(j2.ok).toBe(true);
    expect(libs.consumePasswordResetToken).toHaveBeenCalledWith(
      {},
      "t",
      "longenough"
    );
  });
});

describe("session-d1", () => {
  const sess = (cookie?: string) =>
    new NextRequest("http://x/api/auth/session-d1", {
      headers: cookie ? { cookie: `session_token=${cookie}` } : {},
    });

  it("GET: null user without db/cookie/session; full user + isAdmin", async () => {
    libs.getAuthDbFromEnv.mockReturnValue(null);
    expect((await (await sessionGet(sess("s"))).json()).user).toBeNull();

    libs.getAuthDbFromEnv.mockReturnValue({});
    expect((await (await sessionGet(sess())).json()).user).toBeNull();

    libs.getUserBySession.mockResolvedValue(null);
    const res = await sessionGet(sess("dead"));
    expect((await res.json()).user).toBeNull();
    expect(res.headers.get("set-cookie")).toContain("session_token=");

    libs.getUserBySession.mockResolvedValue({
      id: "u1",
      email: "a@b",
      name: "A",
      company: "C",
      phone: "1",
    });
    libs.isAdmin.mockResolvedValue(true);
    const j = await (await sessionGet(sess("live"))).json();
    expect(j.user.email).toBe("a@b");
    expect(j.isAdmin).toBe(true);
  });

  it("DELETE: ok without db; deletes session + clears cookie", async () => {
    libs.getAuthDbFromEnv.mockReturnValue(null);
    expect(
      (await (await sessionDelete(sess("s"))).json()).ok
    ).toBe(true);

    libs.getAuthDbFromEnv.mockReturnValue({});
    const res = await sessionDelete(sess("tok1"));
    expect((await res.json()).ok).toBe(true);
    expect(libs.deleteSession).toHaveBeenCalledWith({}, "tok1");
    expect(res.headers.get("set-cookie")).toContain("session_token=");
  });
});

describe("analytics event + r2", () => {
  it("event: 400 bad json/shape; forwards valid events", async () => {
    expect(
      (await eventPost(post("http://x/api/analytics/event", "{bad"))).status
    ).toBe(400);
    expect(
      (await eventPost(post("http://x/api/analytics/event", { event: 1 })))
        .status
    ).toBe(400);

    const res = await eventPost(
      post("http://x/api/analytics/event", { event: "pv", domain: "x.gr" })
    );
    expect((await res.json()).ok).toBe(true);
    expect(libs.sendSocialAutoEventServer).toHaveBeenCalledWith(
      { event: "pv", domain: "x.gr" },
      expect.anything()
    );
  });

  it("r2: 503 unbound, 400 validation, range handling, 404/500", async () => {
    delete process.env.ANALYTICS_BUCKET;
    expect(
      (await r2Get(new NextRequest("http://x/api/analytics/r2?file=a.parquet")))
        .status
    ).toBe(503);

    // Node coerces process.env reads to strings — an R2 bucket object can
    // only be injected by swapping the env object itself (Workers-style
    // object bindings don't exist in Node).
    const origEnv = process.env;
    const bucket = { get: vi.fn() };
    process.env = { ANALYTICS_BUCKET: bucket } as never;

    expect(
      (await r2Get(new NextRequest("http://x/api/analytics/r2"))).status
    ).toBe(400);
    expect(
      (
        await r2Get(
          new NextRequest("http://x/api/analytics/r2?file=../etc/passwd")
        )
      ).status
    ).toBe(400);
    expect(
      (await r2Get(new NextRequest("http://x/api/analytics/r2?file=a.csv")))
        .status
    ).toBe(400);

    bucket.get.mockResolvedValue(null);
    expect(
      (await r2Get(new NextRequest("http://x/api/analytics/r2?file=a.parquet")))
        .status
    ).toBe(404);
    expect(bucket.get).toHaveBeenCalledWith("lake/a.parquet", {});

    // open-ended range → 1MB chunk
    await r2Get(
      new NextRequest("http://x/api/analytics/r2?file=a.parquet", {
        headers: { range: "bytes=100-" },
      })
    );
    expect(bucket.get).toHaveBeenLastCalledWith("lake/a.parquet", {
      range: { offset: 100, length: 1048576 },
    });

    // closed range + etag passthrough
    bucket.get.mockResolvedValue({
      httpEtag: '"e1"',
      body: new ReadableStream({ start: (c) => c.close() }),
    });
    const res = await r2Get(
      new NextRequest("http://x/api/analytics/r2?file=a.parquet", {
        headers: { range: "bytes=0-49" },
      })
    );
    expect(res.status).toBe(200);
    expect(bucket.get).toHaveBeenLastCalledWith("lake/a.parquet", {
      range: { offset: 0, length: 50 },
    });
    expect(res.headers.get("ETag")).toBe('"e1"');
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");

    bucket.get.mockRejectedValue(new Error("r2 down"));
    expect(
      (await r2Get(new NextRequest("http://x/api/analytics/r2?file=a.parquet")))
        .status
    ).toBe(500);

    process.env = origEnv;
  });
});

describe("counter-agent", () => {
  const ctr = (method: string) =>
    counterPost(
      new NextRequest(
        `http://x/api/agents/counter-agent/default?method=${method}`,
        { method: "POST" }
      )
    );

  it("401 unauth'd; increment/decrement floor/reset/getCount/unknown", async () => {
    libs.isAuthenticated.mockResolvedValue(false);
    expect((await ctr("increment")).status).toBe(401);
    libs.isAuthenticated.mockResolvedValue(true);

    await ctr("reset");
    expect((await (await ctr("increment")).json()).count).toBe(1);
    expect((await (await ctr("increment")).json()).count).toBe(2);
    expect((await (await ctr("decrement")).json()).count).toBe(1);
    expect((await (await ctr("getCount")).json()).count).toBe(1);
    expect((await (await ctr("reset")).json()).count).toBe(0);
    // floor at 0
    expect((await (await ctr("decrement")).json()).count).toBe(0);
    expect((await ctr("bogus")).status).toBe(400);
  });
});
