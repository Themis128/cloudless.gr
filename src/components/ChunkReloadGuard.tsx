"use client";

import { useEffect } from "react";

/**
 * Recovers from stale-deploy chunk failures.
 *
 * cloudless.gr is dual-homed — AWS CloudFront (primary) and the Pi container
 * (secondary) are built independently, so their hashed `/_next/static` chunk
 * names diverge. After a Route 53 failover or a CloudFront edge-cache skew the
 * browser can hold HTML from one build and request a chunk the other build
 * never produced; the asset 403s and scroll-revealed sections silently fail.
 *
 * On a chunk-load failure we force one hard reload to fetch fresh HTML that
 * matches the chunks currently being served. The sessionStorage flag — cleared
 * only after 10s of stability — caps this at one reload per failure so a
 * genuinely missing chunk cannot trigger a reload loop.
 */
const CHUNK_RELOAD_FLAG = "cl-chunk-reload";

const CHUNK_ERROR_PATTERN =
  /ChunkLoadError|Loading chunk [\w-]+ failed|error loading dynamically imported module|Failed to fetch dynamically imported module/i;

export default function ChunkReloadGuard() {
  useEffect(() => {
    function recover(message: string): void {
      if (!CHUNK_ERROR_PATTERN.test(message)) return;
      if (sessionStorage.getItem(CHUNK_RELOAD_FLAG)) return;
      sessionStorage.setItem(CHUNK_RELOAD_FLAG, "1");
      globalThis.location.reload();
    }

    function onError(event: ErrorEvent): void {
      recover(event.message || String(event.error ?? ""));
    }
    function onRejection(event: PromiseRejectionEvent): void {
      const reason: unknown = event.reason;
      recover(reason instanceof Error ? reason.message : String(reason ?? ""));
    }

    globalThis.addEventListener("error", onError);
    globalThis.addEventListener("unhandledrejection", onRejection);
    // Once the page has been stable for 10s, allow a future recovery reload.
    const clearTimer = globalThis.setTimeout(
      () => sessionStorage.removeItem(CHUNK_RELOAD_FLAG),
      10_000
    );

    return () => {
      globalThis.clearTimeout(clearTimer);
      globalThis.removeEventListener("error", onError);
      globalThis.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
