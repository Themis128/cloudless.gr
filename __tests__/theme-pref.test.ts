import { describe, it, expect, beforeEach, vi } from "vitest";

// theme-pref.ts uses window/localStorage — needs jsdom environment.
// @vitest-environment jsdom

const STORAGE_KEY = "cloudless-theme-pref";
const PREF_EVENT = "cloudless:theme-pref";

describe("readStoredPref()", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("returns null when nothing is stored", async () => {
    const { readStoredPref } = await import("@/lib/theme-pref");
    expect(readStoredPref()).toBeNull();
  });

  it("returns 'light' when stored", async () => {
    localStorage.setItem(STORAGE_KEY, "light");
    const { readStoredPref } = await import("@/lib/theme-pref");
    expect(readStoredPref()).toBe("light");
  });

  it("returns 'dark' when stored", async () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    const { readStoredPref } = await import("@/lib/theme-pref");
    expect(readStoredPref()).toBe("dark");
  });

  it("returns 'system' when stored", async () => {
    localStorage.setItem(STORAGE_KEY, "system");
    const { readStoredPref } = await import("@/lib/theme-pref");
    expect(readStoredPref()).toBe("system");
  });

  it("returns null for an unrecognised stored value", async () => {
    localStorage.setItem(STORAGE_KEY, "banana");
    const { readStoredPref } = await import("@/lib/theme-pref");
    expect(readStoredPref()).toBeNull();
  });
});

describe("writeStoredPref()", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("persists the value to localStorage", async () => {
    const { writeStoredPref } = await import("@/lib/theme-pref");
    writeStoredPref("dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("dispatches a CustomEvent on the same tab", async () => {
    const { writeStoredPref } = await import("@/lib/theme-pref");
    const received: string[] = [];
    window.addEventListener(PREF_EVENT, (e) => {
      received.push((e as CustomEvent).detail as string);
    });
    writeStoredPref("light");
    expect(received).toContain("light");
  });

  it("overwrites a previously stored value", async () => {
    const { writeStoredPref, readStoredPref } = await import("@/lib/theme-pref");
    writeStoredPref("dark");
    writeStoredPref("light");
    expect(readStoredPref()).toBe("light");
  });
});

describe("THEME_STORAGE_KEY / THEME_PREF_EVENT constants", () => {
  it("exports the correct storage key", async () => {
    const { THEME_STORAGE_KEY } = await import("@/lib/theme-pref");
    expect(THEME_STORAGE_KEY).toBe(STORAGE_KEY);
  });

  it("exports the correct event name", async () => {
    const { THEME_PREF_EVENT } = await import("@/lib/theme-pref");
    expect(THEME_PREF_EVENT).toBe(PREF_EVENT);
  });
});
