import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAmplifyConfigureFn = vi.fn();

vi.mock("aws-amplify", () => ({
  Amplify: { configure: mockAmplifyConfigureFn },
}));

describe("amplify-config.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("configureAmplifyWith returns false when credentials are empty", async () => {
    const { configureAmplifyWith, isAmplifyConfigured } = await import("@/lib/amplify-config");
    expect(configureAmplifyWith({ userPoolId: "", userPoolClientId: "" })).toBe(false);
    expect(isAmplifyConfigured()).toBe(false);
    expect(mockAmplifyConfigureFn).not.toHaveBeenCalled();
  });

  it("configureAmplifyWith returns true and calls Amplify.configure once", async () => {
    const { configureAmplifyWith, isAmplifyConfigured } = await import("@/lib/amplify-config");

    expect(
      configureAmplifyWith({
        userPoolId: "us-east-1_TestPool",
        userPoolClientId: "test-client-id",
      })
    ).toBe(true);
    expect(isAmplifyConfigured()).toBe(true);
    expect(mockAmplifyConfigureFn).toHaveBeenCalledTimes(1);
    expect(mockAmplifyConfigureFn).toHaveBeenCalledWith(
      {
        Auth: {
          Cognito: {
            userPoolId: "us-east-1_TestPool",
            userPoolClientId: "test-client-id",
          },
        },
      },
      { ssr: true }
    );

    // Idempotent — repeated calls do not re-invoke Amplify.configure.
    expect(
      configureAmplifyWith({
        userPoolId: "us-east-1_TestPool",
        userPoolClientId: "test-client-id",
      })
    ).toBe(true);
    expect(mockAmplifyConfigureFn).toHaveBeenCalledTimes(1);
  });
});
