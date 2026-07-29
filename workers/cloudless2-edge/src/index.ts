/**
 * Free-tier edge Worker for cloudless2.
 * Full OpenNext SSR exceeds the free 3 MiB Worker size limit — this Worker:
 *  - Owns Custom Domains (apex + www)
 *  - Runs Workers Cron Triggers (no Bot Fight)
 *  - Proxies HTTP to Pi Tunnel origin (pi-origin.cloudless.gr)
 */
const PI_ORIGIN = "https://pi-origin.cloudless.gr";

const CRON_ROUTES: Record<string, string> = {
  "*/15 * * * *": "/api/cron/postiz-sync",
  "5 * * * *": "/api/cron/postiz-oauth-check",
  "0 6 * * 1": "/api/cron/owner-digest",
  "0 8 1 * *": "/api/cron/client-reports",
  "0 1 * * *": "/api/cron/analytics-rollup",
};

export interface Env {
  CRON_SECRET?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  PI_ORIGIN_HOST?: string;
}

function originBase(env: Env): string {
  const host = env.PI_ORIGIN_HOST?.replace(/^https?:\/\//, "");
  return host ? `https://${host}` : PI_ORIGIN;
}

async function invokeCron(env: Env, path: string): Promise<Response> {
  const secret = env.CRON_SECRET;
  if (!secret) {
    console.error("[cron] CRON_SECRET missing", path);
    return new Response("Unauthorized", { status: 401 });
  }
  // Hit Pi origin directly — same Tailscale/Tunnel path, no Bot Fight on GH IPs.
  const url = `${originBase(env)}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
      "x-cron-internal": "workers-scheduled",
      "x-forwarded-host": "cloudless.gr",
    },
  });
  console.log(`[cron] ${path} → ${res.status}`);
  return res;
}

async function proxyToPi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, originBase(env));

  const headers = new Headers(request.headers);
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", "https");
  headers.delete("host");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    // @ts-expect-error duplex required for streaming body in Workers
    init.duplex = "half";
  }

  try {
    return await fetch(target, init);
  } catch (err) {
    console.error("[proxy] Pi origin failed", err);
    return Response.json(
      { status: "degraded", error: "origin_unreachable", timestamp: new Date().toISOString() },
      { status: 502 }
    );
  }
}

const worker = {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const path = CRON_ROUTES[controller.cron];
    if (!path) {
      console.warn("[cron] unmapped", controller.cron);
      return;
    }
    ctx.waitUntil(
      invokeCron(env, path).then(async (res) => {
        const body = await res.text().catch(() => "");
        console.log(`[cron] done ${controller.cron} ${res.status} ${body.slice(0, 200)}`);
      })
    );
  },

  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health" && request.method === "GET") {
      // Edge liveness + optional Pi check
      let originOk = false;
      let originStatus = 0;
      let originHint = "";
      try {
        const r = await fetch(`${originBase(env)}/api/health`, {
          signal: AbortSignal.timeout(8000),
          headers: {
            "user-agent": "cloudless2-edge-health/1.0",
            accept: "application/json",
          },
        });
        originStatus = r.status;
        originOk = r.ok;
        const text = await r.text().catch(() => "");
        originHint = text.slice(0, 120).replace(/\s+/g, " ");
      } catch (err) {
        originOk = false;
        originHint = err instanceof Error ? err.message : "fetch_failed";
      }
      // Non-200 when Pi is down so HTTP-only probes (and GH Actions) fail closed.
      return Response.json(
        {
          status: originOk ? "ok" : "degraded",
          edge: "cloudless2-thin",
          origin: originOk ? "up" : "down",
          originStatus,
          originHint,
          authProvider: "d1",
          timestamp: new Date().toISOString(),
        },
        { status: originOk ? 200 : 503 }
      );
    }

    // All app traffic → Pi Tunnel origin (full Next.js on k3s).
    return proxyToPi(request, env);
  },
};

export default worker;
