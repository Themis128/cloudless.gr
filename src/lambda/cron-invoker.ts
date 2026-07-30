/**
 * Legacy Lambda cron invoker — Cloudflare-first: reads CRON_SECRET from env
 * (k8s secret / Wrangler), not AWS SSM. Prefer CF Cron Triggers or Pi CronJobs.
 */

export async function handler() {
  const siteUrl = process.env.SITE_URL;
  const route = process.env.CRON_ROUTE;
  const secret = process.env.CRON_SECRET;

  if (!siteUrl || !route) {
    throw new Error(`Missing env: SITE_URL=${siteUrl}, CRON_ROUTE=${route}`);
  }
  if (!secret) {
    throw new Error("CRON_SECRET env is required (set via k8s/Wrangler secrets)");
  }

  const res = await fetch(`${siteUrl}${route}`, {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(55_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cron ${route} responded ${res.status}: ${body.slice(0, 200)}`);
  }

  const payload = await res.json().catch(() => null);
  return { statusCode: res.status, route, payload };
}
