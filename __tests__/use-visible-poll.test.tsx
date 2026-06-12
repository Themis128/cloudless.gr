/**
 * Tests for useVisiblePoll — verify the hook gates the underlying
 * setInterval on document.visibilityState, fires once on mount, refires on
 * return-to-visible, and cleans up listeners.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { useVisiblePoll } from "@/lib/use-visible-poll";

describe("useVisiblePoll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  function setVisibility(state: "visible" | "hidden") {
    Object.defineProperty(document, "visibilityState", {
      value: state,
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }

  it("invokes fn immediately on mount when visible", () => {
    const fn = vi.fn();
    renderHook(() => useVisiblePoll(fn, 1000));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("invokes fn on each interval while visible", () => {
    const fn = vi.fn();
    renderHook(() => useVisiblePoll(fn, 1000));
    vi.advanceTimersByTime(3500);
    expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 ticks
  });

  it("does NOT tick while hidden", () => {
    const fn = vi.fn();
    renderHook(() => useVisiblePoll(fn, 1000));
    expect(fn).toHaveBeenCalledTimes(1);
    setVisibility("hidden");
    vi.advanceTimersByTime(10_000);
    expect(fn).toHaveBeenCalledTimes(1); // still just the mount call
  });

  it("refires immediately on return to visible and resumes ticking", () => {
    const fn = vi.fn();
    renderHook(() => useVisiblePoll(fn, 1000));
    setVisibility("hidden");
    vi.advanceTimersByTime(5000);
    expect(fn).toHaveBeenCalledTimes(1);
    setVisibility("visible");
    expect(fn).toHaveBeenCalledTimes(2); // immediate refetch on return
    vi.advanceTimersByTime(2500);
    expect(fn).toHaveBeenCalledTimes(4); // + 2 ticks
  });

  it("skips the initial invoke when mounted while hidden", () => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      writable: true,
      configurable: true,
    });
    const fn = vi.fn();
    renderHook(() => useVisiblePoll(fn, 1000));
    expect(fn).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(5000);
    expect(fn).toHaveBeenCalledTimes(0);
  });

  it("removes the listener and clears the timer on unmount", () => {
    const fn = vi.fn();
    const { unmount } = renderHook(() => useVisiblePoll(fn, 1000));
    expect(fn).toHaveBeenCalledTimes(1);
    unmount();
    vi.advanceTimersByTime(10_000);
    expect(fn).toHaveBeenCalledTimes(1);
    // Toggling visibility after unmount must not revive the timer.
    setVisibility("hidden");
    setVisibility("visible");
    vi.advanceTimersByTime(2000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("swallows rejected promises from fn (does not break the cycle)", () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    renderHook(() => useVisiblePoll(fn, 1000));
    vi.advanceTimersByTime(2500);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
