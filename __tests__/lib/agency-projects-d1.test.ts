import { describe, it, expect } from "vitest";
import {
  isAgencyProjectStatus,
  listAgencyProjects,
  listTimeEntries,
  type AgencyProjectStatus,
} from "@/lib/agency-projects-d1";

describe("isAgencyProjectStatus", () => {
  it("returns true for valid statuses", () => {
    const valid: AgencyProjectStatus[] = ["active", "on_hold", "done", "cancelled"];
    for (const s of valid) {
      expect(isAgencyProjectStatus(s)).toBe(true);
    }
  });

  it("returns false for invalid statuses", () => {
    expect(isAgencyProjectStatus("unknown")).toBe(false);
    expect(isAgencyProjectStatus("")).toBe(false);
    expect(isAgencyProjectStatus("ACTIVE")).toBe(false);
  });
});

describe("listAgencyProjects (no D1 binding)", () => {
  it("returns bound=false when D1 is not available", async () => {
    const result = await listAgencyProjects();
    expect(result.bound).toBe(false);
    expect(Array.isArray(result.projects)).toBe(true);
  });
});

describe("listTimeEntries (no D1 binding)", () => {
  it("returns bound=false when D1 is not available", async () => {
    const result = await listTimeEntries("any-project-id");
    expect(result.bound).toBe(false);
    expect(Array.isArray(result.entries)).toBe(true);
  });
});
