import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * getIntegrationsAsync() merges process.env with the D1 app_config table key
 * by key. A typo in any one mapping (e.g. reading d1cfg.FOO into BAR) silently
 * breaks that integration in production, where most secrets live only in D1.
 * These tests drive every key through all three outcomes — env wins, D1 fills
 * a missing env value, neither is set — so each mapping is pinned.
 *
 * The only fake is the `@/lib/ssm-config` boundary (D1).
 */

const mockGetConfig = vi.fn();
vi.mock("@/lib/ssm-config", () => ({
  getConfig: (...a: unknown[]) => mockGetConfig(...a),
}));

import {
  getIntegrationsAsync,
  getSlackConfig,
  getSlackConfigAsync,
  resetIntegrationCache,
  type IntegrationConfig,
} from "@/lib/integrations";

// Every key getIntegrationsAsync() returns. Keep in sync with IntegrationConfig;
// the "covers every key" test below fails if a key is added without a mapping.
const KEYS = [
  "SLACK_WEBHOOK_URL",
  "SLACK_BOT_TOKEN",
  "SLACK_SIGNING_SECRET",
  "NOTION_API_KEY",
  "NOTION_BLOG_DB_ID",
  "NOTION_SUBMISSIONS_DB_ID",
  "NOTION_DOCS_DB_ID",
  "NOTION_PROJECTS_DB_ID",
  "NOTION_TASKS_DB_ID",
  "NOTION_CALENDAR_DB_ID",
  "NOTION_TESTIMONIALS_DB_ID",
  "NOTION_CASE_STUDIES_DB_ID",
  "NOTION_SERVICES_DB_ID",
  "NOTION_FAQS_DB_ID",
  "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_CALENDAR_ID",
  "STRIPE_SECRET_KEY",
  "SENTRY_AUTH_TOKEN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
  "NOTION_WEBHOOK_SECRET",
  "ACTIVECAMPAIGN_API_URL",
  "ACTIVECAMPAIGN_API_TOKEN",
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "GOOGLE_ADS_CUSTOMER_ID",
  "LINKEDIN_CLIENT_ID",
  "LINKEDIN_CLIENT_SECRET",
  "LINKEDIN_ACCESS_TOKEN",
  "LINKEDIN_AD_ACCOUNT_ID",
  "LINKEDIN_ORGANIZATION_URN",
  "TIKTOK_APP_ID",
  "TIKTOK_APP_SECRET",
  "TIKTOK_ACCESS_TOKEN",
  "TIKTOK_ADVERTISER_ID",
  "X_API_KEY",
  "X_API_SECRET",
  "X_ACCESS_TOKEN",
  "X_ACCESS_SECRET",
  "X_AD_ACCOUNT_ID",
  "META_AD_ACCOUNT_ID",
  "META_PIXEL_ID",
  "META_CAPI_ACCESS_TOKEN",
  "META_ACCESS_TOKEN",
  "META_PAGE_ID",
  "ANTHROPIC_API_KEY",
  "ESPOCRM_BASE_URL",
  "ESPOCRM_API_KEY",
  "ESPOCRM_WEBHOOK_SECRET",
  "APPFLOWY_API_URL",
  "APPFLOWY_JWT_SECRET",
  "N8N_API_URL",
  "N8N_API_KEY",
  "POSTIZ_API_URL",
  "POSTIZ_API_KEY",
  "CAL_API_KEY",
] as const satisfies readonly (keyof IntegrationConfig)[];

/** Blank every integration env var ("" is falsy, so the D1 arm is taken). */
function blankEnv(): void {
  for (const k of KEYS) vi.stubEnv(k, "");
  vi.stubEnv("SLACK_DEFAULT_CHANNEL", "");
}

function d1Record(prefix: string): Record<string, string> {
  return Object.fromEntries([...KEYS, "SLACK_DEFAULT_CHANNEL"].map((k) => [k, `${prefix}-${k}`]));
}

