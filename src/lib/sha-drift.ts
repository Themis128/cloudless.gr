/**
 * Pure SHA drift comparison logic.
 *
 * I/O lives in scripts/detect-sha-drift.mts (which imports from this
 * module). Keeping the comparison pure makes it directly unit-testable
 * without mocking SSM clients or HTTPS requests.
 */

export interface DriftSnapshot {
  /** SSM-published SHA — source of truth, written by deploy.yml. */
  expected: string;
  /** cloudless.gr/api/health.version, or null if unreachable. */
  cloud: string | null;
  /** When SSM was last updated; null if unknown. */
  ssmModifiedAt: Date | null;
}

export interface SurfaceStatus {
  name: "cloud";
  actual: string | null;
  matches: boolean;
  reason: string;
}

export interface DriftReport {
  drifted: boolean;
  ageMs: number | null;
  withinGrace: boolean;
  surfaces: SurfaceStatus[];
}

/**
 * Newly published SSM SHA needs this long for the cloud surface to converge
 * (Lambda cold start). Drift inside this window is normal mid-rollout and
 * should not page.
 */
export const GRACE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Compare two SHA-shaped strings tolerant of length variation.
 *
 * Two SHAs match iff the shorter is a case-insensitive prefix of the
 * longer. Accepts the full 40-char `GITHUB_SHA`, the 12-char Docker tag
 * form, or git's 7-char abbreviation.
 */
export function shaEquivalent(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const lo = a.toLowerCase();
  const hi = b.toLowerCase();
  return lo.startsWith(hi) || hi.startsWith(lo);
}

function classifySurface(name: "cloud", expected: string, actual: string | null): SurfaceStatus {
  const matches = shaEquivalent(expected, actual);
  let reason = "matches expected";
  if (actual === null) reason = "endpoint unreachable or no version field";
  else if (actual === "0.1.0" || actual === "dev") {
    reason = "APP_VERSION not wired to deploy SHA — surface still serves the static fallback";
  } else if (!matches) reason = "SHA differs from SSM source of truth";
  return { name, actual, matches, reason };
}

/**
 * Build a DriftReport from a snapshot. Pure; takes `now` so tests can pin
 * the clock and exercise the grace-window edges deterministically.
 */
export function evaluateDrift(snapshot: DriftSnapshot, now: number = Date.now()): DriftReport {
  const ageMs = snapshot.ssmModifiedAt ? now - snapshot.ssmModifiedAt.getTime() : null;
  const withinGrace = ageMs !== null && ageMs < GRACE_WINDOW_MS;

  const surfaces: SurfaceStatus[] = [classifySurface("cloud", snapshot.expected, snapshot.cloud)];

  const anyMismatch = surfaces.some((s) => !s.matches);
  // During grace window we count mismatches as expected and don't fail.
  const drifted = anyMismatch && !withinGrace;
  return { drifted, ageMs, withinGrace, surfaces };
}
