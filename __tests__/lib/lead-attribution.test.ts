import { describe, it, expect } from "vitest";
import {
  parseAttribution,
  sanitizeAttribution,
  formatAttribution,
  ATTRIBUTION_STORAGE_KEY,
} from "@/lib/lead-attribution";

describe("ATTRIBUTION_STORAGE_KEY", () => {
  it("is a non-empty string", () => {
    expect(typeof ATTRIBUTION_STORAGE_KEY).toBe("string");
    expect(ATTRIBUTION_STORAGE_KEY.length).toBeGreaterThan(0);
  });
});

describe("parseAttribution", () => {
  const base = "https://cloudless.gr/en/contact";

  it("returns null when no UTM params and no external referrer", () => {
    expect(parseAttribution(base)).toBeNull();
  });

  it("extracts utm_source, utm_medium, utm_campaign", () => {
    const url = `${base}?utm_source=google&utm_medium=cpc&utm_campaign=q3`;
    const result = parseAttribution(url);
    expect(result?.utmSource).toBe("google");
    expect(result?.utmMedium).toBe("cpc");
    expect(result?.utmCampaign).toBe("q3");
  });

  it("includes landingPage when there is a signal", () => {
    const url = `${base}?utm_source=linkedin`;
    const result = parseAttribution(url);
    expect(result?.landingPage).toBe("/en/contact");
  });

  it("extracts referrer when from an external host", () => {
    const result = parseAttribution(base, "https://google.com/search?q=cloudless");
    expect(result?.referrer).toBe("https://google.com/search?q=cloudless");
  });

  it("ignores referrer from the same host", () => {
    const result = parseAttribution(base, "https://cloudless.gr/blog");
    expect(result).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(parseAttribution("not-a-url")).toBeNull();
  });

  it("truncates overly long values to 200 characters", () => {
    const longCampaign = "a".repeat(300);
    const url = `${base}?utm_campaign=${longCampaign}`;
    const result = parseAttribution(url);
    expect(result?.utmCampaign?.length).toBe(200);
  });

  it("extracts utm_term and utm_content", () => {
    const url = `${base}?utm_source=x&utm_term=cloud&utm_content=banner`;
    const result = parseAttribution(url);
    expect(result?.utmTerm).toBe("cloud");
    expect(result?.utmContent).toBe("banner");
  });
});

describe("sanitizeAttribution", () => {
  it("returns null for null/non-object input", () => {
    expect(sanitizeAttribution(null)).toBeNull();
    expect(sanitizeAttribution("string")).toBeNull();
    expect(sanitizeAttribution(42)).toBeNull();
  });

  it("sanitizes valid attribution object", () => {
    const result = sanitizeAttribution({ utmSource: "google", utmMedium: "cpc" });
    expect(result?.utmSource).toBe("google");
    expect(result?.utmMedium).toBe("cpc");
  });

  it("strips unknown keys", () => {
    const result = sanitizeAttribution({ utmSource: "x", malicious: "evil" }) as Record<string, unknown>;
    expect(result.malicious).toBeUndefined();
  });

  it("returns null for empty object", () => {
    expect(sanitizeAttribution({})).toBeNull();
  });

  it("strips non-string values", () => {
    const result = sanitizeAttribution({ utmSource: 42, utmMedium: "cpc" });
    expect(result?.utmSource).toBeUndefined();
    expect(result?.utmMedium).toBe("cpc");
  });
});

describe("formatAttribution", () => {
  it("formats all attribution fields", () => {
    const result = formatAttribution({
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "q3",
      referrer: "https://google.com",
      landingPage: "/contact",
    });
    expect(result).toContain("source=google");
    expect(result).toContain("medium=cpc");
    expect(result).toContain("campaign=q3");
    expect(result).toContain("referrer=https://google.com");
    expect(result).toContain("landing=/contact");
  });

  it("separates fields with |", () => {
    const result = formatAttribution({ utmSource: "a", utmMedium: "b" });
    expect(result).toContain(" | ");
  });

  it("omits missing fields", () => {
    const result = formatAttribution({ utmSource: "google" });
    expect(result).toBe("source=google");
    expect(result).not.toContain("medium");
  });
});
