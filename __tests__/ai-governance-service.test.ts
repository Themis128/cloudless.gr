import { describe, expect, it } from "vitest";
import { getServices } from "@/lib/services-data";

const t = (k: string, fb: string) => fb;

describe("AI Governance Audit service entry", () => {
  const services = getServices(t as never);
  const svc = services.find((s) => s.planKey === "ai-governance");

  it("exists in the catalog", () => {
    expect(svc).toBeTruthy();
    expect(svc!.num).toBe("07");
  });

  it("has no invented price", () => {
    expect(svc!.price).toBe("On request");
  });

  it("carries the audit deliverables", () => {
    expect(svc!.features.length).toBe(5);
    expect(svc!.features.join(" ")).toMatch(/risk-tier|inventory|oversight/i);
    expect(svc!.stats.length).toBe(4);
    expect(svc!.terminal.length).toBeGreaterThan(0);
  });

  it("keeps catalog integrity (7 services, unique nums)", () => {
    expect(services.length).toBe(7);
    expect(new Set(services.map((s) => s.num)).size).toBe(7);
    expect(new Set(services.map((s) => s.planKey)).size).toBe(7);
  });
});
