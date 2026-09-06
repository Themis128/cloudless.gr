import { describe, it, expect } from "vitest";
import { SELFHOSTED_APP_NAMES, SELFHOSTED_PUBLIC_URLS } from "@/lib/selfhosted-apps";
import type { SelfhostedApp } from "@/lib/selfhosted-apps";

const APPS: SelfhostedApp[] = ["appflowy", "espocrm", "n8n", "postiz", "grafana", "kuma"];

describe("SELFHOSTED_APP_NAMES", () => {
  it("has a non-empty name for every app", () => {
    for (const app of APPS) {
      expect(typeof SELFHOSTED_APP_NAMES[app]).toBe("string");
      expect(SELFHOSTED_APP_NAMES[app].length).toBeGreaterThan(0);
    }
  });
});

describe("SELFHOSTED_PUBLIC_URLS", () => {
  it("has an https URL for every app", () => {
    for (const app of APPS) {
      const url = SELFHOSTED_PUBLIC_URLS[app];
      expect(url).toMatch(/^https:\/\//);
    }
  });

  it("has exactly the expected apps", () => {
    expect(Object.keys(SELFHOSTED_PUBLIC_URLS).sort()).toEqual(APPS.slice().sort());
  });
});
