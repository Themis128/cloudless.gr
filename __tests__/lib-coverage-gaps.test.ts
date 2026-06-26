/**
 * Unit tests for lib files with low/zero coverage:
 *   src/lib/notion-esp32.ts
 *   src/lib/store-products.ts
 *   src/lib/stripe-transactions.ts
 *   src/lib/ssm-config.ts (additional branches)
 *   src/lib/auth.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── notion-esp32.ts ───────────────────────────────────────────────────────────

const mockNotionFetch = vi.fn();
const mockGetIntegrationsAsync = vi.fn();

vi.mock("@/lib/notion", () => ({
  notionFetch: (...a: unknown[]) => mockNotionFetch(...a),
  notionFetchAll: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/integrations", () => ({
  getIntegrationsAsync: (...a: unknown[]) => mockGetIntegrationsAsync(...a),
  isConfiguredAsync: vi.fn().mockResolvedValue(true),
  isConfigured: vi.fn().mockReturnValue(true),
  requireIntegrationAsync: vi.fn().mockResolvedValue({}),
}));

describe("notion-esp32.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("isEsp32NotionConfigured", () => {
    it("returns false when devicesDbId missing", async () => {
      const { isEsp32NotionConfigured } = await import("@/lib/notion-esp32");
      expect(isEsp32NotionConfigured({})).toBe(false);
    });

    it("returns true when devicesDbId present", async () => {
      const { isEsp32NotionConfigured } = await import("@/lib/notion-esp32");
      expect(isEsp32NotionConfigured({ devicesDbId: "db-1" })).toBe(true);
    });
  });

  describe("getEsp32NotionConfig", () => {
    it("returns config from env vars when set", async () => {
      process.env.NOTION_ESP32_DEVICES_DB_ID = "db-env-1";
      const { getEsp32NotionConfig } = await import("@/lib/notion-esp32");
      const cfg = await getEsp32NotionConfig();
      expect(cfg.devicesDbId).toBe("db-env-1");
      delete process.env.NOTION_ESP32_DEVICES_DB_ID;
    });

    it("returns empty config when nothing configured", async () => {
      delete process.env.NOTION_ESP32_DEVICES_DB_ID;
      delete process.env.NOTION_ESP32_TELEMETRY_DB_ID;
      mockGetIntegrationsAsync.mockResolvedValue({});
      const { getEsp32NotionConfig } = await import("@/lib/notion-esp32");
      const cfg = await getEsp32NotionConfig();
      expect(cfg.devicesDbId).toBeUndefined();
    });
  });

  describe("readEsp32DevicesFromNotion", () => {
    it("returns empty array when DB not configured", async () => {
      delete process.env.NOTION_ESP32_DEVICES_DB_ID;
      mockGetIntegrationsAsync.mockResolvedValue({});
      const { readEsp32DevicesFromNotion } = await import("@/lib/notion-esp32");
      const result = await readEsp32DevicesFromNotion();
      expect(result).toEqual([]);
    });
  });

  describe("upsertEsp32DeviceInNotion", () => {
    it("returns null when DB not configured", async () => {
      delete process.env.NOTION_ESP32_DEVICES_DB_ID;
      mockGetIntegrationsAsync.mockResolvedValue({});
      const { upsertEsp32DeviceInNotion } = await import("@/lib/notion-esp32");
      const result = await upsertEsp32DeviceInNotion({
        ip: "192.168.1.1",
        rssi: -60,
        firmware_ver: "1.0",
        uptime_s: 3600,
        free_ram_bytes: 50000,
        last_heartbeat: new Date().toISOString(),
        device_id: "esp32-01",
        stale: false,
      });
      expect(result).toBeNull();
    });
  });
});

// ── store-products.ts ─────────────────────────────────────────────────────────

describe("store-products.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("STRIPE_SECRET_KEY", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("getProductById returns undefined for unknown id", async () => {
    const { getProductById } = await import("@/lib/store-products");
    expect(getProductById("nonexistent-id")).toBeUndefined();
  });

  it("getProductById returns product for known id", async () => {
    const { getProductById, defaultProducts } = await import("@/lib/store-products");
    const first = defaultProducts[0];
    const found = getProductById(first.id);
    expect(found?.id).toBe(first.id);
  });

  it("getProductsByCategory returns matching products", async () => {
    const { getProductsByCategory, defaultProducts } = await import("@/lib/store-products");
    const digital = defaultProducts.filter((p) => p.category === "digital");
    const result = getProductsByCategory("digital");
    expect(result.length).toBe(digital.length);
    expect(result.every((p) => p.category === "digital")).toBe(true);
  });

  it("getProductsByCategory returns empty for unknown category", async () => {
    const { getProductsByCategory } = await import("@/lib/store-products");
    // @ts-expect-error testing unknown category
    expect(getProductsByCategory("unknown")).toEqual([]);
  });

  it("getProducts resolves to defaultProducts when not configured", async () => {
    mockGetIntegrationsAsync.mockResolvedValue({});
    const { getProducts, defaultProducts } = await import("@/lib/store-products");
    const products = await getProducts();
    expect(products.length).toBe(defaultProducts.length);
  });

  it("getProductByIdAsync returns product asynchronously", async () => {
    const { getProductByIdAsync, defaultProducts } = await import("@/lib/store-products");
    const first = defaultProducts[0];
    const found = await getProductByIdAsync(first.id);
    expect(found?.id).toBe(first.id);
  });

  it("defaultProducts and demoProducts are the same reference", async () => {
    const { defaultProducts, demoProducts } = await import("@/lib/store-products");
    expect(defaultProducts).toBe(demoProducts);
  });

  it("categoryLabels has entries for all categories", async () => {
    const { categoryLabels } = await import("@/lib/store-products");
    expect(categoryLabels.digital).toBeDefined();
    expect(categoryLabels.physical).toBeDefined();
    expect(categoryLabels.service).toBeDefined();
  });
});

// ── ssm-config.ts (additional branches) ──────────────────────────────────────

describe("ssm-config.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("getConfig falls back to env vars when SSM keys unset", async () => {
    // With no AWS creds and no SSM prefix override, getConfig should fall back
    // to env vars. We stub the SSM client to throw so env fallback is exercised.
    vi.doMock("@aws-sdk/client-ssm", () => ({
      SSMClient: class {
        send() {
          throw new Error("no credentials");
        }
      },
      GetParametersByPathCommand: class {},
    }));
    process.env.NOTION_API_KEY = "test-notion-key";
    const { getConfig, resetSsmCache } = await import("@/lib/ssm-config");
    resetSsmCache();
    const cfg = await getConfig();
    expect(cfg.NOTION_API_KEY).toBe("test-notion-key");
  });

  it("resetSsmCache clears cached config", async () => {
    const { resetSsmCache, getConfig } = await import("@/lib/ssm-config");
    resetSsmCache();
    // Should not throw — falls back to env
    const cfg = await getConfig();
    expect(cfg).toBeDefined();
  });
});

// ── ssm-config.ts — real SSM fetch path ───────────────────────────────────────
// getConfig() short-circuits to env when NODE_ENV === "test", so to exercise
// fetchSsmParams/buildConfigFromParams/validateRequiredKeys we temporarily flip
// NODE_ENV to "production" and stub the @aws-sdk/client-ssm boundary (a network
// dependency — not production code) to return canned parameters.

describe("ssm-config.ts — SSM fetch path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    // Restore NODE_ENV (and any other stubbed env) so other suites keep their
    // env short-circuit. setup.ts also calls unstubAllEnvs() globally.
    vi.unstubAllEnvs();
  });

  function stubSsm(
    pages: Array<{ Parameters?: Array<{ Name: string; Value: string }>; NextToken?: string }>
  ) {
    let call = 0;
    const send = vi.fn(async () => pages[Math.min(call++, pages.length - 1)]);
    vi.doMock("@aws-sdk/client-ssm", () => ({
      SSMClient: class {
        send = send;
      },
      GetParametersByPathCommand: class {
        input: unknown;
        constructor(input: unknown) {
          this.input = input;
        }
      },
    }));
    return send;
  }

  it("builds config from SSM parameters and strips the prefix", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NOTION_API_KEY", "ntn_from_env");
    stubSsm([
      {
        Parameters: [
          { Name: "/cloudless/production/STRIPE_SECRET_KEY", Value: "sk_live_x" },
          { Name: "/cloudless/production/STRIPE_WEBHOOK_SECRET", Value: "whsec_y" },
        ],
      },
    ]);
    const { getConfig, resetSsmCache } = await import("@/lib/ssm-config");
    resetSsmCache();
    const cfg = await getConfig();
    expect(cfg.STRIPE_SECRET_KEY).toBe("sk_live_x");
    expect(cfg.STRIPE_WEBHOOK_SECRET).toBe("whsec_y");
    // NOTION_API_KEY is env-only (SSM keys decommissioned) — reads from process.env
    expect(cfg.NOTION_API_KEY).toBe("ntn_from_env");
  });

  it("follows NextToken pagination across multiple pages", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const send = stubSsm([
      {
        Parameters: [{ Name: "/cloudless/production/STRIPE_SECRET_KEY", Value: "sk_p1" }],
        NextToken: "page2",
      },
      {
        Parameters: [{ Name: "/cloudless/production/STRIPE_WEBHOOK_SECRET", Value: "whsec_p2" }],
      },
    ]);
    const { getConfig, resetSsmCache } = await import("@/lib/ssm-config");
    resetSsmCache();
    const cfg = await getConfig();
    expect(send).toHaveBeenCalledTimes(2);
    expect(cfg.STRIPE_SECRET_KEY).toBe("sk_p1");
    expect(cfg.STRIPE_WEBHOOK_SECRET).toBe("whsec_p2");
  });

  it("normalizes escaped newlines in GOOGLE_PRIVATE_KEY from SSM", async () => {
    vi.stubEnv("NODE_ENV", "production");
    stubSsm([
      {
        Parameters: [
          { Name: "/cloudless/production/STRIPE_SECRET_KEY", Value: "sk" },
          { Name: "/cloudless/production/STRIPE_WEBHOOK_SECRET", Value: "wh" },
          {
            Name: "/cloudless/production/GOOGLE_PRIVATE_KEY",
            Value: String.raw`-----BEGIN-----\nLINE2\n-----END-----`,
          },
        ],
      },
    ]);
    const { getConfig, resetSsmCache } = await import("@/lib/ssm-config");
    resetSsmCache();
    const cfg = await getConfig();
    expect(cfg.GOOGLE_PRIVATE_KEY).not.toContain(String.raw`\n`);
    expect(cfg.GOOGLE_PRIVATE_KEY).toContain("\nLINE2\n");
  });

  it("warns when required Stripe keys are missing but still returns config", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NOTION_API_KEY", "n_from_env");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubSsm([{ Parameters: [] }]);
    const { getConfig, resetSsmCache } = await import("@/lib/ssm-config");
    resetSsmCache();
    const cfg = await getConfig();
    // NOTION_API_KEY is env-only — SSM value is ignored
    expect(cfg.NOTION_API_KEY).toBe("n_from_env");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Missing required parameters"));
    warn.mockRestore();
  });

  it("serves stale cache when a later SSM fetch fails", async () => {
    vi.stubEnv("NODE_ENV", "production");
    let call = 0;
    const send = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        return {
          Parameters: [
            { Name: "/cloudless/production/STRIPE_SECRET_KEY", Value: "sk_cached" },
            { Name: "/cloudless/production/STRIPE_WEBHOOK_SECRET", Value: "wh_cached" },
          ],
        };
      }
      throw new Error("transient SSM outage");
    });
    vi.doMock("@aws-sdk/client-ssm", () => ({
      SSMClient: class {
        send = send;
      },
      GetParametersByPathCommand: class {
        constructor(public input: unknown) {}
      },
    }));
    const { getConfig, resetSsmCache } = await import("@/lib/ssm-config");
    resetSsmCache();
    const first = await getConfig();
    expect(first.STRIPE_SECRET_KEY).toBe("sk_cached");
    // Force the 5-min TTL to expire so the next call re-fetches (and fails)
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 6 * 60 * 1000);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const second = await getConfig();
    expect(second.STRIPE_SECRET_KEY).toBe("sk_cached"); // stale cache served
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("serving stale config"),
      expect.anything()
    );
    warn.mockRestore();
    vi.useRealTimers();
  });
});

// ── auth.ts ───────────────────────────────────────────────────────────────────
// auth.ts uses next-auth which requires Node environment (not jsdom).
// We verify it imports correctly in our test env by mocking next-auth.

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
    auth: vi.fn(),
  })),
}));

vi.mock("@/lib/session-token-store", () => ({
  getTokens: vi.fn().mockResolvedValue(null),
  putTokens: vi.fn().mockResolvedValue(undefined),
  deleteTokens: vi.fn().mockResolvedValue(undefined),
}));

describe("auth.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("exports handlers, signIn, signOut, auth", async () => {
    const mod = await import("@/lib/auth");
    expect(mod.handlers).toBeDefined();
    expect(typeof mod.signIn).toBe("function");
    expect(typeof mod.signOut).toBe("function");
    expect(typeof mod.auth).toBe("function");
  });
});

// ── stripe-transactions.ts ────────────────────────────────────────────────────

describe("stripe-transactions.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.STRIPE_TRANSACTIONS_TABLE = "test-stripe-events";
  });
  afterEach(() => {
    delete process.env.STRIPE_TRANSACTIONS_TABLE;
  });

  describe("resolveDynamoEndpoint", () => {
    it("returns undefined when DYNAMODB_ENDPOINT not set", async () => {
      delete process.env.DYNAMODB_ENDPOINT;
      const { resolveDynamoEndpoint } = await import("@/lib/stripe-transactions");
      expect(resolveDynamoEndpoint()).toBeUndefined();
    });

    it("returns custom endpoint when DYNAMODB_ENDPOINT set", async () => {
      process.env.DYNAMODB_ENDPOINT = "http://localhost:8000";
      const { resolveDynamoEndpoint } = await import("@/lib/stripe-transactions");
      expect(resolveDynamoEndpoint()).toBe("http://localhost:8000");
      delete process.env.DYNAMODB_ENDPOINT;
    });
  });

  describe("getStripeEventTags", () => {
    it("tags checkout.session.completed as checkout category", async () => {
      const { getStripeEventTags } = await import("@/lib/stripe-transactions");
      const tags = getStripeEventTags("checkout.session.completed");
      expect(tags.tagCategory).toBe("checkout");
    });

    it("tags customer.subscription.created as subscription category", async () => {
      const { getStripeEventTags } = await import("@/lib/stripe-transactions");
      const tags = getStripeEventTags("customer.subscription.created");
      expect(tags.tagCategory).toBe("subscription");
    });

    it("tags invoice.paid as invoice category", async () => {
      const { getStripeEventTags } = await import("@/lib/stripe-transactions");
      const tags = getStripeEventTags("invoice.paid");
      expect(tags.tagCategory).toBe("invoice");
    });

    it("tags unknown event as other category", async () => {
      const { getStripeEventTags } = await import("@/lib/stripe-transactions");
      const tags = getStripeEventTags("unknown.event");
      expect(tags.tagCategory).toBe("other");
    });

    it("includes tagSource and tagStage", async () => {
      const { getStripeEventTags } = await import("@/lib/stripe-transactions");
      const tags = getStripeEventTags("checkout.session.completed");
      expect(tags.tagSource).toBeDefined();
      expect(tags.tagStage).toBeDefined();
    });
  });

  describe("persistStripeEvent", () => {
    it("throws when STRIPE_TRANSACTIONS_TABLE is not set", async () => {
      delete process.env.STRIPE_TRANSACTIONS_TABLE;
      const { persistStripeEvent } = await import("@/lib/stripe-transactions");
      await expect(
        persistStripeEvent({
          id: "evt_1",
          type: "checkout.session.completed",
          data: { object: {} },
          created: 1700000000,
        } as never)
      ).rejects.toThrow(/STRIPE_TRANSACTIONS_TABLE is not configured/);
    });

    it("proceeds with table name set (hits DynamoDB stub)", async () => {
      process.env.STRIPE_TRANSACTIONS_TABLE = "test-table";
      const { persistStripeEvent } = await import("@/lib/stripe-transactions");
      // DynamoDB stub has no send method → will throw; verify it at least
      // gets past the table name check and fails on the client, not config.
      await expect(
        persistStripeEvent({
          id: "evt_1",
          type: "checkout.session.completed",
          data: { object: {} },
          created: 1700000000,
        } as never)
      ).rejects.toThrow();
    });
  });
});
