/**
 * Tests for GET/POST /api/auth/activate-d1, POST /api/webhooks/sentry and
 * GET /api/admin/audits/latest.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { deflateRawSync } from "node:zlib";

const hoisted = vi.hoisted(() => ({
  db: null as unknown,
  rlOk: true,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() =>
    hoisted.rlOk
      ? { ok: true, remaining: 99 }
      : {
          ok: false,
          response: Response.json({ error: "rate limited" }, { status: 429 }),
        }
  ),
  getClientIp: vi.fn(() => "1.2.3.4"),
}));

vi.mock("@/lib/canonical-origin", () => ({
  canonicalOrigin: vi.fn(() => "https://cloudless.gr"),
}));

const authD1 = vi.hoisted(() => ({ getAuthDbFromEnv: vi.fn() }));
vi.mock("@/lib/auth-d1", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-d1")>();
  return { ...actual, getAuthDbFromEnv: authD1.getAuthDbFromEnv };
});

const cfg = vi.hoisted(() => ({ values: {} as Record<string, string> }));
vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn(async () => cfg.values),
}));

const alerts = vi.hoisted(() => ({ notifyAdmin: vi.fn() }));
vi.mock("@/lib/admin-alerts", () => alerts);

const apiAuth = vi.hoisted(() => ({ ok: true }));
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () =>
    apiAuth.ok
      ? { ok: true, user: { id: "u1" } }
      : { ok: false, response: NextResponse.json({ error: "no" }, { status: 401 }) }
  ),
}));

import { GET as activateGet, POST as activatePost } from "@/app/api/auth/activate-d1/route";
import { GET as sentryGet, POST as sentryPost } from "@/app/api/webhooks/sentry/route";
import { GET as auditsGet } from "@/app/api/admin/audits/latest/route";

const ACT = "http://localhost/api/auth/activate-d1";
const SENTRY = "http://localhost/api/webhooks/sentry";
const AUDITS = "http://localhost/api/admin/audits/latest";

const SECRET = "test-auth-secret";

/** Replicates the route's token + OTP generation (HMAC-SHA256). */
async function makeToken(email: string, exp = Date.now() + 60_000): Promise<string> {
  const nonce = "nonce1";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${email}:${exp}:${nonce}`)
    )
  );
  const b64 = btoa(String.fromCharCode(...sig))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${nonce}.${exp}.${b64}`;
}

async function makeOtp(email: string, token: string): Promise<string> {
  const [nonce, expStr] = token.split(".");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const full = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`otp:${email}:${expStr}:${nonce}`)
    )
  );
  const hex = Array.from(full)
    .map((b) => "00".concat(b.toString(16)).slice(-2))
    .join("");
  return (parseInt(hex.slice(0, 8), 16) % 1_000_000).toString().padStart(6, "0");
}

const chainDb = (fail = false) => ({
  prepare: vi.fn(() => ({
    bind: vi.fn(() => ({
      run: vi.fn(async () => {
        if (fail) throw new Error("d1 down");
        return { success: true };
      }),
    })),
  })),
});

