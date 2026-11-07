/**
 * funnel-events — streams funnel/publish/site events into the Cloudflare
 * Pipeline (R2 → Iceberg tables on the cloudless-datalake bucket).
 * DuckDB on omv k3s reads the tables for Metabase funnel dashboards.
 *
 *   POST /event  {type, payload}   Bearer-authed
 *   GET  /health
 *
 * Event types (allowlisted): lead.created, audit.booked, nurture.sent,
 * quiet.sent, post.published, site.pageview.
 */

interface Env {
  FUNNEL_PIPELINE: Pipeline;
  EVENTS_TOKEN: string;
}

const TYPES = new Set([
  "lead.created",
  "audit.booked",
  "nurture.sent",
  "quiet.sent",
  "post.published",
  "site.pageview",
]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "funnel-events" });
    }
    const auth = request.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token || token !== env.EVENTS_TOKEN) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    if (request.method !== "POST" || url.pathname !== "/event") {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    let body: { type?: string; payload?: unknown };
    try {
      body = ((await request.json()) ?? {}) as typeof body;
    } catch {
      return Response.json({ error: "invalid_json" }, { status: 400 });
    }
    if (!body.type || !TYPES.has(body.type)) {
      return Response.json(
        { error: `type must be one of: ${[...TYPES].join(", ")}` },
        { status: 400 }
      );
    }
    await env.FUNNEL_PIPELINE.send([
      {
        type: body.type,
        payload: body.payload ?? {},
        ts: new Date().toISOString(),
        source: request.headers.get("cf-connecting-ip") ? "edge" : "internal",
      },
    ]);
    return Response.json({ ok: true });
  },
};
