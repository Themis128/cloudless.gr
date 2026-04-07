import { describe, expect, it } from "vitest";
import { config } from "@/proxy";

describe("proxy config matcher", () => {
  it("excludes manifest, service worker and offline html from intl middleware", () => {
    const matcher = config.matcher?.[0] ?? "";
    expect(matcher).toContain("manifest\\.webmanifest");
    expect(matcher).toContain("sw\\.js");
    expect(matcher).toContain("offline\\.html");
  });

  it("excludes common static file extensions", () => {
    const matcher = config.matcher?.[0] ?? "";
    expect(matcher).toContain("svg");
    expect(matcher).toContain("png");
    expect(matcher).toContain("html");
  });
});
