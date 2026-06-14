/**
 * SHA drift detector — compares the source-of-truth deploy SHA in SSM
 * against the SHA each surface (cloud cloudless.gr, Pi pi-origin.cloudless.gr)
 * actually reports via /api/health → version field.
 *
 * Each surface has its own SSM param so the two deploy pipelines can't
 * overwrite each other:
 *   deploy.yml     → /cloudless/production/cloud-sha  (full GITHUB_SHA)
 *   deploy-pi.yml  → /cloudless/production/pi-sha     (12-char short SHA)
 *
 * Run:
 *   pnpm tsx scripts/detect-sha-drift.mts
 *   pnpm tsx scripts/detect-sha-drift.mts --json   # machine-readable
 *
 * Exit:
 *   0 — all surfaces agree (or grace window applies)
 *   1 — drift detected outside the grace window
 *   2 — could not read SSM (no AWS creds, network, etc.)
 *
 * NOTE on duplication
 * -------------------
 * The `shaEquivalent` + `evaluateDrift` logic below is intentionally
 * duplicated from src/lib/sha-drift.ts. The lib copy is what the unit
 * tests in __tests__/detect-sha-drift.test.ts exercise; the inline
 * copy here is what the CLI runs. Cross-importing through tsx in CI
 * has been brittle (tsx's loader doesn't always transform imported
 * .ts files when invoked via pnpm exec — the same export disappears
 * with `.ts`, `.js`, and the `@/` alias forms), so the script is
 * deliberately self-contained. The static check in
 * __tests__/sha-drift-inline-parity.test.ts pins the two copies to
 * stay in sync.
 */

import { request as httpsRequest } from "node:https";

// ───────────────────────────────────────────────────────────────────────
// Inlined pure logic — keep in sync with src/lib/sha-drift.ts
// ───────────────────────────────────────────────────────────────────────

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
  } else if (!matches) reason = "SHA differs from SSM source of truth";
  return { name, actual, matches, reason };
}

function evaluateDrift(snapshot: DriftSnapshot, now: number = Date.now()): DriftReport {
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
  const drifted = anyMismatch && !withinGrace;
  return { drifted, ageMs, withinGrace, surfaces };
}

// ───────────────────────────────────────────────────────────────────────
// I/O
// ───────────────────────────────────────────────────────────────────────

const HEALTH_URLS = {
  cloud: "https://www.cloudless.gr/api/health",
  pi: "https://pi-origin.cloudless.gr/api/health",
} as const;
const SSM_CLOUD = "/cloudless/production/cloud-sha";
const SSM_PI = "/cloudless/production/pi-sha";
const REGION = process.env.AWS_REGION ?? "us-east-1";

function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    // Happy Eyeballs (RFC 8305): fall through to IPv4 after 250 ms instead
    // of hanging the full 10 s timeout when IPv6 is unreachable from CI.
    const req = httpsRequest(
      url,
      {
        method: "GET",
        timeout: 10_000,
        autoSelectFamily: true,
        autoSelectFamilyAttemptTimeout: 250,
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
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

async function readSsmParam(
  ssm: import("@aws-sdk/client-ssm").SSMClient,
  name: string,
): Promise<{ value: string; modifiedAt: Date } | null> {
  const { GetParameterCommand } = await import("@aws-sdk/client-ssm");
  try {
    const out = await ssm.send(new GetParameterCommand({ Name: name }));
    if (!out.Parameter?.Value) return null;
    return {
      value: out.Parameter.Value,
      modifiedAt: out.Parameter.LastModifiedDate ?? new Date(0),
    };
  } catch {
    return null;
  }
}

async function snapshot(): Promise<DriftSnapshot | null> {
  const { SSMClient } = await import("@aws-sdk/client-ssm");
  const ssmClient = new SSMClient({ region: REGION });
  const [cloudSsm, piSsm, cloudJson, piJson] = await Promise.all([
    readSsmParam(ssmClient, SSM_CLOUD),
    readSsmParam(ssmClient, SSM_PI),
    fetchJson(HEALTH_URLS.cloud),
    fetchJson(HEALTH_URLS.pi),
  ]);
  if (!cloudSsm || !piSsm) return null;
  return {
    cloudExpected: cloudSsm.value,
    piExpected: piSsm.value,
    cloudSsmModifiedAt: cloudSsm.modifiedAt,
    piSsmModifiedAt: piSsm.modifiedAt,
    cloud: typeof cloudJson?.version === "string" ? cloudJson.version : null,
    pi: typeof piJson?.version === "string" ? piJson.version : null,
  };
}

async function main(): Promise<void> {
  const jsonMode = process.argv.includes("--json");

  const data = await snapshot();
  if (!data) {
    const out = { error: "Could not read SSM parameters — check AWS credentials." };
    if (jsonMode) console.log(JSON.stringify(out, null, 2));
    else console.error("[sha-drift] " + out.error);
    process.exit(2);
  }

  const report = evaluateDrift(data);

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const icon = report.drifted ? "❌" : report.withinGrace ? "⏳" : "✅";
    console.log(`${icon} SHA drift report`);
    for (const s of report.surfaces) {
      const mark = s.matches ? "✓" : "✗";
      console.log(`  ${mark} ${s.name}: ${s.actual ?? "(null)"} — ${s.reason}`);
    }
    if (report.ageMs !== null) {
      console.log(`  SSM age: ${Math.round(report.ageMs / 1000)}s`);
    }
  }

  process.exit(report.drifted ? 1 : 0);
}

void main();