describe("/api/auth/activate-d1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    hoisted.db = null;
    hoisted.rlOk = true;
    authD1.getAuthDbFromEnv.mockImplementation(() => hoisted.db);
    vi.stubEnv("AUTH_SECRET", SECRET);
  });

  it("GET 429s on rate limit", async () => {
    hoisted.rlOk = false;
    expect((await activateGet(new NextRequest(ACT))).status).toBe(429);
  });

  it("GET redirects to signup?activated=invalid on missing/bad/expired token", async () => {
    for (const url of [
      ACT,
      `${ACT}?email=a@b.c`,
      `${ACT}?email=a@b.c&token=bad`,
      `${ACT}?email=a@b.c&token=${await makeToken("a@b.c", Date.now() - 1000)}`,
      `${ACT}?email=a@b.c&token=${await makeToken("other@x.y")}`,
    ]) {
      const res = await activateGet(new NextRequest(url));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe(
        "https://cloudless.gr/en/auth/signup?activated=invalid"
      );
    }
  });

  it("GET redirects activated=error without db, activated=1 with db", async () => {
    const token = await makeToken("a@b.c");
    const res1 = await activateGet(
      new NextRequest(`${ACT}?email=a@b.c&token=${token}`)
    );
    expect(res1.headers.get("location")).toBe(
      "https://cloudless.gr/en/auth/signup?activated=error"
    );

    hoisted.db = chainDb();
    const res2 = await activateGet(
      new NextRequest(`${ACT}?email=a@b.c&token=${token}`)
    );
    expect(res2.headers.get("location")).toBe(
      "https://cloudless.gr/en/auth/login?activated=1"
    );

    // db update failure is non-fatal for GET
    hoisted.db = chainDb(true);
    const res3 = await activateGet(
      new NextRequest(`${ACT}?email=a@b.c&token=${token}`)
    );
    expect(res3.headers.get("location")).toContain("activated=1");
  });

  it("POST 503s without db, 429s on rate limit", async () => {
    expect(
      (await activatePost(new NextRequest(ACT, { method: "POST" }))).status
    ).toBe(503);

    hoisted.db = chainDb();
    hoisted.rlOk = false;
    expect(
      (await activatePost(new NextRequest(ACT, { method: "POST" }))).status
    ).toBe(429);
  });

  it("POST validates body, fields and otp", async () => {
    hoisted.db = chainDb();
    const post = (body: string | object) =>
      activatePost(
        new NextRequest(ACT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: typeof body === "string" ? body : JSON.stringify(body),
        })
      );

    expect((await post("{bad")).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect(
      (await post({ email: "a@b.c", otp: "1", token: "bad" })).status
    ).toBe(400);

    const token = await makeToken("a@b.c");
    expect(
      (await post({ email: "a@b.c", otp: "000000", token })).status
    ).toBe(400);
  });

  it("POST activates on valid otp; 500 on db failure", async () => {
    const token = await makeToken("a@b.c");
    const otp = await makeOtp("a@b.c", token);
    const post = () =>
      activatePost(
        new NextRequest(ACT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "a@b.c", otp, token }),
        })
      );

    hoisted.db = chainDb();
    const res = await post();
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    hoisted.db = chainDb(true);
    expect((await post()).status).toBe(500);
  });
});

describe("/api/webhooks/sentry", () => {
  const signed = (body: object | string, secret = "hook-secret") => {
    const raw = typeof body === "string" ? body : JSON.stringify(body);
    return new NextRequest(SENTRY, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "sentry-hook-signature": createHmac("sha256", secret)
          .update(raw)
          .digest("hex"),
      },
      body: raw,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cfg.values = { SENTRY_WEBHOOK_SECRET: "hook-secret" };
    alerts.notifyAdmin.mockResolvedValue({ delivered: true });
  });

  it("GET returns usage info", async () => {
    const j = await (await sentryGet()).json();
    expect(j.ok).toBe(true);
    expect(j.method).toBe("POST");
  });

  it("503s without secret, 401s on bad signature", async () => {
    cfg.values = {};
    expect((await sentryPost(signed({}))).status).toBe(503);

    cfg.values = { SENTRY_WEBHOOK_SECRET: "hook-secret" };
    expect((await sentryPost(signed({}, "wrong-secret"))).status).toBe(401);
    expect(
      (
        await sentryPost(
          new NextRequest(SENTRY, { method: "POST", body: "{}" })
        )
      ).status
    ).toBe(401);
  });

  it("400s on invalid JSON; skips missing issue / non-prod / resolved", async () => {
    expect((await sentryPost(signed("{bad json"))).status).toBe(400);

    const j1 = await (await sentryPost(signed({ action: "created" }))).json();
    expect(j1.skipped).toBe("no_issue_in_payload");

    const j2 = await (
      await sentryPost(
        signed({
          data: { issue: { id: "1" }, event: { environment: "staging" } },
        })
      )
    ).json();
    expect(j2.skipped).toBe("non_prod_env:staging");

    const j3 = await (
      await sentryPost(
        signed({ data: { issue: { id: "1", status: "resolved" } } })
      )
    ).json();
    expect(j3.skipped).toBe("issue_status:resolved");

    const j4 = await (
      await sentryPost(
        signed({ data: { issue: { id: "1", status: "ignored" } } })
      )
    ).json();
    expect(j4.skipped).toBe("issue_status:ignored");
  });

  it("maps severity + notifies for prod issues", async () => {
    const issue = (level: string) => ({
      data: {
        issue: {
          id: "1",
          title: "boom",
          culprit: "route.ts",
          level,
          status: "unresolved",
          permalink: "https://sentry/x",
          project: { slug: "web" },
          metadata: { value: "val" },
        },
        event: { environment: "production" },
      },
      action: "created",
    });

    for (const [level, sev] of [
      ["fatal", "critical"],
      ["error", "critical"],
      ["warning", "warning"],
      ["info", "info"],
      ["debug", "info"],
      [undefined, "info"],
    ] as const) {
      const res = await sentryPost(signed(issue(level as string)));
      expect(res.status).toBe(200);
      expect(alerts.notifyAdmin).toHaveBeenLastCalledWith(
        expect.objectContaining({
          severity: sev,
          title: "[sentry/web] boom",
          click: "https://sentry/x",
        })
      );
    }
    const msg = vi.mocked(alerts.notifyAdmin).mock.calls[0][0] as {
      message: string;
    };
    expect(msg.message).toContain("Culprit: route.ts");
    expect(msg.message).toContain("Value: val");
    expect(msg.message).toContain("Action: created");
  });
});

