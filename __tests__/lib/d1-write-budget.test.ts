import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  allowDiscretionaryD1Write,
  discretionaryWritesUsedToday,
  funnelImpressionsEnabled,
  passSample,
  __resetDiscretionaryBudgetForTests,
} from "@/lib/d1-write-budget";

describe("d1-write-budget", () => {
  beforeEach(() => {
    __resetDiscretionaryBudgetForTests();
    delete process.env.D1_DISCRETIONARY_WRITES;
    delete process.env.D1_DISCRETIONARY_DAILY_BUDGET;
    delete process.env.D1_FUNNEL_IMPRESSIONS;
    delete process.env.D1_FUNNEL_SAMPLE;
  });

  afterEach(() => {
    delete process.env.D1_DISCRETIONARY_WRITES;
    delete process.env.D1_DISCRETIONARY_DAILY_BUDGET;
    delete process.env.D1_FUNNEL_IMPRESSIONS;
  });

  it("allows writes under the default budget", () => {
    expect(allowDiscretionaryD1Write(1)).toBe(true);
    expect(discretionaryWritesUsedToday()).toBe(1);
  });

  it("stops when D1_DISCRETIONARY_WRITES=0", () => {
    process.env.D1_DISCRETIONARY_WRITES = "0";
    expect(allowDiscretionaryD1Write(1)).toBe(false);
  });

  it("exhausts a tiny budget", () => {
    process.env.D1_DISCRETIONARY_DAILY_BUDGET = "2";
    expect(allowDiscretionaryD1Write(1)).toBe(true);
    expect(allowDiscretionaryD1Write(1)).toBe(true);
    expect(allowDiscretionaryD1Write(1)).toBe(false);
  });

  it("funnelImpressionsEnabled defaults off", () => {
    expect(funnelImpressionsEnabled()).toBe(false);
    process.env.D1_FUNNEL_IMPRESSIONS = "1";
    expect(funnelImpressionsEnabled()).toBe(true);
  });

  it("passSample respects 0 and 1", () => {
    process.env.D1_FUNNEL_SAMPLE = "0";
    expect(passSample("D1_FUNNEL_SAMPLE", 0.1)).toBe(false);
    process.env.D1_FUNNEL_SAMPLE = "1";
    expect(passSample("D1_FUNNEL_SAMPLE", 0.1)).toBe(true);
  });
});
