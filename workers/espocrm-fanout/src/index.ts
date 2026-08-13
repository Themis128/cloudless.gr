/**
 * EspoCRM webhook fan-out Worker.
 * POST /enqueue (Bearer ESPOCRM_QUEUE_PRODUCER_SECRET) → Queue
 * queue consumer → POST ESPOCRM_FANOUT_CALLBACK_URL (Pi) with same secret
 *
 * Keeps Pi webhook ACK fast while Slack/n8n fan-out runs asynchronously.
 */

export interface Env {
  ESPOCRM_EVENTS: Queue;
  ESPOCRM_QUEUE_PRODUCER_SECRET: string;
  ESPOCRM_FANOUT_CALLBACK_URL: string;
}

type QueueMsg = {
  entity: string;
  action: string;
  records: unknown[];
  enqueuedAt: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "espocrm-fanout" });
    }

    if (request.method === "POST" && (url.pathname === "/enqueue" || url.pathname === "/")) {
      const auth = request.headers.get("authorization") ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!token || token !== env.ESPOCRM_QUEUE_PRODUCER_SECRET) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }

      let body: QueueMsg;
      try {
        body = (await request.json()) as QueueMsg;
      } catch {
        return Response.json({ error: "invalid_json" }, { status: 400 });
      }

      if (!body.entity || !body.action || !Array.isArray(body.records)) {
        return Response.json({ error: "invalid_payload" }, { status: 400 });
      }

      await env.ESPOCRM_EVENTS.send({
        entity: body.entity,
        action: body.action,
        records: body.records,
        enqueuedAt: body.enqueuedAt || new Date().toISOString(),
      });

      return Response.json({ ok: true, queued: body.records.length });
    }

    return new Response("Not Found", { status: 404 });
  },

  async queue(batch: MessageBatch<QueueMsg>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      try {
        const res = await fetch(env.ESPOCRM_FANOUT_CALLBACK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.ESPOCRM_QUEUE_PRODUCER_SECRET}`,
          },
          body: JSON.stringify(msg.body),
        });
        if (!res.ok) {
          console.error("[espocrm-fanout] callback failed", res.status);
          msg.retry();
        } else {
          msg.ack();
        }
      } catch (err) {
        console.error("[espocrm-fanout] callback error", err);
        msg.retry();
      }
    }
  },
};
