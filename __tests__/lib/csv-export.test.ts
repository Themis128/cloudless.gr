import { describe, it, expect } from "vitest";
import { escapeCsvCell, rowsToCsv } from "@/lib/csv-export";

describe("escapeCsvCell", () => {
  it("returns empty string for null", () => {
    expect(escapeCsvCell(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("returns plain string when no special chars", () => {
    expect(escapeCsvCell("hello world")).toBe("hello world");
  });

  it("wraps in quotes when value contains comma", () => {
    expect(escapeCsvCell("hello, world")).toBe('"hello, world"');
  });

  it("wraps in quotes when value contains double-quote and escapes it", () => {
    expect(escapeCsvCell('say "hello"')).toBe('"say ""hello"""');
  });

  it("wraps in quotes when value contains newline", () => {
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("converts number to string", () => {
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell(3.14)).toBe("3.14");
  });

  it("converts boolean to string", () => {
    expect(escapeCsvCell(true)).toBe("true");
    expect(escapeCsvCell(false)).toBe("false");
  });
});

describe("rowsToCsv", () => {
  const columns = [
    { key: "name", label: "Name" },
    { key: "score", label: "Score" },
  ];
  const rows = [
    { name: "Alice", score: 95 },
    { name: "Bob, Jr.", score: 80 },
  ];

  it("includes header row", () => {
    const csv = rowsToCsv(columns, rows);
    expect(csv).toContain("Name,Score");
  });

  it("includes all data rows", () => {
    const csv = rowsToCsv(columns, rows);
    expect(csv).toContain("Alice,95");
    expect(csv).toContain('"Bob, Jr.",80');
  });

  it("joins rows with CRLF (RFC 4180)", () => {
    const csv = rowsToCsv(columns, rows);
    expect(csv).toContain("\r\n");
  });

  it("handles empty rows array (header only)", () => {
    const csv = rowsToCsv(columns, []);
    expect(csv).toBe("Name,Score");
  });

  it("handles missing keys as empty string", () => {
    const csv = rowsToCsv(columns, [{ name: "Alice" } as Record<string, unknown>]);
    expect(csv).toContain("Alice,");
  });
});
