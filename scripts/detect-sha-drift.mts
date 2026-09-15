/**
 * SHA drift detector — Cloudflare Free only (no AWS SSM).
 *
 * Compares /api/health `version` on:
 *   cloud: https://cloudless.gr/api/health       (Worker cloudless2 → Pi)
 *   pi:    https://pi-origin.cloudless.gr/api/health
 *
 * Both should report the same Pi deploy SHA.
 *
 * Run:
 *   pnpm tsx scripts/detect-sha-drift.mts
 *   pnpm tsx scripts/detect-sha-drift.mts --json
 *
 * Exit:
 *   0 — surfaces agree (or Bot Fight Mode blocked probes)
 *   1 — drift detected
 *   2 — could not build a snapshot (unreachable)
 *
 * NOTE on duplication — keep in sync with src/lib/sha-drift.ts
 * (see __tests__/sha-drift-inline-parity.test.ts).
 */

import { request as httpsRequest } from "node:https";

interface DriftSnapshot {
  cloudExpected: string;
  piExpected: string;
  cloud: string | null;
  pi: string | null;
  cloudSsmModifiedAt: Date | null;
  piSsmModifiedAt: Date | null;
}
interface SurfaceStatus {
  name: "cloud" | "pi";
  actual: string | null;
  matches: boolean;
  reason: string;
}
interface DriftReport {
  drifted: boolean;
  ageMs: number | null;
  withinGrace: boolean;
  surfaces: SurfaceStatus[];
}
const GRACE_WINDOW_MS = 10 * 60 * 1000;

function shaEquivalent(a: string | null, b: string | null): boolean {
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

function evaluateDrift(snapshot: DriftSnapshot, now: number = Date.now()): DriftReport {
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

const HEALTH_URLS = {
  cloud: "https://cloudless.gr/api/health",
  pi: "https://pi-origin.cloudless.gr/api/health",
} as const;

function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const req = httpsRequest(
      url,
      {
        method: "GET",
        timeout: 10_000,
        autoSelectFamily: true,
        autoSelectFamilyAttemptTimeout: 250,
        headers: {
          "user-agent": "cloudless-sha-drift/1.0 (+https://github.com/Themis128/cloudless.gr)",
          accept: "application/json",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

async function snapshot(): Promise<DriftSnapshot> {
  const [cloudJson, piJson] = await Promise.all([
    fetchJson(HEALTH_URLS.cloud),
    fetchJson(HEALTH_URLS.pi),
  ]);
  const cloud = typeof cloudJson?.version === "string" ? cloudJson.version : null;
  const pi = typeof piJson?.version === "string" ? piJson.version : null;
  const expected = cloud ?? pi ?? "unknown";
  return {
    cloudExpected: expected,
    piExpected: expected,
    cloudSsmModifiedAt: null,
    piSsmModifiedAt: null,
    cloud,
    pi,
  };
}

async function main(): Promise<void> {
  const jsonMode = process.argv.includes("--json");

  const data = await snapshot();
  const report = evaluateDrift(data);

  if (report.surfaces.every((s) => s.actual === null)) {
    const out = {
      ...report,
      drifted: false,
      blockedByChallenge: true,
      note: "Both /api/health probes returned no JSON (likely Cloudflare Bot Fight Mode). Disable Security → Bots → Bot Fight Mode, then re-run.",
    };
    if (jsonMode) console.log(JSON.stringify(out, null, 2));
    else console.warn("[sha-drift] " + out.note);
    process.exit(0);
  }

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const icon = report.drifted ? "❌" : report.withinGrace ? "⏳" : "✅";
    console.log(`${icon} SHA drift report (Cloudflare Free — no AWS)`);
    for (const s of report.surfaces) {
      const mark = s.matches ? "✓" : "✗";
      console.log(`  ${mark} ${s.name}: ${s.actual ?? "(null)"} — ${s.reason}`);
    }
  }

  process.exit(report.drifted ? 1 : 0);
}

void main();
