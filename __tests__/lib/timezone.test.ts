import { describe, it, expect } from "vitest";
import { APP_TIMEZONE, formatAppDateTime, formatAppDate, formatAppTime, appTodayIsoDate } from "@/lib/timezone";

describe("APP_TIMEZONE", () => {
  it("is Europe/Athens", () => {
    expect(APP_TIMEZONE).toBe("Europe/Athens");
  });
});

describe("formatAppDateTime", () => {
  const input = "2026-09-06T10:30:00Z";

  it("returns a non-empty string for a valid date", () => {
    const result = formatAppDateTime(input);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(3);
    expect(result).not.toBe("—");
  });

  it("returns '—' for invalid input", () => {
    expect(formatAppDateTime("not-a-date")).toBe("—");
  });

  it("accepts a Date object", () => {
    const result = formatAppDateTime(new Date(input));
    expect(result).not.toBe("—");
  });

  it("accepts a numeric timestamp", () => {
    const result = formatAppDateTime(new Date(input).getTime());
    expect(result).not.toBe("—");
  });
});

describe("formatAppDate", () => {
  it("returns a date string for valid input", () => {
    const result = formatAppDate("2026-09-06");
    expect(result).not.toBe("—");
    expect(result).toContain("2026");
  });

  it("returns '—' for invalid input", () => {
    expect(formatAppDate("garbage")).toBe("—");
  });
});

describe("formatAppTime", () => {
  it("returns a time string for valid input", () => {
    const result = formatAppTime("2026-09-06T10:30:00Z");
    expect(result).not.toBe("—");
    // 10:30 UTC = 13:30 Athens (EEST = UTC+3)
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it("returns '—' for invalid input", () => {
    expect(formatAppTime("not-a-time")).toBe("—");
  });
});

describe("appTodayIsoDate", () => {
  it("returns a YYYY-MM-DD string", () => {
    const result = appTodayIsoDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("accepts a custom Date object", () => {
    const result = appTodayIsoDate(new Date("2026-09-06T00:00:00Z"));
    expect(result).toMatch(/^2026-09-0[56]$/); // Athens is UTC+3, could be 06
  });
});
