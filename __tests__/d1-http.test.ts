import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canUseD1Http, getHttpAuthDb, resetHttpAuthDbCache } from "@/lib/d1-http";

describe("d1-http", () => {
  const originalFetch = globalThis.fetch;
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    resetHttpAuthDbCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          success: true,
          result: [
            {
              results: [{ id: "u1", email: "a@cloudless.gr" }],
              success: true,
              meta: { changes: 0 },
            },
          ],
        })
      )
    );
  });

  afterEach(() => {
    resetHttpAuthDbCache();
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) {
      if (!(key in envSnapshot)) delete process.env[key];
    }
    Object.assign(process.env, envSnapshot);
    vi.unstubAllGlobals();
  });

  it("canUseD1Http requires account + token", () => {
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CF_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    resetHttpAuthDbCache();
    expect(canUseD1Http()).toBe(false);
    expect(getHttpAuthDb()).toBeNull();
  });

  it("prepare/bind/first round-trips via Cloudflare D1 REST", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct";
    process.env.CLOUDFLARE_API_TOKEN = "tok";
    process.env.CLOUDFLARE_D1_DATABASE_ID = "db-id";
    resetHttpAuthDbCache();
    const db = getHttpAuthDb();
    expect(db).not.toBeNull();
    const row = await db!
      .prepare("SELECT id, email FROM user WHERE email = ?")
      .bind("a@cloudless.gr")
      .first<{ id: string; email: string }>();
    expect(row).toEqual({ id: "u1", email: "a@cloudless.gr" });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/acct/d1/database/db-id/query",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer tok" }),
      })
    );
  });

  it("run returns meta.changes", async () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct";
    process.env.CLOUDFLARE_API_TOKEN = "tok";
    resetHttpAuthDbCache();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          success: true,
          result: [{ results: [], success: true, meta: { changes: 2 } }],
        })
      )
    );
    const db = getHttpAuthDb()!;
    const res = await db.prepare("DELETE FROM session WHERE id = ?").bind("s1").run();
    expect(res.success).toBe(true);
    expect(res.meta?.changes).toBe(2);
  });
});
