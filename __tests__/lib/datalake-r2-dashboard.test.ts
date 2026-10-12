import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAuthDb, mockGetBucket } = vi.hoisted(() => ({
  mockGetAuthDb: vi.fn(),
  mockGetBucket: vi.fn(() => null),
}));

vi.mock("@/lib/auth-d1", () => ({ getAuthDbFromEnv: mockGetAuthDb }));
vi.mock("@/lib/r2-client", () => ({ getDataLakeBucketFromEnv: mockGetBucket }));

import { getDatalakeDashboard } from "@/lib/datalake-r2";

const throwingDb = {
  prepare: () => ({
    bind: () => ({ all: async () => { throw new Error("d1 gone"); } }),
  }),
};

const rowsDb = {
  prepare: () => ({
    bind: () => ({ all: async () => ({ results: [{ day: "2026-10-01", sessions: 5 }] }) }),
  }),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBucket.mockReturnValue(null);
});

describe("getDatalakeDashboard D1 overlay", () => {
  it("D1 query failures → d1SectionError entries", async () => {
    mockGetAuthDb.mockReturnValue(throwingDb);
    const out = await getDatalakeDashboard({});
    const acq = out.sections.find((s) => s.section === "acquisition_funnel");
    const attr = out.sections.find((s) => s.section === "attribution");
    expect(acq?.error).toBe("d1 gone");
    expect(attr?.error).toBe("d1 gone");
    expect(out.source).toBe("hot_only"); // D1 present, no gold
  });

  it("D1 success populates hot sections with rows", async () => {
    mockGetAuthDb.mockReturnValue(rowsDb);
    const out = await getDatalakeDashboard({});
    expect(out.sections.find((s) => s.section === "acquisition_funnel")?.rows)
      .toEqual([{ day: "2026-10-01", sessions: 5 }]);
    expect(out.sections.find((s) => s.section === "attribution")?.rowCount).toBe(1);
  });

  it("usable gold section survives a D1 throw", async () => {
    mockGetBucket.mockReturnValue({
      get: vi.fn().mockResolvedValue({
        text: async () => JSON.stringify({
          generated_at: "g1",
          sections: [{ section: "acquisition_funnel", rows: [{ gold: 1 }] }],
        }),
      }),
    });
    mockGetAuthDb.mockReturnValue(throwingDb);
    const out = await getDatalakeDashboard({});
    const acq = out.sections.find((s) => s.section === "acquisition_funnel");
    expect(acq?.rows).toEqual([{ gold: 1 }]); // gold wins — error not recorded
    expect(acq?.error).toBeUndefined();
    expect(out.source).toBe("gold");
    // attribution has no gold → D1 error surfaces
    expect(out.sections.find((s) => s.section === "attribution")?.error).toBe("d1 gone");
  });

  it("gold snapshot read throwing → warns + continues with D1 overlay", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockGetBucket.mockReturnValue({
      get: vi.fn().mockResolvedValue({ text: async () => "{invalid" }), // JSON.parse throws
    });
    mockGetAuthDb.mockReturnValue(rowsDb);
    const out = await getDatalakeDashboard({});
    expect(warn).toHaveBeenCalledWith(
      "[datalake-r2] gold snapshot read failed:", expect.any(String)
    );
    expect(out.source).toBe("hot_only");
    warn.mockRestore();
  });

  it("no db → hot sections get not-wired errors; no gold → empty source", async () => {
    mockGetAuthDb.mockReturnValue(null);
    const out = await getDatalakeDashboard({});
    expect(out.source).toBe("empty");
    expect(out.sections.find((s) => s.section === "attribution")?.error).toBeTruthy();
  });
});
