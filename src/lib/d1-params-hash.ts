/**
 * Deterministic short key for D1 cache `sk` columns.
 * Not a password hash — FNV-1a 32-bit over canonical JSON (no node:crypto).
 */

export function paramsHash(params: Record<string, unknown> = {}): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return "default";

  const canonical = JSON.stringify(entries);
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
