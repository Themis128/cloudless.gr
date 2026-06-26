import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for src/lib/ssm-config.ts that hit a real SSM endpoint
 * (LocalStack in CI). Skipped automatically when LocalStack isn't reachable —
 * developers running the full Vitest suite locally won't see failures.
 *
 * The lib short-circuits on NODE_ENV=test, so each test sets NODE_ENV=
 * "production" via vi.stubEnv before importing the module fresh.
 */

const LOCALSTACK_URL = process.env.AWS_ENDPOINT_URL ?? "http://localhost:4566";

async function localstackUp(): Promise<boolean> {
  try {
    const res = await fetch(`${LOCALSTACK_URL}/_localstack/health`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

let skipAll = false;
beforeAll(async () => {
  skipAll = !(await localstackUp());
  if (skipAll) {
    console.warn(
      `[ssm-config-integration] LocalStack not reachable at ${LOCALSTACK_URL} — skipping.`
    );
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("ssm-config integration (LocalStack)", () => {
  it("getConfig() reads seeded params from real SSM", async ({ skip }) => {
    if (skipAll) return skip();

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SSM_DISABLED", "");
    vi.stubEnv("SSM_PREFIX", process.env.SSM_PREFIX ?? "/cloudless/test");
    vi.stubEnv("AWS_REGION", "us-east-1");
    // NOTION_API_KEY is env-only (SSM keys decommissioned) — seed it via env
    vi.stubEnv("NOTION_API_KEY", "secret_test_from_env");

    vi.resetModules();
    const { getConfig, resetSsmCache } = await import("@/lib/ssm-config");
    resetSsmCache();

    const cfg = await getConfig();
    expect(cfg.SES_FROM_EMAIL).toBe("noreply@cloudless.test");
    expect(cfg.STRIPE_SECRET_KEY).toMatch(/^sk_test_/);
    expect(cfg.NOTION_API_KEY).toMatch(/^secret_test_/);
    expect(cfg.AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it("getConfig() caches: second call returns same object reference", async ({ skip }) => {
    if (skipAll) return skip();

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SSM_PREFIX", process.env.SSM_PREFIX ?? "/cloudless/test");

    vi.resetModules();
    const { getConfig, resetSsmCache } = await import("@/lib/ssm-config");
    resetSsmCache();

    const a = await getConfig();
    const b = await getConfig();
    expect(b).toBe(a); // identity, not just equality
  });

  it("resetSsmCache() forces re-fetch on next call", async ({ skip }) => {
    if (skipAll) return skip();

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SSM_PREFIX", process.env.SSM_PREFIX ?? "/cloudless/test");

    vi.resetModules();
    const { getConfig, resetSsmCache } = await import("@/lib/ssm-config");

    resetSsmCache();
    const a = await getConfig();
    resetSsmCache();
    const b = await getConfig();
    expect(b).not.toBe(a); // different object after cache reset
    expect(b.SES_FROM_EMAIL).toBe(a.SES_FROM_EMAIL); // but same content
  });

  it("falls back to env when SSM endpoint unreachable in dev", async ({ skip }) => {
    if (skipAll) return skip();

    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AWS_ENDPOINT_URL", "http://localhost:1"); // closed port
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
