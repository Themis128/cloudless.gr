import { describe, it, expect } from "vitest";
import { getServices } from "@/lib/services-data";

const t = (_key: string, fallback: string) => fallback;

describe("getServices", () => {
  const services = getServices(t);

  it("returns a non-empty array", () => {
    expect(services.length).toBeGreaterThan(0);
  });

  it("each service has required fields", () => {
    for (const svc of services) {
      expect(typeof svc.num).toBe("string");
      expect(typeof svc.title).toBe("string");
      expect(typeof svc.price).toBe("string");
      expect(typeof svc.planKey).toBe("string");
      expect(Array.isArray(svc.features)).toBe(true);
      expect(svc.features.length).toBeGreaterThan(0);
    }
  });

  it("has unique planKeys", () => {
    const keys = services.map((s) => s.planKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("each service has stats array", () => {
    for (const svc of services) {
      expect(Array.isArray(svc.stats)).toBe(true);
      expect(svc.stats.length).toBeGreaterThan(0);
      for (const stat of svc.stats) {
        expect(typeof stat.value).toBe("string");
        expect(typeof stat.label).toBe("string");
      }
    }
  });

  it("uses the fallback values when translation key is unknown", () => {
    const first = services[0];
    expect(first.title).toBe("Cloud Architecture & Migration");
  });
});