describe("/api/admin/audits/latest", () => {
  /** Minimal ZIP writer — one stored (method 0) or deflated (8) entry. */
  function makeZip(name: string, content: string, method: 0 | 8 = 0): Buffer {
    const data = method === 0 ? Buffer.from(content) : deflateRawSync(content);
    const nameBuf = Buffer.from(name);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(data.length, 18); // comp size
    lh.writeUInt32LE(content.length, 22); // uncomp
    lh.writeUInt16LE(nameBuf.length, 26);
    const local = Buffer.concat([lh, nameBuf, data]);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(content.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(0, 42); // local offset
    const central = Buffer.concat([cd, nameBuf]);

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 10); // entries
    eocd.writeUInt32LE(central.length, 12);
    eocd.writeUInt32LE(local.length, 16);
    return Buffer.concat([local, central, eocd]);
  }

  const jsonRes = (body: unknown, ok = true, status = 200) =>
    ({
      ok,
      status,
      statusText: "OK",
      json: async () => body,
      arrayBuffer: async () =>
        body instanceof Buffer
          ? body.buffer.slice(body.byteOffset, body.byteOffset + body.length)
          : undefined,
    }) as unknown as Response;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    apiAuth.ok = true;
    vi.stubEnv("GH_AUDITS_TOKEN", "gh-tok");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("401s non-admin, 503s without token", async () => {
    apiAuth.ok = false;
    expect((await auditsGet(new NextRequest(AUDITS))).status).toBe(401);

    apiAuth.ok = true;
    vi.unstubAllEnvs();
    expect((await auditsGet(new NextRequest(AUDITS))).status).toBe(503);
  });

  it("404s with no successful runs or missing artifact", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonRes({ workflow_runs: [] }));
    expect((await auditsGet(new NextRequest(AUDITS))).status).toBe(404);

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonRes({ workflow_runs: [{ id: 1, head_sha: "x", html_url: "", updated_at: "", conclusion: "success" }] })
      )
      .mockResolvedValueOnce(jsonRes({ artifacts: [{ name: "other", id: 2, archive_download_url: "u" }] }));
    expect((await auditsGet(new NextRequest(AUDITS))).status).toBe(404);
  });

  it("502s on failed artifact download or zip without dashboard.json", async () => {
    const runs = jsonRes({
      workflow_runs: [{ id: 1, head_sha: "x", html_url: "", updated_at: "", conclusion: "success" }],
    });
    const arts = jsonRes({
      artifacts: [{ name: "audits-dashboard-1", id: 2, archive_download_url: "https://blob" }],
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(runs)
      .mockResolvedValueOnce(arts)
      .mockResolvedValueOnce(jsonRes({}, false, 404));
    expect((await auditsGet(new NextRequest(AUDITS))).status).toBe(502);

    vi.mocked(fetch)
      .mockResolvedValueOnce(runs)
      .mockResolvedValueOnce(arts)
      .mockResolvedValueOnce(jsonRes(makeZip("other.json", "{}")));
    expect((await auditsGet(new NextRequest(AUDITS))).status).toBe(502);
  });

  it("extracts dashboard.json from a stored or deflated zip", async () => {
    const runs = jsonRes({
      workflow_runs: [{ id: 1, head_sha: "x", html_url: "", updated_at: "", conclusion: "success" }],
    });
    const arts = jsonRes({
      artifacts: [{ name: "audits-dashboard-1", id: 2, archive_download_url: "https://blob" }],
    });

    for (const method of [0, 8] as const) {
      vi.mocked(fetch)
        .mockResolvedValueOnce(runs)
        .mockResolvedValueOnce(arts)
        .mockResolvedValueOnce(
          jsonRes(makeZip("dashboard.json", '{"score": 95}', method))
        );
      const res = await auditsGet(new NextRequest(AUDITS));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ score: 95 });
      expect(res.headers.get("cache-control")).toContain("max-age=60");
    }
  });

  it("500s when the GH API throws", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("gh down"));
    expect((await auditsGet(new NextRequest(AUDITS))).status).toBe(500);
  });
});
