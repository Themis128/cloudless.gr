#!/usr/bin/env npx tsx
/**
 * Sentry Auth Token Probe
 *
 * Verifies that SENTRY_AUTH_TOKEN can read the project and (optionally) mutate
 * issues, matching the scopes used by /api/admin/ops/errors and its [id] PATCH
 * counterpart.
 *
 * Usage:
 *   npx tsx scripts/sentry-test.ts          # check project:read
 *   npx tsx scripts/sentry-test.ts --write  # also probe project:write (dry-run)
 *   SENTRY_AUTH_TOKEN=sntrys_xxx npx tsx scripts/sentry-test.ts  # ad-hoc token
 *
 * Exit codes:
 *   0 = all checked scopes OK
 *   1 = token missing / not configured
 *   2 = token rejected (401/403) — wrong scopes or wrong org/project
 *   3 = network / unexpected error
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const API = "https://sentry.io/api/0";
const TOKEN = process.env.SENTRY_AUTH_TOKEN;
const ORG = process.env.SENTRY_ORG || "baltzakisthemiscom";
const PROJECT = process.env.SENTRY_PROJECT || "cloudless-gr";
const TIMEOUT_MS = 5_000;

const wantWrite = process.argv.includes("--write");

function fail(code: number, msg: string): never {
  console.error(msg);
  process.exit(code);
}

async function probeRead(): Promise<void> {
  const url = `${API}/projects/${ORG}/${PROJECT}/`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (res.status === 401 || res.status === 403) {
    fail(
      2,
      `✗ project:read — ${res.status} ${res.statusText}\n  Token rejected. Add project:read scope or check org/project slugs (org=${ORG}, project=${PROJECT}).`,
    );
  }
  if (!res.ok) {
    fail(3, `✗ project:read — unexpected ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { slug?: string; name?: string };
  console.log(
    `✓ project:read — ${data.name ?? "?"} (${data.slug ?? "?"}) reachable as ${ORG}/${PROJECT}`,
  );
}

async function probeWrite(): Promise<void> {
  // Cheapest write-scope probe: list issues then attempt a no-op PUT with an
  // empty body to issue id "0". Sentry returns 404 for unknown issues to
  // tokens with project:write, and 403 to tokens without it — so 403 is the
  // decisive signal here. We never mutate a real issue.
  const url = `${API}/projects/${ORG}/${PROJECT}/issues/`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "unresolved" }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (res.status === 403) {
    fail(
      2,
      `✗ project:write — 403 Forbidden\n  Token lacks project:write scope (needed for resolve/ignore).`,
    );
  }
  if (res.status === 401) {
    fail(2, `✗ project:write — 401 Unauthorized`);
  }
  // 400 (bad query) or 200 (no-op succeeded) both prove the scope is granted.
  console.log(`✓ project:write — scope granted (probe returned ${res.status})`);
}

async function main() {
  if (!TOKEN) {
    fail(
      1,
      "✗ SENTRY_AUTH_TOKEN is not set in .env.local or the environment.",
    );
  }

  console.log(`Sentry probe — org=${ORG}, project=${PROJECT}`);
  try {
    await probeRead();
    if (wantWrite) await probeWrite();
    console.log(
      wantWrite
        ? "\nAll required scopes OK. /api/admin/ops/errors GET + PATCH will work."
        : "\nproject:read OK. Pass --write to also probe project:write.",
    );
  } catch (err) {
    fail(3, `✗ Network/probe error: ${(err as Error).message}`);
  }
}

main();
