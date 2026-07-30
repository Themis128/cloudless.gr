import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AuthDatabase } from "@/lib/auth-d1";

function makeDb(rows: Array<Record<string, unknown>>): AuthDatabase {
  return {
    prepare(query: string) {
      const stmt = {
        bind() {
          return stmt;
        },
        async run() {
          return { success: true, meta: { changes: 0 } };
        },
        async all<T = Record<string, unknown>>() {
          if (query.includes("utm_source")) {
            return {
              results: [
                {
                  utm_source: "linkedin",
                  utm_medium: "cpc",
                  utm_campaign: "pilot",
                  sessions: 10,
                  signups: 2,
                  purchases: 1,
                  revenue: 49,
                },
              ] as T[],
              success: true,
            };
          }
          return { results: rows as T[], success: true };
        },
        async first() {
          return null;
        },
      };
      return stmt;
    },
  };
}

describe("getDatalakeDashboard Cloudflare-only", () => {
  beforeEach(() => {
    vi.resetModules();
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
    delete (globalThis as { __DATALAKE_BUCKET__?: unknown }).__DATALAKE_BUCKET__;
  });

  afterEach(() => {
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
    delete (globalThis as { __DATALAKE_BUCKET__?: unknown }).__DATALAKE_BUCKET__;
  });

  it("merges D1 acquisition/attribution with R2 snapshot sections", async () => {
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = makeDb([
      { day: "2026-07-28", sessions: 5, signups: 1, purchasers: 0, revenue: 0 },
    ]);
    (globalThis as {
      __DATALAKE_BUCKET__?: { get: (key: string) => Promise<unknown> };
    }).__DATALAKE_BUCKET__ = {
      get: async () => ({
        text: async () =>
          JSON.stringify({
            generated_at: "2026-07-29T10:00:00.000Z",
            cache: "cloudflare",
            sections: [
              {
                section: "top_keywords",
                rows: [{ query: "cloud greece", clicks: 12 }],
                rowCount: 1,
              },
              {
                section: "linkedin_ads",
                rows: [{ campaign: "x", spend: 1 }],
                rowCount: 1,
              },
              {
                section: "top_errors",
                rows: [{ title: "boom", count_14d: 3 }],
                rowCount: 1,
              },
              {
                section: "espocrm_funnel",
                rows: [{ lead_source: "web", contact_count: 4 }],
                rowCount: 1,
              },
              {
                section: "acquisition_funnel",
                error: "stale snapshot stub — should be ignored",
              },
            ],
          }),
      }),
    };

    const { getDatalakeDashboard } = await import("@/lib/datalake-r2");
    const payload = await getDatalakeDashboard({});
    expect(payload.cache).toBe("cloudflare");
    const keywords = payload.sections.find((s) => s.section === "top_keywords");
    expect(keywords?.rows?.[0]?.query).toBe("cloud greece");
    const acquisition = payload.sections.find((s) => s.section === "acquisition_funnel");
    expect(acquisition?.rows?.[0]?.sessions).toBe(5);
    const attribution = payload.sections.find((s) => s.section === "attribution");
    expect(attribution?.rows?.[0]?.utm_source).toBe("linkedin");
  });

  it("returns section errors when D1 and R2 are unbound", async () => {
    const { getDatalakeDashboard } = await import("@/lib/datalake-r2");
    const payload = await getDatalakeDashboard({});
    expect(payload.cache).toBe("cloudflare");
    for (const section of payload.sections) {
      expect(section.error).toContain("not available");
      expect(section.rows).toBeUndefined();
    }
  });
});
