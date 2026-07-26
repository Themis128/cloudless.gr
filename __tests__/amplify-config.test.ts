/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ENV_KEY = "NEXT_PUBLIC_AUTH_PROVIDER";

describe("amplify-config", () => {
  const originalEnv = process.env[ENV_KEY];

  beforeEach(() => {
    delete process.env[ENV_KEY];
    // Force a fresh module import each test so the module-scoped
    // `configured` flag does not bleed across cases.
    vi.resetModules();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalEnv;
    }
  });

  it("configureAmplifyWith returns false when no provider env is set", async () => {
    const mod = await import("@/lib/amplify-config");
    expect(
      mod.configureAmplifyWith({
        userPoolId: "us-east-1_xxxxx",
        userPoolClientId: "abc",
      })
    ).toBe(false);
    expect(mod.isAmplifyConfigured()).toBe(false);
  });

  it("configureAmplifyWith returns true once provider env is set", async () => {
    process.env[ENV_KEY] = "cognito";
    const mod = await import("@/lib/amplify-config");
    expect(
      mod.configureAmplifyWith({
        userPoolId: "us-east-1_xxxxx",
        userPoolClientId: "abc",
      })
    ).toBe(true);
    expect(mod.isAmplifyConfigured()).toBe(true);
  });

  it("subsequent calls short-circuit (cached configured flag)", async () => {
    process.env[ENV_KEY] = "cognito";
    const mod = await import("@/lib/amplify-config");
    expect(
      mod.configureAmplifyWith({
        userPoolId: "us-east-1_a",
        userPoolClientId: "client-a",
      })
    ).toBe(true);

    // Removing the env var after first configure should NOT flip the
    // cached flag — that's the documented short-circuit behaviour.
    delete process.env[ENV_KEY];
    expect(
      mod.configureAmplifyWith({
        userPoolId: "us-east-1_b",
        userPoolClientId: "client-b",
      })
    ).toBe(true);
    expect(mod.isAmplifyConfigured()).toBe(true);
  });
});
