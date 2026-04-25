import { describe, it, expect } from "vitest";
import { DEFAULT_LOCALE, DEFAULT_CURRENCY } from "@/lib/locale-defaults";

describe("locale-defaults.ts", () => {
  it("DEFAULT_LOCALE is en-IE", () => {
    expect(DEFAULT_LOCALE).toBe("en-IE");
  });

  it("DEFAULT_CURRENCY is EUR", () => {
    expect(DEFAULT_CURRENCY).toBe("EUR");
  });
});
