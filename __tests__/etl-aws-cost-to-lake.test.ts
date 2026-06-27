/**
 * Unit test for the `shapeResults()` helper in scripts/etl/aws-cost-to-lake.mjs.
 * Verifies the Cost Explorer → row-flattening logic without hitting AWS.
 */
import { describe, it, expect } from "vitest";

// @ts-expect-error — .mjs path, runtime-checked
import { shapeResults } from "../scripts/etl/aws-cost-to-lake.mjs";

describe("aws-cost-to-lake shapeResults", () => {
  it("flattens ResultsByTime into per-(date,service) rows", () => {
    const fixture = [
      {
        TimePeriod: { Start: "2026-06-19", End: "2026-06-20" },
        Groups: [
          { Keys: ["Amazon S3"], Metrics: { UnblendedCost: { Amount: "0.42", Unit: "USD" } } },
          {
            Keys: ["AWS Lambda"],
            Metrics: { UnblendedCost: { Amount: "1.23456", Unit: "USD" } },
          },
        ],
      },
      {
        TimePeriod: { Start: "2026-06-20", End: "2026-06-21" },
        Groups: [
          {
            Keys: ["Amazon S3"],
            Metrics: { UnblendedCost: { Amount: "0.45", Unit: "USD" } },
          },
        ],
      },
    ];
    const rows = shapeResults(fixture);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      cost_date: "2026-06-19",
      service: "Amazon S3",
      amount_usd: 0.42,
      currency: "USD",
    });
    expect(rows[1].amount_usd).toBeCloseTo(1.23456, 5);
    expect(rows[2].cost_date).toBe("2026-06-20");
  });

  it("drops zero-cost and unparseable rows", () => {
    const fixture = [
      {
        TimePeriod: { Start: "2026-06-19" },
        Groups: [
          { Keys: ["FreeTier Thing"], Metrics: { UnblendedCost: { Amount: "0", Unit: "USD" } } },
          { Keys: ["Junk"], Metrics: { UnblendedCost: { Amount: "not-a-number" } } },
          { Keys: ["Real"], Metrics: { UnblendedCost: { Amount: "0.01", Unit: "USD" } } },
        ],
      },
    ];
    expect(shapeResults(fixture)).toEqual([
      { cost_date: "2026-06-19", service: "Real", amount_usd: 0.01, currency: "USD" },
    ]);
  });

  it("handles missing/empty Groups gracefully", () => {
    expect(shapeResults([])).toEqual([]);
    expect(shapeResults([{ TimePeriod: { Start: "2026-06-19" }, Groups: [] }])).toEqual([]);
    expect(shapeResults([{ TimePeriod: { Start: "2026-06-19" } }])).toEqual([]);
    expect(
      shapeResults([{ Groups: [{ Keys: ["X"], Metrics: { UnblendedCost: { Amount: "1" } } }] }])
    ).toEqual([]);
  });
});
