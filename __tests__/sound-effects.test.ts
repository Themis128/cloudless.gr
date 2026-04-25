import { describe, it, expect } from "vitest";
import { playUiClickSound, playUiSuccessSound } from "@/lib/sound-effects";

describe("sound-effects.ts", () => {
  it("playUiClickSound does not throw when AudioContext is unavailable", () => {
    expect(() => playUiClickSound()).not.toThrow();
  });

  it("playUiSuccessSound does not throw when AudioContext is unavailable", () => {
    expect(() => playUiSuccessSound()).not.toThrow();
  });

  it("playUiClickSound can be called multiple times without error", () => {
    expect(() => {
      playUiClickSound();
      playUiClickSound();
      playUiClickSound();
    }).not.toThrow();
  });

  it("playUiSuccessSound can be called multiple times without error", () => {
    expect(() => {
      playUiSuccessSound();
      playUiSuccessSound();
    }).not.toThrow();
  });
});
