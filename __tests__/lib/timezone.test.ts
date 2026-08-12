import { describe, expect, it } from "vitest";
import {
  APP_TIMEZONE,
  appTodayIsoDate,
  formatAppDate,
  formatAppDateTime,
  formatAppTime,
} from "@/lib/timezone";

describe("timezone (Europe/Athens)", () => {
  it("exports Europe/Athens as the app timezone", () => {
    expect(APP_TIMEZONE).toBe("Europe/Athens");
  });

  it("formats a known UTC instant in Athens (winter EET = UTC+2)", () => {
    // 2026-01-15 12:00 UTC → 14:00 Athens
    const iso = "2026-01-15T12:00:00.000Z";
    expect(formatAppTime(iso, "en-IE")).toMatch(/14:00/);
    expect(formatAppDate(iso, "en-IE", { year: "numeric", month: "2-digit", day: "2-digit" })).toMatch(
      /15/
    );
    expect(formatAppDateTime(iso)).not.toBe("—");
  });

  it("formats a known UTC instant in Athens (summer EEST = UTC+3)", () => {
    // 2026-07-15 12:00 UTC → 15:00 Athens
    expect(formatAppTime("2026-07-15T12:00:00.000Z")).toMatch(/15:00/);
  });

  it("returns em dash for invalid input", () => {
    expect(formatAppDate("not-a-date")).toBe("—");
    expect(formatAppDateTime("nope")).toBe("—");
  });

  it("appTodayIsoDate is YYYY-MM-DD in Athens", () => {
    // Fixed: 2026-08-12 22:30 UTC → already 13 Aug in Athens (UTC+3 in August)
    const d = new Date("2026-08-12T22:30:00.000Z");
    expect(appTodayIsoDate(d)).toBe("2026-08-13");
  });
});
