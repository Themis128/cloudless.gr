import { describe, it, expect } from "vitest";
import {
  THEME_STORAGE_KEY,
  THEME_PREF_EVENT,
  readStoredPref,
  writeStoredPref,
} from "@/lib/theme-pref";

describe("constants", () => {
  it("THEME_STORAGE_KEY is the expected key", () => {
    expect(THEME_STORAGE_KEY).toBe("cloudless-theme-pref");
  });

  it("THEME_PREF_EVENT is the expected event name", () => {
    expect(THEME_PREF_EVENT).toBe("cloudless:theme-pref");
  });
});

describe("readStoredPref", () => {
  it("returns null when localStorage has no value", () => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    expect(readStoredPref()).toBeNull();
  });

  it("returns 'dark' when stored as dark", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(readStoredPref()).toBe("dark");
    localStorage.removeItem(THEME_STORAGE_KEY);
  });

  it("returns 'light' when stored as light", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    expect(readStoredPref()).toBe("light");
    localStorage.removeItem(THEME_STORAGE_KEY);
  });

  it("returns 'system' when stored as system", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "system");
    expect(readStoredPref()).toBe("system");
    localStorage.removeItem(THEME_STORAGE_KEY);
  });

  it("returns null for invalid stored value", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "blue");
    expect(readStoredPref()).toBeNull();
    localStorage.removeItem(THEME_STORAGE_KEY);
  });
});

describe("writeStoredPref", () => {
  it("persists the value to localStorage", () => {
    writeStoredPref("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    localStorage.removeItem(THEME_STORAGE_KEY);
  });

  it("dispatches a custom event on same-tab write", () => {
    const events: Event[] = [];
    const handler = (e: Event) => events.push(e);
    window.addEventListener(THEME_PREF_EVENT, handler);

    writeStoredPref("light");

    expect(events).toHaveLength(1);
    expect((events[0] as CustomEvent).detail).toBe("light");

    window.removeEventListener(THEME_PREF_EVENT, handler);
    localStorage.removeItem(THEME_STORAGE_KEY);
  });
});
