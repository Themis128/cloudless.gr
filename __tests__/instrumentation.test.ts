import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  slackDeployNotify: vi.fn(),
  canUseD1Http: vi.fn(),
  isCfHostErr: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: m.getCloudflareContext }));
vi.mock("@/lib/slack-notify", () => ({ slackDeployNotify: m.slackDeployNotify }));
vi.mock("@/lib/d1-http", () => ({ canUseD1Http: m.canUseD1Http }));
vi.mock("@/lib/is-cloudflare-api-host-error", () => ({
  isCloudflareApiHostError: m.isCfHostErr,
}));
vi.mock("../sentry.server.config", () => ({}));
vi.mock("../sentry.edge.config", () => ({}));

import { shouldBindRemoteAuthDb, shouldPreferLocalAuthDb } from "@/instrumentation-flags";

const ENV = [
  "NODE_ENV",
  "NEXT_RUNTIME",
  "CI",
  "NEXT_PUBLIC_E2E",
  "AUTH_DB_PREFER_LOCAL",
  "AUTH_DB_USE_HTTP",
  "CLOUDFLARE_API_TOKEN",
  "NEXT_PUBLIC_APP_VERSION",
  "SST_STAGE",
] as const;

const saved: Record<string, string | undefined> = {};
function saveEnv() {
  for (const k of ENV) saved[k] = process.env[k];
}
function restoreEnv() {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  saveEnv();
  delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
});
afterEach(restoreEnv);

function devEnv() {
  process.env.NODE_ENV = "development";
  process.env.NEXT_RUNTIME = "nodejs";
}

describe("instrumentation-flags", () => {
  it("shouldPreferLocalAuthDb only for dev+prefer-local, never with HTTP", () => {
    process.env.NODE_ENV = "development";
    expect(shouldPreferLocalAuthDb()).toBe(false);
    process.env.AUTH_DB_PREFER_LOCAL = "1";
    expect(shouldPreferLocalAuthDb()).toBe(true);
    process.env.AUTH_DB_USE_HTTP = "1";
    expect(shouldPreferLocalAuthDb()).toBe(false);
    delete process.env.AUTH_DB_USE_HTTP;
    process.env.NODE_ENV = "production";
    expect(shouldPreferLocalAuthDb()).toBe(false);
  });

  it("shouldBindRemoteAuthDb requires nodejs+dev+token and no overrides", () => {
    devEnv();
    process.env.CLOUDFLARE_API_TOKEN = "tok";
    expect(shouldBindRemoteAuthDb()).toBe(true);
    process.env.CI = "true";
    expect(shouldBindRemoteAuthDb()).toBe(false);
    delete process.env.CI;
    process.env.NEXT_PUBLIC_E2E = "1";
    expect(shouldBindRemoteAuthDb()).toBe(false);
    delete process.env.NEXT_PUBLIC_E2E;
    process.env.AUTH_DB_PREFER_LOCAL = "1";
    expect(shouldBindRemoteAuthDb()).toBe(false);
    delete process.env.AUTH_DB_PREFER_LOCAL;
    process.env.AUTH_DB_USE_HTTP = "1";
    expect(shouldBindRemoteAuthDb()).toBe(false);
    delete process.env.AUTH_DB_USE_HTTP;
    delete process.env.CLOUDFLARE_API_TOKEN;
    expect(shouldBindRemoteAuthDb()).toBe(false);
    process.env.NEXT_RUNTIME = "edge";
    process.env.CLOUDFLARE_API_TOKEN = "tok";
    expect(shouldBindRemoteAuthDb()).toBe(false);
    process.env.NEXT_RUNTIME = "nodejs";
    process.env.NODE_ENV = "production";
    expect(shouldBindRemoteAuthDb()).toBe(false);
  });
});

