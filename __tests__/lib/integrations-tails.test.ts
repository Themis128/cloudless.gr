import { describe, it, expect, vi } from "vitest";

/**
 * Tail coverage for src/lib/integrations.ts — the D1-fallback catch paths
 * and requireIntegrationAsync's two failure modes. The only fake is the
 * `@/lib/ssm-config` boundary (D1); all env merge + guard logic runs for real.
 */

const mockGetConfig = vi.fn();
vi.mock("@/lib/ssm-config", () => ({
  getConfig: (...a: unknown[]) => mockGetConfig(...a),
}));

import {
  getIntegrationsAsync,
  requireIntegrationAsync,
  getSlackConfigAsync,
  IntegrationNotConfiguredError,
} from "@/lib/integrations";

describe("integrations.ts tails", () => {
  it("getIntegrationsAsync falls back to env-only config when the D1 lookup throws", async () => {
    mockGetConfig.mockRejectedValue(new Error("d1 down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cfg = await getIntegrationsAsync();
    expect(cfg.SLACK_BOT_TOKEN).toBe("xoxb-test-token");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("D1 config fallback failed"),
      expect.any(Error)
    );
    warn.mockRestore();
  });

  it("requireIntegrationAsync throws on an explicitly-empty env var without an SSM round-trip", async () => {
    vi.stubEnv("POSTIZ_API_KEY", "");
    await expect(requireIntegrationAsync("POSTIZ_API_KEY")).rejects.toBeInstanceOf(
      IntegrationNotConfiguredError
    );
    await expect(requireIntegrationAsync("POSTIZ_API_KEY")).rejects.toMatchObject({
      name: "IntegrationNotConfiguredError",
    });
    expect(mockGetConfig).not.toHaveBeenCalled();
  });

  it("requireIntegrationAsync throws listing keys missing from env and D1", async () => {
    mockGetConfig.mockResolvedValue({});
    vi.stubEnv("POSTIZ_API_KEY", "");
    delete process.env.POSTIZ_API_URL;
    await expect(requireIntegrationAsync("POSTIZ_API_URL", "POSTIZ_API_KEY")).rejects.toBeInstanceOf(
      IntegrationNotConfiguredError
    );
  });

  it("getSlackConfigAsync tolerates a failing D1 fallback and keeps env values", async () => {
    mockGetConfig.mockRejectedValue(new Error("d1 down"));
    delete process.env.SLACK_DEFAULT_CHANNEL;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cfg = await getSlackConfigAsync();
    expect(cfg.SLACK_BOT_TOKEN).toBe("xoxb-test-token");
    expect(cfg.SLACK_SIGNING_SECRET).toBe("test-signing-secret-32chars-padded");
    expect(cfg.SLACK_DEFAULT_CHANNEL).toBe("");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[Slack] D1 config fallback failed"),
      expect.any(Error)
    );
    warn.mockRestore();
  });
});
