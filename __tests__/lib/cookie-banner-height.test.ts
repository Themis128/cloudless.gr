import { describe, it, expect, vi } from "vitest";
import {
  COOKIE_BANNER_HEIGHT_VAR,
  cookieBannerOffsetPx,
  applyCookieBannerOffset,
  observeCookieBannerHeight,
} from "@/lib/cookie-banner-height";

describe("COOKIE_BANNER_HEIGHT_VAR", () => {
  it("is the expected CSS variable name", () => {
    expect(COOKIE_BANNER_HEIGHT_VAR).toBe("--cookie-banner-h");
  });
});

describe("cookieBannerOffsetPx", () => {
  it("returns '0px' for zero", () => {
    expect(cookieBannerOffsetPx(0)).toBe("0px");
  });

  it("returns '0px' for negative numbers", () => {
    expect(cookieBannerOffsetPx(-10)).toBe("0px");
  });

  it("returns '0px' for NaN", () => {
    expect(cookieBannerOffsetPx(NaN)).toBe("0px");
  });

  it("returns '0px' for Infinity", () => {
    expect(cookieBannerOffsetPx(Infinity)).toBe("0px");
  });

  it("returns the ceiled pixel value for positive numbers", () => {
    expect(cookieBannerOffsetPx(80)).toBe("80px");
    expect(cookieBannerOffsetPx(80.4)).toBe("81px");
    expect(cookieBannerOffsetPx(0.1)).toBe("1px");
  });
});

describe("applyCookieBannerOffset", () => {
  it("calls style.setProperty with the CSS var and correct px value", () => {
    const setProperty = vi.fn();
    applyCookieBannerOffset({ setProperty }, 64);
    expect(setProperty).toHaveBeenCalledWith("--cookie-banner-h", "64px");
  });

  it("sets 0px when height is 0", () => {
    const setProperty = vi.fn();
    applyCookieBannerOffset({ setProperty }, 0);
    expect(setProperty).toHaveBeenCalledWith("--cookie-banner-h", "0px");
  });
});

describe("observeCookieBannerHeight", () => {
  it("sets offset to 0 and returns cleanup when banner is null", () => {
    const setProperty = vi.fn();
    const root = { style: { setProperty } } as unknown as HTMLElement;
    const cleanup = observeCookieBannerHeight(root, null);
    expect(setProperty).toHaveBeenCalledWith("--cookie-banner-h", "0px");
    cleanup();
    expect(setProperty).toHaveBeenCalledTimes(2);
  });

  it("observes banner and disconnects on cleanup", () => {
    const disconnect = vi.fn();
    const observe = vi.fn();
    const mockObserver = { observe, disconnect };
    class MockResizeObserver {
      observe = observe;
      disconnect = disconnect;
      constructor() { return mockObserver as unknown as MockResizeObserver; }
    }
    vi.stubGlobal("ResizeObserver", MockResizeObserver);

    const setProperty = vi.fn();
    const root = { style: { setProperty } } as unknown as HTMLElement;
    const banner = {
      getBoundingClientRect: () => ({ height: 56 }),
    } as unknown as HTMLElement;

    const cleanup = observeCookieBannerHeight(root, banner);
    expect(observe).toHaveBeenCalledWith(banner);
    expect(setProperty).toHaveBeenCalledWith("--cookie-banner-h", "56px");

    cleanup();
    expect(disconnect).toHaveBeenCalled();
    // After cleanup, offset is reset to 0
    expect(setProperty).toHaveBeenLastCalledWith("--cookie-banner-h", "0px");

    vi.unstubAllGlobals();
  });
});
