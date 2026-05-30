import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAmplifyConfigureFn = vi.fn();

vi.mock("aws-amplify", () => ({
  Amplify: { configure: mockAmplifyConfigureFn },
}));

describe("amplify-config.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
    delete process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  });

  it("configureAmplify resolves false when env vars are missing", async () => {
    const { configureAmplify } = await import("@/lib/amplify-config");
    await expect(configureAmplify()).resolves.toBe(false);
  });

  it("configureAmplify resolves true when both env vars are set", async () => {
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID = "us-east-1_TestPool";
    process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID = "test-client-id";

    vi.resetModules();
    const { configureAmplify } = await import("@/lib/amplify-config");
    await expect(configureAmplify()).resolves.toBe(true);
    expect(mockAmplifyConfigureFn).toHaveBeenCalledTimes(1);
  });
});
