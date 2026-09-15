/**
 * Pure SHA drift comparison logic (Cloudflare Free — no AWS SSM).
 *
 * I/O lives in scripts/detect-sha-drift.mts. Expected SHAs come from peer
 * /api/health versions (apex + pi-origin), not SSM params.
 */

export interface DriftSnapshot {
  /** Expected SHA for cloudless.gr (usually apex /api/health version). */
  cloudExpected: string;
  /** Expected SHA for pi-origin (usually same Pi deploy SHA). */
  piExpected: string;
  /** cloudless.gr/api/health.version, or null if unreachable. */
  cloud: string | null;
  /** pi-origin.cloudless.gr/api/health.version, or null if unreachable. */
  pi: string | null;
  /** Legacy field; unused in CF-only mode (always null). */
  cloudSsmModifiedAt: Date | null;
  /** Legacy field; unused in CF-only mode (always null). */
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
 * Optional grace window after a deploy timestamp. CF-only mode leaves
 * modified-at null so grace never applies (peer health versions should match).
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
  } else if (!matches) reason = "SHA differs from peer /api/health version";
  return { name, actual, matches, reason };
}

/**
 * Build a DriftReport from a snapshot. Pure; takes `now` so tests can pin
 * the clock and exercise the grace-window edges deterministically.
 */
export function evaluateDrift(snapshot: DriftSnapshot, now: number = Date.now()): DriftReport {
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
  const drifted = anyMismatch && !withinGrace;
  return { drifted, ageMs, withinGrace, surfaces };
}