describe("getIntegrationsAsync — env/D1 merge for every key", () => {
  beforeEach(() => {
    mockGetConfig.mockReset();
    resetIntegrationCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetIntegrationCache();
  });

  it("returns exactly the expected key set", async () => {
    blankEnv();
    mockGetConfig.mockResolvedValue({});
    const cfg = await getIntegrationsAsync();
    expect(Object.keys(cfg).sort()).toEqual([...KEYS].sort());
  });

  it("fills every missing env value from the matching D1 key", async () => {
    blankEnv();
    mockGetConfig.mockResolvedValue(d1Record("d1"));
    const cfg = await getIntegrationsAsync();

    for (const k of KEYS) {
      // GOOGLE_SERVICE_ACCOUNT_EMAIL deliberately falls back to the D1
      // GOOGLE_CLIENT_EMAIL (there is no separate D1 key for it).
      const expected = k === "GOOGLE_SERVICE_ACCOUNT_EMAIL" ? "d1-GOOGLE_CLIENT_EMAIL" : `d1-${k}`;
      expect(cfg[k], k).toBe(expected);
    }
  });

  it("prefers env values over D1 for every key", async () => {
    for (const k of KEYS) vi.stubEnv(k, `env-${k}`);
    mockGetConfig.mockResolvedValue(d1Record("d1"));
    const cfg = await getIntegrationsAsync();

    for (const k of KEYS) expect(cfg[k], k).toBe(`env-${k}`);
  });

  it("leaves keys undefined when neither env nor D1 has them, keeping Sentry defaults", async () => {
    blankEnv();
    mockGetConfig.mockResolvedValue({});
    const cfg = await getIntegrationsAsync();

    expect(cfg.SENTRY_ORG).toBe("baltzakisthemiscom");
    expect(cfg.SENTRY_PROJECT).toBe("cloudless-gr");
    for (const k of KEYS) {
      if (k === "SENTRY_ORG" || k === "SENTRY_PROJECT") continue;
      expect(cfg[k], k).toBeUndefined();
    }
  });

  it("serves the merged config from cache until the cache is reset", async () => {
    blankEnv();
    mockGetConfig.mockResolvedValue(d1Record("first"));
    const a = await getIntegrationsAsync();
    mockGetConfig.mockResolvedValue(d1Record("second"));
    const b = await getIntegrationsAsync();
    expect(b).toBe(a);
    expect(mockGetConfig).toHaveBeenCalledTimes(1);

    resetIntegrationCache();
    const c = await getIntegrationsAsync();
    expect(c.STRIPE_SECRET_KEY).toBe("second-STRIPE_SECRET_KEY");
  });
});

describe("Slack config helpers — fallback edges", () => {
  beforeEach(() => {
    mockGetConfig.mockReset();
    resetIntegrationCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetIntegrationCache();
  });

  it("getSlackConfig returns empty strings and warns when nothing is configured", () => {
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_SIGNING_SECRET;
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.SLACK_DEFAULT_CHANNEL;
    // vi.stubEnv restores originals in afterEach; register them first.
    vi.stubEnv("SLACK_BOT_TOKEN", undefined as unknown as string);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(getSlackConfig()).toEqual({
      SLACK_BOT_TOKEN: "",
      SLACK_SIGNING_SECRET: "",
      SLACK_WEBHOOK_URL: "",
      SLACK_DEFAULT_CHANNEL: "",
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Neither SLACK_BOT_TOKEN"));
  });

  it("getSlackConfigAsync skips D1 entirely when signing secret and channel are in env", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "xoxb-env");
    vi.stubEnv("SLACK_SIGNING_SECRET", "env-secret");
    vi.stubEnv("SLACK_DEFAULT_CHANNEL", "#env-channel");

    const cfg = await getSlackConfigAsync();
    expect(mockGetConfig).not.toHaveBeenCalled();
    expect(cfg.SLACK_SIGNING_SECRET).toBe("env-secret");
    expect(cfg.SLACK_DEFAULT_CHANNEL).toBe("#env-channel");
  });

  it("getSlackConfigAsync fills every missing Slack value from D1", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "");
    vi.stubEnv("SLACK_SIGNING_SECRET", "");
    vi.stubEnv("SLACK_WEBHOOK_URL", "");
    vi.stubEnv("SLACK_DEFAULT_CHANNEL", "");
    mockGetConfig.mockResolvedValue(d1Record("d1"));

    expect(await getSlackConfigAsync()).toEqual({
      SLACK_BOT_TOKEN: "d1-SLACK_BOT_TOKEN",
      SLACK_SIGNING_SECRET: "d1-SLACK_SIGNING_SECRET",
      SLACK_WEBHOOK_URL: "d1-SLACK_WEBHOOK_URL",
      SLACK_DEFAULT_CHANNEL: "d1-SLACK_DEFAULT_CHANNEL",
    });
  });

  it("getSlackConfigAsync returns empty strings and warns when D1 lacks the Slack keys", async () => {
    vi.stubEnv("SLACK_BOT_TOKEN", "");
    vi.stubEnv("SLACK_SIGNING_SECRET", "");
    vi.stubEnv("SLACK_WEBHOOK_URL", "");
    vi.stubEnv("SLACK_DEFAULT_CHANNEL", "");
    mockGetConfig.mockResolvedValue({});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await getSlackConfigAsync()).toEqual({
      SLACK_BOT_TOKEN: "",
      SLACK_SIGNING_SECRET: "",
      SLACK_WEBHOOK_URL: "",
      SLACK_DEFAULT_CHANNEL: "",
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Neither SLACK_BOT_TOKEN"));
  });
});
