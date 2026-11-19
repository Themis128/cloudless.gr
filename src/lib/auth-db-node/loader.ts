/**
 * Lazy loader for the Node-only local-SQLite auth backend.
 *
 * The specifier is computed so bundlers treat it as a context require scoped
 * to THIS directory only — a literal require of a node:sqlite module would be
 * traced into every graph that contains auth-d1 (proxy, server components),
 * and a computed require in src/lib made Turbpack sweep all of src/lib into
 * client/proxy bundles. Module-scoped require() still resolves at runtime in
 * the Pi standalone Node build (eval/new Function require does not).
 */
import type { AuthDatabase } from "../auth-d1";

export function loadLocalAuthDbModule(): {
  getLocalAuthDb?: () => AuthDatabase | null;
} | null {
  try {
    const spec = [".", "local"].join("/");
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- computed specifier is deliberate (see above)
    const mod = require(spec) as { getLocalAuthDb?: () => AuthDatabase | null };
    /* v8 ignore next -- vitest/webpack compile the computed require into a throwing empty context; the success path only runs in real Node bundles (Pi standalone, Turbopack dev) */
    return mod;
  } catch (err) {
    // Surface resolution/load failures — a silent null is indistinguishable
    // from "local DB not configured" in bundled/standalone Node builds.
    console.warn("[auth-db-node] local module load failed:", err);
    return null;
  }
}
