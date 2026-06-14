/**
 * Pure SHA drift comparison logic.
 *
 * I/O lives in scripts/detect-sha-drift.mts (which imports from this
 * module). Keeping the comparison pure makes it directly unit-testable
 * without mocking SSM clients or HTTPS requests.
 *
 * Each surface (cloud / Pi) has its own SSM source-of-truth param so
 * that the two independent deploy pipelines don't overwrite each other:
 *   deploy.yml       → /cloudless/production/cloud-sha  (full GITHUB_SHA)
 *   deploy-pi.yml    → /cloudless/production/pi-sha     (12-char short SHA)
 */

export interface DriftSnapshot {
  /** deploy.yml SHA — source of truth for cloudless.gr. */
  cloudExpected: string;
  /** deploy-pi.yml SHA — source of truth for the Pi surface. */
  piExpected: string;
  /** www.cloudless.gr/api/health.version, or null if unreachable. */
  cloud: string | null;
  /** pi-origin.cloudless.gr/api/health.version, or null if unreachable. */
  pi: string | null;
  /** When the cloud SSM param was last updated; null if unknown. */
  cloudSsmModifiedAt: Date | null;
  /** When the Pi SSM param was last updated; null if unknown. */
  piSsmModifiedAt: Date | null;
}

export interface SurfaceStatus {
  name: "cloud" | "pi";
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
 * Newly published SSM SHA needs this long for both surfaces to converge
 * (Lambda cold start + Pi K3s rolling update). Drift inside this window
 * is normal mid-rollout and should not page.
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

function classifySurface(
  name: "cloud" | "pi",
  expected: string,
  actual: string | null
): SurfaceStatus {
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
 *
 * Grace window is computed from the most recently updated SSM param so
 * that a fresh deploy to either surface suppresses false-positive drift
 * alerts during rollout convergence.
 */
export function evaluateDrift(snapshot: DriftSnapshot, now: number = Date.now()): DriftReport {
  // Use the most recent SSM write across both surfaces for the grace window.
  const dates = [snapshot.cloudSsmModifiedAt, snapshot.piSsmModifiedAt].filter(
    (d): d is Date => d !== null
  );
  const latestModified =
    dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
  const ageMs = latestModified ? now - latestModified.getTime() : null;
  const withinGrace = ageMs !== null && ageMs < GRACE_WINDOW_MS;

  const surfaces: SurfaceStatus[] = [
    classifySurface("cloud", snapshot.cloudExpected, snapshot.cloud),
    classifySurface("pi", snapshot.piExpected, snapshot.pi),
  ];

  const anyMismatch = surfaces.some((s) => !s.matches);
  // During grace window we count mismatches as expected and don't fail.
  const drifted = anyMismatch && !withinGrace;
  return { drifted, ageMs, withinGrace, surfaces };
}
