#!/usr/bin/env node

/**
 * Health probe for self-hosted OMV apps.
 *
 * Public Cloudflare hostnames may return bot-challenge 403s from this network.
 * Set APPFLOWY_API_URL / ESPOCRM_BASE_URL to LAN/NodePort URLs to bypass, or
 * CF_ACCESS_CLIENT_ID + CF_ACCESS_CLIENT_SECRET for Access service tokens.
 */

const appflowyBase = (
  process.env.APPFLOWY_LAN_URL ||
  process.env.APPFLOWY_API_URL ||
  "http://192.168.1.128:30810"
).replace(/\/$/, "");
const espocrmBase = (
  process.env.ESPOCRM_LAN_URL ||
  process.env.ESPOCRM_BASE_URL ||
  "http://192.168.1.128:30700"
).replace(/\/$/, "");

const targets = [
  { name: "AppFlowy API health", url: `${appflowyBase}/api/health` },
  { name: "AppFlowy GoTrue health", url: `${appflowyBase}/gotrue/health` },
  { name: "EspoCRM web", url: `${espocrmBase}/` },
];

function buildHeaders() {
  const headers = {};
  const cfId = process.env.CF_ACCESS_CLIENT_ID;
  const cfSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (cfId && cfSecret) {
    headers["CF-Access-Client-Id"] = cfId;
    headers["CF-Access-Client-Secret"] = cfSecret;
  }
  return headers;
}

async function probe(target) {
  const startedAt = Date.now();
  try {
    const res = await fetch(target.url, {
      headers: buildHeaders(),
      signal: AbortSignal.timeout(8000),
      redirect: "manual",
    });
    return {
      name: target.name,
      url: target.url,
      ok: res.ok || res.status === 302 || res.status === 301,
      status: res.status,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      name: target.name,
      url: target.url,
      ok: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const checks = await Promise.all(targets.map(probe));
  const ok = checks.every((check) => check.ok);
  const payload = {
    generatedAt: new Date().toISOString(),
    ok,
    checks,
  };
  console.log(JSON.stringify(payload, null, 2));
  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
