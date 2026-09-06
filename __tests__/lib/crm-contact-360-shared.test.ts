import { describe, it, expect } from "vitest";
import {
  isEspoRecordId,
  emptyAttribution,
  emptyScores,
  contactDisplayName,
} from "@/lib/crm-contact-360-shared";

describe("isEspoRecordId", () => {
  it("returns true for a valid 17-char hex id", () => {
    expect(isEspoRecordId("6a36ef141808ed737")).toBe(true);
  });

  it("returns false for short or invalid ids", () => {
    expect(isEspoRecordId("short")).toBe(false);
    expect(isEspoRecordId("")).toBe(false);
  });
});

describe("emptyAttribution", () => {
  it("returns an object with firstTouch null and goldMatches array", () => {
    const attr = emptyAttribution();
    expect(attr.firstTouch).toBeNull();
    expect(Array.isArray(attr.goldMatches)).toBe(true);
  });
});

describe("emptyScores", () => {
  it("returns an object with numeric score fields", () => {
    const scores = emptyScores();
    expect(typeof scores).toBe("object");
  });
});

describe("contactDisplayName", () => {
  it("returns first + last name", () => {
    expect(contactDisplayName({ firstName: "Alice", lastName: "Smith", email: "a@b.com" })).toBe("Alice Smith");
  });

  it("falls back to email when name is missing", () => {
    expect(contactDisplayName({ firstName: "", lastName: "", email: "test@example.com" })).toContain("test@example.com");
  });
});
