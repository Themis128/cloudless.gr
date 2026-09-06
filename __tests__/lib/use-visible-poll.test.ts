import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVisiblePoll } from "@/lib/use-visible-poll";

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, "visibilityState", { value: "visible", writable: true, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useVisiblePoll", () => {
  it("calls fn immediately on mount", () => {
    const fn = vi.fn();
    renderHook(() => useVisiblePoll(fn, 5000));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls fn again after the interval elapses", () => {
    const fn = vi.fn();
    renderHook(() => useVisiblePoll(fn, 1000));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(fn.mock.calls.length).toBeGreaterThan(1);
  });

  it("does not poll when tab is hidden", () => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true, configurable: true });
    const fn = vi.fn();
    renderHook(() => useVisiblePoll(fn, 1000));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(fn).toHaveBeenCalledTimes(0);
  });
});
