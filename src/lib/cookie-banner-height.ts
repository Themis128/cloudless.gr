export const COOKIE_BANNER_HEIGHT_VAR = "--cookie-banner-h";

export function cookieBannerOffsetPx(heightPx: number): string {
  const px = Number.isFinite(heightPx) && heightPx > 0 ? Math.ceil(heightPx) : 0;
  return `${px}px`;
}

export function applyCookieBannerOffset(
  style: { setProperty: (property: string, value: string) => void },
  heightPx: number
): void {
  style.setProperty(COOKIE_BANNER_HEIGHT_VAR, cookieBannerOffsetPx(heightPx));
}

/**
 * Keep `--cookie-banner-h` in sync with the live banner box so bottom chrome
 * (chat FAB, push prompt) sits above it on narrow viewports.
 */
export function observeCookieBannerHeight(
  root: HTMLElement,
  banner: HTMLElement | null
): () => void {
  if (!banner) {
    applyCookieBannerOffset(root.style, 0);
    return () => applyCookieBannerOffset(root.style, 0);
  }

  const apply = () => applyCookieBannerOffset(root.style, banner.getBoundingClientRect().height);
  apply();

  if (typeof ResizeObserver === "undefined") {
    return () => applyCookieBannerOffset(root.style, 0);
  }

  const observer = new ResizeObserver(apply);
  observer.observe(banner);
  return () => {
    observer.disconnect();
    applyCookieBannerOffset(root.style, 0);
  };
}
