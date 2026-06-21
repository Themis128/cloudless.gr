#!/usr/bin/env node
/**
 * Provision (create or update) the AWS Cost dashboard in Grafana.
 *
 * R9 — one-shot helper. Reads infrastructure/grafana/dashboards/aws-cost.json
 * and POSTs to Grafana's `/api/dashboards/db` endpoint. Uses the same SSM keys
 * the Next.js app reads: GRAFANA_BASE_URL + GRAFANA_API_TOKEN.
 *
 * Usage:
 *   node scripts/provision-aws-cost-dashboard.mjs
 *
 * Re-running is safe — `overwrite: true` updates in place and bumps the
 * Grafana version counter.
 */

import { readFileSync } from "fs";
import { execSync } from "child_process";
import { resolve } from "path";

const REGION = process.env.AWS_REGION || "us-east-1";

function getSsm(name) {
  try {
    return execSync(
      `aws ssm get-parameter --name /cloudless/production/${name} --with-decryption --query Parameter.Value --output text --region ${REGION}`,
      { encoding: "utf8" }
    ).trim();
  } catch (e) {
    if (process.env.DEBUG) console.warn(`SSM ${name} not readable:`, e.message);
    return "";
  }
}

async function main() {
  const baseUrl = (process.env.GRAFANA_BASE_URL || getSsm("GRAFANA_BASE_URL") || "https://grafana.cloudless.gr").replace(/\/$/, "");
  const token = process.env.GRAFANA_API_TOKEN || getSsm("GRAFANA_API_TOKEN");
  if (!token) {
    console.error("GRAFANA_API_TOKEN not in env or SSM. Mint a Grafana service-account token first.");
    process.exit(1);
  }

  const dashPath = resolve(process.cwd(), "infrastructure/grafana/dashboards/aws-cost.json");
  const dashboard = JSON.parse(readFileSync(dashPath, "utf8"));
  const body = {
    dashboard,
    overwrite: true,
    message: "Provisioned via scripts/provision-aws-cost-dashboard.mjs (R9)",
  };

  const res = await fetch(`${baseUrl}/api/dashboards/db`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Grafana ${res.status}: ${text.slice(0, 500)}`);
    process.exit(1);
  }
  console.log(`✅ Provisioned: ${text}`);
  console.log(`Open: ${baseUrl}/d/aws-cost`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
