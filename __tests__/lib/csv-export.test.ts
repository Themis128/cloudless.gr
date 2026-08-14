import { describe, expect, it } from "vitest";
import { escapeCsvCell, rowsToCsv } from "@/lib/csv-export";

describe("escapeCsvCell", () => {
  it("leaves plain values alone and empties nullish", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell(12)).toBe("12");
    expect(escapeCsvCell("plain")).toBe("plain");
  });

  it("quotes commas, quotes, and newlines", () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell("a\nb")).toBe('"a\nb"');
  });
});

describe("rowsToCsv", () => {
  it("emits header + CRLF rows using column labels", () => {
    const csv = rowsToCsv(
      [
        { key: "day", label: "Day" },
        { key: "revenue", label: "Revenue" },
      ],
      [
        { day: "2026-08-01", revenue: 12.5 },
        { day: "note,with,comma", revenue: null },
      ]
    );
    expect(csv).toBe('Day,Revenue\r\n2026-08-01,12.5\r\n"note,with,comma",');
  });
});
