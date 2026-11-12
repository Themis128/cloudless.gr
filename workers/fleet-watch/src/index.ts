/**
 * fleet-watch — CF-side health probes for the worker fleet.
 *
 * Runs on a Cron Trigger every 5 min so coverage survives host sleep
 * (the home-ops cf-workers-health.py cron is the host-side twin).
 * State + alert dedupe live in D1 (`fleet_watch_state` table, lazy-init —
 * same pattern as the portfolio worker; deploy token lacks D1 mgmt scope).
 *
 * Secrets: TG_BOT_TOKEN, TG_CHAT_ID (ops channel).
 */

interface Env {
  DB: D1Database;
  TG_BOT_TOKEN?: string;
  TG_CHAT_ID?: string;
}

interface Probe {
  name: string;
  url: string;
  good: number[];
}

const PROBES: Probe[] = [
  { name: "portfolio", url: "https://portfolio.cloudless.gr/", good: [200] },
  {
    name: "portfolio-api",
    url: "https://portfolio.cloudless.gr/analytics",
    good: [200],
  },
  {
    name: "www-cloudless",
    url: "https://www-cloudless.baltzakis-themis.workers.dev/",
    good: [200],
  },
  {
    name: "mail-outbound",
    url: "https://mail-outbound.baltzakis-themis.workers.dev/health",
    good: [200],
  },
  {
    name: "lead-scheduler",
    url: "https://lead-scheduler.baltzakis-themis.workers.dev/health",
    good: [200],
  },
  {
    name: "funnel-events",
    url: "https://funnel-events.baltzakis-themis.workers.dev/health",
    good: [200],
  },
  {
    name: "edge-forms",
    url: "https://edge-forms.baltzakis-themis.workers.dev/health",
    good: [200],
  },
  {
    name: "postiz-ai-proxy",
    url: "https://postiz-ai-proxy.baltzakis-themis.workers.dev/health",
    good: [200, 401, 403], // auth-gated: any response means the worker is up
  },
  {
    name: "cloudless-gr",
    url: "https://cloudless.gr/",
    good: [200, 301, 302, 307, 308], // cloudless2 proxy -> Pi; redirects are healthy
  },
];

const REALERT_S = 6 * 3600;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS fleet_watch_state (
    probe TEXT PRIMARY KEY,
    failing INTEGER NOT NULL DEFAULT 0,
    last_alert INTEGER NOT NULL DEFAULT 0
  )`,
];

let schemaReady: Promise<void> | null = null;
function ensureSchema(env: Env): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const stmt of SCHEMA) {
        await env.DB.prepare(stmt).run();
      }
    })();
  }
  return schemaReady;
}

async function tg(env: Env, text: string): Promise<void> {
  if (!env.TG_BOT_TOKEN || !env.TG_CHAT_ID) return;
  const res = await fetch(
    `https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text: text.slice(0, 4000) }),
    }
  );
  if (!res.ok) console.warn("tg sendMessage non-2xx:", res.status);
}

async function probe(p: Probe): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(p.url, {
      headers: { "User-Agent": "fleet-watch/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    return {
      ok: p.good.includes(res.status),
      detail: `GET ${p.url} -> ${res.status}`,
    };
  } catch (e) {
    return { ok: false, detail: `GET ${p.url} -> ${String(e)}` };
  }
}

async function sweep(env: Env): Promise<void> {
  await ensureSchema(env);
  const now = Math.floor(Date.now() / 1000);
  for (const p of PROBES) {
    const { ok, detail } = await probe(p);
    const row = await env.DB.prepare(
      "SELECT failing, last_alert FROM fleet_watch_state WHERE probe = ?"
    )
      .bind(p.name)
      .first<{ failing: number; last_alert: number }>();
    const wasFailing = row?.failing === 1;
    const lastAlert = row?.last_alert ?? 0;

    if (!ok) {
      if (!wasFailing || now - lastAlert > REALERT_S) {
        await tg(env, `[P2] [fleet-watch] ${p.name} FAIL: ${detail}`);
        await env.DB.prepare(
          `INSERT INTO fleet_watch_state (probe, failing, last_alert)
           VALUES (?, 1, ?)
           ON CONFLICT(probe) DO UPDATE SET failing=1, last_alert=excluded.last_alert`
        )
          .bind(p.name, now)
          .run();
      }
    } else {
      if (wasFailing) {
        await tg(env, `[P2] [fleet-watch] ${p.name} recovered`);
      }
      await env.DB.prepare(
        `INSERT INTO fleet_watch_state (probe, failing, last_alert)
         VALUES (?, 0, 0)
         ON CONFLICT(probe) DO UPDATE SET failing=0, last_alert=0`
      )
        .bind(p.name)
        .run();
    }
    console.log(`${p.name}: ${ok ? "OK" : "FAIL"} ${detail}`);
  }
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(sweep(env).catch((e) => console.error("sweep failed", e)));
  },

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, worker: "fleet-watch" });
    }
    return new Response("fleet-watch — cron worker, see /health", { status: 200 });
  },
};
