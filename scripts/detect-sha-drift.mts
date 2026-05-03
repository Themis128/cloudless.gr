/**
 * SHA drift detector — compares the source-of-truth deploy SHA in SSM
 * against the SHA each surface (cloud cloudless.gr, Pi cloudless.online)
 * actually reports via /api/health → version field.
 *
 * Pure comparison logic lives in src/lib/sha-drift.ts (unit-tested).
 * This file is the I/O wrapper + CLI entry.
 *
 * Run:
 *   pnpm tsx scripts/detect-sha-drift.mts
 *   pnpm tsx scripts/detect-sha-drift.mts --json  # machine-readable
 *
 * Exit:
 *   0 — all surfaces agree (or grace window applies)
 *   1 — drift detected outside the grace window
 *   2 — could not read SSM (no AWS creds, network, etc.)
 */

import { request as httpsRequest } from "node:https";
import { evaluateDrift, type DriftSnapshot } from "../src/lib/sha-drift.ts";

const HEALTH_URLS = {
  cloud: "https://cloudless.gr/api/health",
  pi: "https://cloudless.online/api/health",
} as const;
const SSM_PARAM = "/cloudless/production/current-image-sha";
const REGION = process.env.AWS_REGION ?? "us-east-1";

function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const req = httpsRequest(url, { method: "GET", timeout: 10_000 }, (res) => {
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

async function readSsm(): Promise<{ value: string; modifiedAt: Date } | null> {
  try {
    const { SSMClient, GetParameterCommand } = await import("@aws-sdk/client-ssm");
    const ssm = new SSMClient({ region: REGION });
    const out = await ssm.send(new GetParameterCommand({ Name: SSM_PARAM }));
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
  const [ssm, cloudJson, piJson] = await Promise.all([
    readSsm(),
    fetchJson(HEALTH_URLS.cloud),
    fetchJson(HEALTH_URLS.pi),
  ]);
  if (!ssm) return null;
  return {
    expected: ssm.value,
    ssmModifiedAt: ssm.modifiedAt,
    cloud: typeof cloudJson?.version === "string" ? cloudJson.version : null,
    pi: typeof piJson?.version === "string" ? piJson.version : null,
  };
}

const wantJson = process.argv.includes("--json");
const snap = await snapshot();
if (!snap) {
  console.error("Could not read SSM source of truth — check AWS creds.");
  process.exit(2);
}
const report = evaluateDrift(snap);

if (wantJson) {
  console.log(JSON.stringify({ snapshot: snap, report }, null, 2));
} else {
  console.log(`\nSHA drift report — expected: ${snap.expected.slice(0, 12)}…`);
  console.log(
    `  age: ${report.ageMs !== null ? `${Math.round(report.ageMs / 60_000)}m` : "?"}`,
  );
  console.log(`  within grace: ${report.withinGrace ? "yes" : "no"}`);
  for (const s of report.surfaces) {
    const mark = s.matches ? "✓" : "✗";
    const actual = s.actual ? s.actual.slice(0, 12) + "…" : "(null)";
    console.log(`  ${mark} ${s.name.padEnd(5)} actual=${actual.padEnd(15)} ${s.reason}`);
  }
  console.log(`  drifted: ${report.drifted ? "YES" : "no"}\n`);
}

process.exit(report.drifted ? 1 : 0);
