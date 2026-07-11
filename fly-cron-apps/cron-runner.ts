#!/usr/bin/env tsx

/**
 * Fly.io Cron Runner - Replaces AWS Lambda Cron Jobs
 *
 * Schedule via Fly.io Machines API or crontab in container.
 * The CLOUDLESS_CRON_SECRET is fetched from Fly.io secrets.
 */

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const CRON_ROUTE = process.env.CRON_ROUTE || "";
const SITE_URL = process.env.SITE_URL || "https://cloudless.gr";
const SSM_PREFIX = process.env.SSM_PREFIX || "/cloudless/production";

if (!CRON_ROUTE) {
  console.error("[cron-runner] CRON_ROUTE environment variable not set");
  process.exit(1);
}

async function getCronSecret(): Promise<string> {
  const ssm = new SSMClient({ region: "us-east-1" });
  const { Parameter } = await ssm.send(
    new GetParameterCommand({
      Name: `${SSM_PREFIX}/CRON_SECRET`,
      WithDecryption: true,
    })
  );
  return Parameter?.Value || "";
}

async function triggerCron(): Promise<void> {
  const secret = await getCronSecret();
  if (!secret) {
    console.error("[cron-runner] CRON_SECRET not found");
    process.exit(1);
  }

  console.log(`[cron-runner] Triggering ${SITE_URL}${CRON_ROUTE}`);

  const resp = await fetch(`${SITE_URL}${CRON_ROUTE}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(55_000),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Cron responded ${resp.status}: ${body.slice(0, 200)}`);
  }

  const payload = await resp.json().catch(() => null);
  console.log(`[cron-runner] Success!`, JSON.stringify(payload));
}

triggerCron().catch((err) => {
  console.error("[cron-runner] Failed:", err);
  process.exit(1);
});