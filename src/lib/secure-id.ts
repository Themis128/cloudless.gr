/**
 * Non-secret IDs via Web Crypto (never Math.random — Sonar S2245 / CodeQL).
 * Prefer randomUUID; fall back to getRandomValues hex; last resort Date.now.
 */

export function secureId(prefix = ""): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    const id = globalThis.crypto.randomUUID();
    return prefix ? `${prefix}${id}` : id;
  }
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(8);
    globalThis.crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return prefix ? `${prefix}${hex}` : hex;
  }
  const fallback = String(Date.now());
  return prefix ? `${prefix}${fallback}` : fallback;
}
