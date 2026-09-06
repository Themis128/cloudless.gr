import { describe, it, expect } from "vitest";
import { DEFAULT_LOCALE, DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from "@/lib/locale-defaults";

describe("locale-defaults", () => {
  it("DEFAULT_LOCALE is en-IE", () => {
    expect(DEFAULT_LOCALE).toBe("en-IE");
  });

  it("DEFAULT_CURRENCY is EUR", () => {
    expect(DEFAULT_CURRENCY).toBe("EUR");
  });

  it("DEFAULT_TIMEZONE is Europe/Athens", () => {
    expect(DEFAULT_TIMEZONE).toBe("Europe/Athens");
  });
});
