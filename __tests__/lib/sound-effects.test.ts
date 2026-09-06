import { describe, it, expect } from "vitest";
import { playUiClickSound, playUiSuccessSound } from "@/lib/sound-effects";

describe("sound-effects (SSR / no AudioContext)", () => {
  it("playUiClickSound is a function", () => {
    expect(typeof playUiClickSound).toBe("function");
  });

  it("playUiSuccessSound is a function", () => {
    expect(typeof playUiSuccessSound).toBe("function");
  });

  it("playUiClickSound does not throw in Node (no window)", () => {
    expect(() => playUiClickSound()).not.toThrow();
  });

  it("playUiSuccessSound does not throw in Node (no window)", () => {
    expect(() => playUiSuccessSound()).not.toThrow();
  });
});
