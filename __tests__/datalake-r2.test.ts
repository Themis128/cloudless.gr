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
          if (query.includes("utm_source") || query.includes("source,")) {
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

function goldSnapshotPayload() {
  return {
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
        rows: [{ campaign_name: "x", spend: 1 }],
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
        section: "stripe_revenue",
        rows: [{ metric: "paid_orders", value: 2, amount_eur: 98 }],
        rowCount: 1,
      },
      {
        section: "n8n_ops",
        rows: [{ metric: "workflows_total", value: 5 }],
        rowCount: 1,
      },
      {
        section: "postiz_ops",
        rows: [{ metric: "posts_sampled", value: 3 }],
        rowCount: 1,
      },
      {
        section: "appflowy_activity",
        rows: [{ metric: "workspaces", value: 2 }],
        rowCount: 1,
      },
      {
        section: "freshness",
        rows: [{ source: "lake/gsc-keywords/keywords.parquet", exists: 1 }],
        rowCount: 1,
      },
      {
        section: "acquisition_funnel",
        error: "stale snapshot stub — hot D1 should override",
      },
    ],
    freshness: {
      generated_at: "2026-07-29T10:00:00.000Z",
      sources: {
        "lake/gsc-keywords/keywords.parquet": {
          exists: true,
          last_etl_at: "2026-07-29T09:00:00.000Z",
          size: 100,
        },
      },
    },
  };
}

describe("getDatalakeDashboard gold serving", () => {
  beforeEach(() => {
    vi.resetModules();
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
    delete (globalThis as { __DATALAKE_BUCKET__?: unknown }).__DATALAKE_BUCKET__;
  });

  afterEach(() => {
    delete (globalThis as { __AUTH_DB__?: unknown }).__AUTH_DB__;
    delete (globalThis as { __DATALAKE_BUCKET__?: unknown }).__DATALAKE_BUCKET__;
  });

  it("loads full gold sections and overlays hot D1 funnel", async () => {
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = makeDb([
      { day: "2026-07-28", sessions: 5, signups: 1, purchasers: 0, revenue: 0 },
    ]);
    (
      globalThis as {
        __DATALAKE_BUCKET__?: { get: (key: string) => Promise<unknown> };
      }
    ).__DATALAKE_BUCKET__ = {
      get: async () => ({
        text: async () => JSON.stringify(goldSnapshotPayload()),
      }),
    };

    const { getDatalakeDashboard, SECTION_ORDER } = await import("@/lib/datalake-r2");
    const payload = await getDatalakeDashboard({});
    expect(payload.cache).toBe("cloudflare");
    expect(payload.source).toBe("gold");
    expect(payload.freshness?.sources?.["lake/gsc-keywords/keywords.parquet"]?.exists).toBe(true);
    expect(payload.sections.map((s) => s.section)).toEqual([...SECTION_ORDER]);

    expect(payload.sections.find((s) => s.section === "top_keywords")?.rows?.[0]?.query).toBe(
      "cloud greece"
    );
    expect(payload.sections.find((s) => s.section === "stripe_revenue")?.rows?.[0]?.metric).toBe(
      "paid_orders"
    );
    expect(payload.sections.find((s) => s.section === "n8n_ops")?.rows?.[0]?.value).toBe(5);
    expect(payload.sections.find((s) => s.section === "postiz_ops")?.rows?.[0]?.value).toBe(3);
    expect(payload.sections.find((s) => s.section === "appflowy_activity")?.rows?.[0]?.value).toBe(
      2
    );
    expect(payload.sections.find((s) => s.section === "freshness")?.rows?.[0]?.exists).toBe(1);

    const acquisition = payload.sections.find((s) => s.section === "acquisition_funnel");
    expect(acquisition?.rows?.[0]?.sessions).toBe(5);
    expect(acquisition?.error).toBeUndefined();
    const attribution = payload.sections.find((s) => s.section === "attribution");
    expect(attribution?.rows?.[0]?.utm_source).toBe("linkedin");
  });

  it("refresh still reads gold (does not skip snapshot)", async () => {
    (
      globalThis as {
        __DATALAKE_BUCKET__?: { get: (key: string) => Promise<unknown> };
      }
    ).__DATALAKE_BUCKET__ = {
      get: async () => ({
        text: async () => JSON.stringify(goldSnapshotPayload()),
      }),
    };

    const { getDatalakeDashboard } = await import("@/lib/datalake-r2");
    const payload = await getDatalakeDashboard({ refresh: true });
    expect(payload.source).toBe("gold");
    expect(payload.sections.find((s) => s.section === "top_keywords")?.rows?.[0]?.query).toBe(
      "cloud greece"
    );
  });

  it("returns section errors when D1 and R2 are unbound", async () => {
    const { getDatalakeDashboard } = await import("@/lib/datalake-r2");
    const payload = await getDatalakeDashboard({});
    expect(payload.source).toBe("empty");
    expect(payload.cache).toBe("cloudflare");
    for (const section of payload.sections) {
      expect(section.error).toBeTruthy();
      expect(section.rows).toBeUndefined();
    }
  });

  it("hot_only when D1 bound but gold missing", async () => {
    (globalThis as { __AUTH_DB__?: AuthDatabase }).__AUTH_DB__ = makeDb([
      { day: "2026-07-28", sessions: 2, signups: 0, purchasers: 0, revenue: 0 },
    ]);
    const { getDatalakeDashboard } = await import("@/lib/datalake-r2");
    const payload = await getDatalakeDashboard({});
    expect(payload.source).toBe("hot_only");
    expect(
      payload.sections.find((s) => s.section === "acquisition_funnel")?.rows?.[0]?.sessions
    ).toBe(2);
    expect(payload.sections.find((s) => s.section === "stripe_revenue")?.error).toContain(
      "gold ETL snapshot missing"
    );
  });
});