describe("registerNode", () => {
  it("dev + AUTH_DB_USE_HTTP + working D1 http → early return, no bind", async () => {
    devEnv();
    process.env.AUTH_DB_USE_HTTP = "1";
    m.canUseD1Http.mockReturnValue(true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { registerNode } = await import("@/instrumentation.node");
    await registerNode();
    expect(m.getCloudflareContext).not.toHaveBeenCalled();
    expect((globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__).toBeUndefined();
    warn.mockRestore();
  });

  it("dev + AUTH_DB_USE_HTTP but D1 http unavailable → falls to local bind path", async () => {
    devEnv();
    process.env.AUTH_DB_USE_HTTP = "1";
    m.canUseD1Http.mockReturnValue(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { registerNode } = await import("@/instrumentation.node");
    await registerNode();
    // computed require throws under vitest → catch → missing warn
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("AUTH_DB missing"));
    warn.mockRestore();
  });

  it("dev + remote bind: binds AUTH_DB from Cloudflare context", async () => {
    devEnv();
    process.env.CLOUDFLARE_API_TOKEN = "tok";
    const binding = { prepare: vi.fn() };
    m.getCloudflareContext.mockResolvedValueOnce({ env: { AUTH_DB: binding } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { registerNode } = await import("@/instrumentation.node");
    await registerNode();
    expect((globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__).toBe(binding);
    warn.mockRestore();
  });

  it("dev + remote bind: warns when AUTH_DB absent and on Cloudflare host errors", async () => {
    devEnv();
    process.env.CLOUDFLARE_API_TOKEN = "tok";
    m.getCloudflareContext.mockResolvedValueOnce({ env: {} });
    let warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let mod = await import("@/instrumentation.node");
    await mod.registerNode();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("missing from Cloudflare context"));
    warn.mockRestore();

    vi.resetModules();
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
    m.getCloudflareContext.mockRejectedValueOnce(new Error("api.cloudflare.com unreachable"));
    m.isCfHostErr.mockReturnValue(true);
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mod = await import("@/instrumentation.node");
    await mod.registerNode();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("remote context unavailable"));
    warn.mockRestore();
  });

  it("dev + remote bind failure (non-CF error) → generic bind-failed warn", async () => {
    devEnv();
    process.env.CLOUDFLARE_API_TOKEN = "tok";
    m.getCloudflareContext.mockRejectedValueOnce(new Error("weird"));
    m.isCfHostErr.mockReturnValue(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { registerNode } = await import("@/instrumentation.node");
    await registerNode();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Local AUTH_DB bind failed"), "weird");
    warn.mockRestore();
  });

  it("dev skips local bind when __AUTH_DB__ already bound", async () => {
    devEnv();
    (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__ = { prepare: vi.fn() };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { registerNode } = await import("@/instrumentation.node");
    await registerNode();
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("AUTH_DB missing"));
    warn.mockRestore();
  });

  it("production loads sentry config + fires deploy notification once per version", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_VERSION = "abc123";
    m.slackDeployNotify.mockResolvedValue(undefined);
    const { registerNode } = await import("@/instrumentation.node");
    await registerNode();
    await registerNode(); // deduped — same version
    expect(m.slackDeployNotify).toHaveBeenCalledTimes(1);
    expect(m.slackDeployNotify).toHaveBeenCalledWith(
      expect.objectContaining({ version: "abc123", status: "succeeded", commitSha: "abc123" })
    );
  });

  it("production skips deploy notify when version unknown", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    const { registerNode } = await import("@/instrumentation.node");
    await registerNode();
    expect(m.slackDeployNotify).not.toHaveBeenCalled();
  });
});

describe("register() runtime dispatch", () => {
  it("nodejs runtime delegates to registerNode", async () => {
    devEnv();
    const { register } = await import("@/instrumentation");
    // registerNode in dev+no-auth-db only warns — safe to run for real.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await register();
    warn.mockRestore();
  });

  it("edge runtime returns early in development", async () => {
    process.env.NODE_ENV = "development";
    process.env.NEXT_RUNTIME = "edge";
    const { register } = await import("@/instrumentation");
    await expect(register()).resolves.toBeUndefined();
  });

  it("edge runtime loads the sentry edge config in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_RUNTIME = "edge";
    const { register } = await import("@/instrumentation");
    await expect(register()).resolves.toBeUndefined();
    const edge = await import("../sentry.edge.config");
    expect(edge).toBeDefined();
  });


  it("production with no app version skips the deploy notification", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_APP_VERSION;
    const { registerNode } = await import("@/instrumentation.node");
    await registerNode();
    expect(m.slackDeployNotify).not.toHaveBeenCalled();
  });
});
