import { describe, it, expect } from "vitest";
import { buildPayloadForSmokeTest } from "@/lib/comfyui";

describe("buildPayloadForSmokeTest", () => {
  it("returns an object with client_id and prompt", () => {
    const payload = buildPayloadForSmokeTest();
    expect(payload).toHaveProperty("client_id");
    expect(payload).toHaveProperty("prompt");
    expect(typeof payload.client_id).toBe("string");
    expect(typeof payload.prompt).toBe("object");
  });

  it("prompt nodes have class_type and inputs", () => {
    const payload = buildPayloadForSmokeTest();
    const nodes = Object.values(payload.prompt as Record<string, unknown>);
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      const n = node as Record<string, unknown>;
      expect(typeof n.class_type).toBe("string");
    }
  });
});
