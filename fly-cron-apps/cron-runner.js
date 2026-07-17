/**
 * Fly.io Cron Runner - Replaces AWS Lambda Cron Jobs
 *
 * Pure JavaScript version for Node 20-alpine container.
 * Fetches CRON_SECRET from Fly.io secrets (not AWS SSM).
 */

const CRON_ROUTE = process.env.CRON_ROUTE || "";
const SITE_URL = process.env.SITE_URL || "https://cloudless.gr";

if (!CRON_ROUTE) {
  console.error("[cron-runner] CRON_ROUTE environment variable not set");
  process.exit(1);
}

async function triggerCron() {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("[cron-runner] CRON_SECRET not found in Fly.io secrets");
    process.exit(1);
  }

  console.log(`[cron-runner] Triggering ${SITE_URL}${CRON_ROUTE}`);

  try {
    const resp = await fetch(`${SITE_URL}${CRON_ROUTE}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(55000),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`Cron responded ${resp.status}: ${body.slice(0, 200)}`);
    }

    const payload = await resp.json().catch(() => null);
    console.log("[cron-runner] Success!", JSON.stringify(payload));
  } catch (err) {
    console.error("[cron-runner] Failed:", err);
    process.exit(1);
  }
}

triggerCron();