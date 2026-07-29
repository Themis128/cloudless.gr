#!/usr/bin/env node

const targets = [
  { name: "AppFlowy API health", url: "https://appflowy.cloudless.gr/api/health" },
  { name: "AppFlowy GoTrue health", url: "https://appflowy.cloudless.gr/gotrue/health" },
  { name: "EspoCRM web", url: "https://espocrm.cloudless.gr/" },
];

async function probe(target) {
  const startedAt = Date.now();
  try {
    const res = await fetch(target.url, { signal: AbortSignal.timeout(8000) });
    return {
      name: target.name,
      url: target.url,
      ok: res.ok,
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
