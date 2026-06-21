// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  resolvePivotLabel,
  INDUSTRIES,
  SENIORITIES,
  COMPANY_SIZES,
} from "@/lib/ad-analytics/lookups";

describe("resolvePivotLabel", () => {
  it("resolves a known industry URN to its human label", () => {
    expect(resolvePivotLabel("MEMBER_INDUSTRY", "urn:li:industry:4")).toBe("Computer Software");
    expect(resolvePivotLabel("MEMBER_INDUSTRY", "urn:li:industry:96")).toBe(
      "Information Technology & Services"
    );
  });

  it("accepts the bare numeric id without the URN prefix", () => {
    expect(resolvePivotLabel("MEMBER_INDUSTRY", "1810")).toBe("IT Services and IT Consulting");
  });

  it("falls back to `Industry #N` for unknown industry ids (never empty)", () => {
    expect(resolvePivotLabel("MEMBER_INDUSTRY", "urn:li:industry:99999")).toBe("Industry #99999");
  });

  it("resolves the full 10-bucket seniority axis", () => {
    expect(resolvePivotLabel("MEMBER_SENIORITY", "urn:li:seniority:5")).toBe("Manager");
    expect(resolvePivotLabel("MEMBER_SENIORITY", "urn:li:seniority:10")).toBe("Owner");
    expect(resolvePivotLabel("MEMBER_SENIORITY", "urn:li:seniority:1")).toBe("Unpaid");
  });

  it("falls back to `Seniority #N` for unknown seniorities", () => {
    expect(resolvePivotLabel("MEMBER_SENIORITY", "urn:li:seniority:42")).toBe("Seniority #42");
  });

  it("resolves company size in both the SIZE_* enum form and the letter form", () => {
    // SIZE_* enum (returned by the Marketing API)
    expect(resolvePivotLabel("MEMBER_COMPANY_SIZE", "SIZE_2_TO_10")).toBe("2–10");
    expect(resolvePivotLabel("MEMBER_COMPANY_SIZE", "SIZE_10001_OR_MORE")).toBe("10,001+");
    // Letter-coded URN form
    expect(resolvePivotLabel("MEMBER_COMPANY_SIZE", "urn:li:companySize:C")).toBe("11–50");
    expect(resolvePivotLabel("MEMBER_COMPANY_SIZE", "urn:li:companySize:I")).toBe("10,001+");
  });

  it("falls back to `Size <code>` for unrecognised company-size codes", () => {
    expect(resolvePivotLabel("MEMBER_COMPANY_SIZE", "urn:li:companySize:Z")).toBe("Size Z");
  });

  it("returns `Title #N` for job titles (lookup table not yet shipped)", () => {
    expect(resolvePivotLabel("MEMBER_JOB_TITLE", "urn:li:title:21")).toBe("Title #21");
  });

  it("returns 'unknown' for an empty URN tail (never empty string)", () => {
    expect(resolvePivotLabel("MEMBER_INDUSTRY", "")).toBe("unknown");
    expect(resolvePivotLabel("MEMBER_INDUSTRY", "urn:li:industry:")).toBe("unknown");
  });
});

describe("lookup-table sanity", () => {
  it("ships all 10 seniorities", () => {
    expect(Object.keys(SENIORITIES)).toHaveLength(10);
  });

  it("ships every company-size bucket in both SIZE_* and letter form", () => {
    const sizeKeys = Object.keys(COMPANY_SIZES);
    // 9 sizes × 2 key forms = 18 entries.
    expect(sizeKeys.length).toBeGreaterThanOrEqual(18);
    // Each size label has both keys pointing to it.
    const labelsToCount = new Map<string, number>();
    for (const v of Object.values(COMPANY_SIZES)) {
      labelsToCount.set(v, (labelsToCount.get(v) ?? 0) + 1);
    }
    for (const count of labelsToCount.values()) {
      expect(count).toBe(2);
    }
  });

  it("includes the high-traffic SMB-cloud industries", () => {
    // Sanity check that the curated subset covers the ICP — if these get
    // dropped, the digest stops being useful for cloudless.gr's audience.
    expect(INDUSTRIES["4"]).toBeDefined(); // Computer Software
    expect(INDUSTRIES["96"]).toBeDefined(); // Information Technology & Services
    expect(INDUSTRIES["1810"]).toBeDefined(); // IT Services and IT Consulting
    expect(INDUSTRIES["70"]).toBeDefined(); // Marketing & Advertising
    expect(INDUSTRIES["27"]).toBeDefined(); // Retail
  });
});
