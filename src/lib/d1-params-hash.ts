/**
 * Deterministic short key for D1 cache `sk` columns.
 * Not a password hash — FNV-1a over canonical JSON (no node:crypto hotspot).
 */

export function paramsHash(params: Record<string, unknown> = {}): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return "default";

  const canonical = JSON.stringify(entries);
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < canonical.length; i++) {
    h ^= BigInt(canonical.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}
