import { describe, expect, it } from "vitest";
import { parseAttribution, sanitizeAttribution, formatAttribution } from "@/lib/lead-attribution";

describe("parseAttribution", () => {
  it("extracts all five UTM params and the landing page", () => {
    const result = parseAttribution(
      "https://cloudless.gr/services?utm_source=google&utm_medium=cpc&utm_campaign=spring&utm_term=cloud+migration&utm_content=ad-a"
    );
    expect(result).toEqual({
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "spring",
      utmTerm: "cloud migration",
      utmContent: "ad-a",
      landingPage: "/services",
    });
  });

  it("returns null when there is no signal at all", () => {
    expect(parseAttribution("https://cloudless.gr/")).toBeNull();
    expect(parseAttribution("https://cloudless.gr/contact?foo=bar")).toBeNull();
  });

  it("treats an external referrer as a signal", () => {
    const result = parseAttribution("https://cloudless.gr/blog", "https://www.google.com/search");
    expect(result).toEqual({
      referrer: "https://www.google.com/search",
      landingPage: "/blog",
    });
  });

  it("ignores internal referrers (same hostname)", () => {
    expect(parseAttribution("https://cloudless.gr/contact", "https://cloudless.gr/")).toBeNull();
  });

  it("ignores malformed referrer strings", () => {
    expect(parseAttribution("https://cloudless.gr/contact", "not a url")).toBeNull();
  });

  it("returns null for an unparseable page URL", () => {
    expect(parseAttribution("::::not-a-url")).toBeNull();
  });

  it("truncates oversized values to 200 chars", () => {
    const long = "x".repeat(500);
    const result = parseAttribution(`https://cloudless.gr/?utm_source=${long}`);
    expect(result?.utmSource).toHaveLength(200);
  });

  it("drops empty UTM values", () => {
    expect(parseAttribution("https://cloudless.gr/?utm_source=&utm_medium=")).toBeNull();
  });
});

describe("sanitizeAttribution", () => {
  it("passes through valid string fields", () => {
    const result = sanitizeAttribution({
      utmSource: "linkedin",
      utmMedium: "paid",
      landingPage: "/work",
    });
    expect(result).toEqual({ utmSource: "linkedin", utmMedium: "paid", landingPage: "/work" });
  });

  it("drops non-string and unknown fields", () => {
    const result = sanitizeAttribution({
      utmSource: 42,
      utmMedium: { nested: true },
      utmCampaign: "ok",
      evil: "<script>",
    });
    expect(result).toEqual({ utmCampaign: "ok" });
  });

  it("returns null for non-objects and empty objects", () => {
    expect(sanitizeAttribution(null)).toBeNull();
    expect(sanitizeAttribution("utm_source=x")).toBeNull();
    expect(sanitizeAttribution({})).toBeNull();
    expect(sanitizeAttribution({ utmSource: "" })).toBeNull();
  });

  it("truncates oversized values", () => {
    const result = sanitizeAttribution({ referrer: "r".repeat(1000) });
    expect(result?.referrer).toHaveLength(200);
  });
});

describe("formatAttribution", () => {
  it("renders a pipe-separated summary in stable order", () => {
    expect(
      formatAttribution({
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "spring",
        landingPage: "/services",
      })
    ).toBe("source=google | medium=cpc | campaign=spring | landing=/services");
  });

  it("renders referrer-only attribution", () => {
    expect(formatAttribution({ referrer: "https://t.co/abc", landingPage: "/" })).toBe(
      "referrer=https://t.co/abc | landing=/"
    );
  });

  it("returns an empty string for an empty object", () => {
    expect(formatAttribution({})).toBe("");
  });
});
