import { describe, it, expect } from "vitest";
import { appflowyWriteNotImplemented } from "@/lib/appflowy-admin-stub";

describe("appflowyWriteNotImplemented", () => {
  it("returns a 501 response", async () => {
    const res = appflowyWriteNotImplemented("test-surface");
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toContain("not yet implemented");
  });
});
