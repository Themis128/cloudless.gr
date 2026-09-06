import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_AUTH_D1_DATABASE_ID,
  canUseD1Http,
  getHttpAuthDb,
  resetHttpAuthDbCache,
} from "@/lib/d1-http";

beforeEach(() => {
  resetHttpAuthDbCache();
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_D1_DATABASE_ID;
});

describe("DEFAULT_AUTH_D1_DATABASE_ID", () => {
  it("is a non-empty UUID string", () => {
    expect(DEFAULT_AUTH_D1_DATABASE_ID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });
});

describe("canUseD1Http", () => {
  it("returns false when env vars are missing", () => {
    expect(canUseD1Http()).toBe(false);
  });

  it("returns false when only account ID is set", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    expect(canUseD1Http()).toBe(false);
  });

  it("returns false when only API token is set", () => {
    process.env.CLOUDFLARE_API_TOKEN = "token123";
    expect(canUseD1Http()).toBe(false);
  });

  it("returns true when both env vars are set", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_API_TOKEN = "token123";
    expect(canUseD1Http()).toBe(true);
  });
});

describe("getHttpAuthDb", () => {
  it("returns null when credentials are not configured", () => {
    expect(getHttpAuthDb()).toBeNull();
  });

  it("returns an AuthDatabase-like object when credentials are set", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_API_TOKEN = "token123";
    const db = getHttpAuthDb();
    expect(db).not.toBeNull();
    expect(typeof db?.prepare).toBe("function");
  });
});

describe("resetHttpAuthDbCache", () => {
  it("clears the cached instance so next call rebuilds", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "acct123";
    process.env.CLOUDFLARE_API_TOKEN = "token123";
    const db1 = getHttpAuthDb();
    resetHttpAuthDbCache();
    const db2 = getHttpAuthDb();
    expect(db1).not.toBe(db2);
  });
});
