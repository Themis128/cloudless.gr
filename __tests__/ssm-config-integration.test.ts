import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Integration-style tests for src/lib/ssm-config.ts after the AWS SSM cutover.
 * Config is env/D1 only — LocalStack SSM seeding is no longer used.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("ssm-config (env / D1 — no AWS SSM)", () => {
  it("getConfig() reads from process.env", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SES_FROM_EMAIL", "noreply@cloudless.test");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_from_env_abc");
    vi.stubEnv("NOTION_API_KEY", "secret_test_notion");
    vi.stubEnv("AUTH_SECRET", "x".repeat(32));

    vi.resetModules();
    const { getConfig, resetSsmCache } = await import("@/lib/ssm-config");
    resetSsmCache();

    const cfg = await getConfig();
    expect(cfg.SES_FROM_EMAIL).toBe("noreply@cloudless.test");
    expect(cfg.STRIPE_SECRET_KEY).toMatch(/^sk_test_/);
    expect(cfg.NOTION_API_KEY).toMatch(/^secret_test_/);
    expect(cfg.AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it("getConfig() caches: second call returns same object reference", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SES_FROM_EMAIL", "cache@cloudless.test");
    vi.stubEnv("AUTH_SECRET", "y".repeat(32));

    vi.resetModules();
    const { getConfig, resetSsmCache } = await import("@/lib/ssm-config");
    resetSsmCache();

    const a = await getConfig();
    const b = await getConfig();
    expect(b).toBe(a); // identity, not just equality
  });

  it("resetSsmCache() forces rebuild on next call", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SES_FROM_EMAIL", "reset@cloudless.test");
    vi.stubEnv("AUTH_SECRET", "z".repeat(32));

    vi.resetModules();
    const { getConfig, resetSsmCache } = await import("@/lib/ssm-config");

    resetSsmCache();
    const a = await getConfig();
    resetSsmCache();
    const b = await getConfig();
    expect(b).not.toBe(a); // different object after cache reset
    expect(b.SES_FROM_EMAIL).toBe(a.SES_FROM_EMAIL); // but same content
  });

  it("uses env defaults when optional keys are unset", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SES_FROM_EMAIL", "envonly@cloudless.test");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_from_env");
    vi.stubEnv("AUTH_SECRET", "x".repeat(32));

    vi.resetModules();
    const { getConfig, resetSsmCache } = await import("@/lib/ssm-config");
    resetSsmCache();

    const cfg = await getConfig();
    expect(cfg.SES_FROM_EMAIL).toBe("envonly@cloudless.test");
    expect(cfg.STRIPE_SECRET_KEY).toBe("sk_test_from_env");
  });
});
