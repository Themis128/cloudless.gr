import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COOKIE_BANNER_HEIGHT_VAR,
  applyCookieBannerOffset,
  cookieBannerOffsetPx,
  observeCookieBannerHeight,
} from "@/lib/cookie-banner-height";

class FakeResizeObserver {
  static last: FakeResizeObserver | undefined;
  readonly observed: Element[] = [];
  constructor(readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.last = this;
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {
    this.observed.length = 0;
  }
  unobserve() {
    /* no-op */
  }
}

function bannerWithHeight(height: number): HTMLElement {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    ({
      height,
      width: 412,
      top: 0,
      left: 0,
      bottom: height,
      right: 412,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;
  return el;
}

describe("cookieBannerOffsetPx", () => {
  it("ceils positive heights and zeros the rest", () => {
    expect(cookieBannerOffsetPx(312.2)).toBe("313px");
    expect(cookieBannerOffsetPx(0)).toBe("0px");
    expect(cookieBannerOffsetPx(-4)).toBe("0px");
    expect(cookieBannerOffsetPx(Number.NaN)).toBe("0px");
  });
});

describe("observeCookieBannerHeight", () => {
  afterEach(() => {
    FakeResizeObserver.last = undefined;
    vi.unstubAllGlobals();
  });

  it("writes 0px when the banner is not mounted", () => {
    const root = document.createElement("html");
    const stop = observeCookieBannerHeight(root, null);
    expect(root.style.getPropertyValue(COOKIE_BANNER_HEIGHT_VAR)).toBe("0px");
    stop();
    expect(root.style.getPropertyValue(COOKIE_BANNER_HEIGHT_VAR)).toBe("0px");
  });

  it("measures the banner and observes resizes", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const root = document.createElement("html");
    const banner = bannerWithHeight(280);
    const stop = observeCookieBannerHeight(root, banner);
    expect(root.style.getPropertyValue(COOKIE_BANNER_HEIGHT_VAR)).toBe("280px");
    expect(FakeResizeObserver.last?.observed).toEqual([banner]);
    stop();
    expect(root.style.getPropertyValue(COOKIE_BANNER_HEIGHT_VAR)).toBe("0px");
    expect(FakeResizeObserver.last?.observed).toEqual([]);
  });

  it("still sets the offset when ResizeObserver is missing", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const root = document.createElement("html");
    const stop = observeCookieBannerHeight(root, bannerWithHeight(199.2));
    expect(root.style.getPropertyValue(COOKIE_BANNER_HEIGHT_VAR)).toBe("200px");
    stop();
    expect(root.style.getPropertyValue(COOKIE_BANNER_HEIGHT_VAR)).toBe("0px");
  });

  it("applyCookieBannerOffset writes the CSS variable", () => {
    const style = { setProperty: vi.fn() };
    applyCookieBannerOffset(style, 12.1);
    expect(style.setProperty).toHaveBeenCalledWith(COOKIE_BANNER_HEIGHT_VAR, "13px");
  });
});
