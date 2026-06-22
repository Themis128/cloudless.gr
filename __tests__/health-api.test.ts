import { describe, expect, it } from "vitest";

describe("GET /api/health", () => {
  it("exports force-dynamic mode", async () => {
    const mod = await import("@/app/api/health/route");
    expect(mod.dynamic).toBe("force-dynamic");
  });

  it("returns status payload with version and timestamp", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(typeof data.version).toBe("string");
    expect(data.version.length).toBeGreaterThan(0);
    expect(typeof data.timestamp).toBe("string");
    expect(Number.isNaN(Date.parse(data.timestamp))).toBe(false);
  });
});
