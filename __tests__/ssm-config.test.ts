import { describe, it, expect, beforeEach } from "vitest";
import { getConfig, resetSsmCache } from "@/lib/ssm-config";

// NOTE: The project's .env.local provides real API keys for most integration
// env vars. Tests here only assert on:
//   - Structural shape (always safe)
//   - Code-level defaults for SENTRY_ORG/PROJECT (empty or absent in .env.local
//     so the || fallback to the code default always applies)
//   - GOOGLE_PRIVATE_KEY normalization behaviour (result must not contain literal \n)

describe("ssm-config.ts", () => {
  beforeEach(() => {
    resetSsmCache();
  });

  it("returns a defined config object in test environment (no SSM calls)", async () => {
    const cfg = await getConfig();
    expect(cfg).toBeDefined();
    expect(typeof cfg).toBe("object");
  });

  it("defaults SENTRY_ORG to baltzakisthemiscom", async () => {
    const cfg = await getConfig();
    // .env.local does not set SENTRY_ORG (or sets it empty), so the || fallback applies
    expect(cfg.SENTRY_ORG).toBe("baltzakisthemiscom");
  });

  it("defaults SENTRY_PROJECT to cloudless-gr", async () => {
    const cfg = await getConfig();
    expect(cfg.SENTRY_PROJECT).toBe("cloudless-gr");
  });

  it("GOOGLE_PRIVATE_KEY has no literal backslash-n sequences after normalization", async () => {
    const cfg = await getConfig();
    // buildConfigFromEnv applies .replace(/\\n/g, "\n") so no literal \n remains
    expect(cfg.GOOGLE_PRIVATE_KEY).not.toContain("\\n");
  });

  it("NOTION_CALENDAR_DB_ID and NOTION_REPORTS_DB_ID are string properties", async () => {
    const cfg = await getConfig();
    expect(typeof cfg.NOTION_CALENDAR_DB_ID).toBe("string");
    expect(typeof cfg.NOTION_REPORTS_DB_ID).toBe("string");
  });

  it("resetSsmCache() does not throw", () => {
    expect(() => resetSsmCache()).not.toThrow();
  });
});
