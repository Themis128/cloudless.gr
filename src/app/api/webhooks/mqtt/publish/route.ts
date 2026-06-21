/**
 * POST /api/webhooks/mqtt/publish
 * ───────────────────────────────
 * HTTP → MQTT bridge. Lets any external system (n8n workflow, GitHub
 * Action, third-party webhook) publish to the cluster Mosquitto broker
 * without needing a native MQTT client.
 *
 * Auth: shared secret in `x-mqtt-publish-secret` checked against SSM
 * `NOTION_WEBHOOK_SECRET` (reused as the generic internal-webhook secret —
 * same pattern used by /api/webhooks/n8n/trigger).
 *
 * Body:
 *   {
 *     "topic":   "homelab/alerts/status",
 *     "payload": { "severity": "ok", "count": 0 },
 *     "retain":  true   // optional; defaults true for *.status topics
 *   }
 *
 * Returns 200 with `{ok: true}` on broker ACK; 401 on bad secret; 400 on
 * invalid JSON; 502 on broker failure; 503 when MQTT creds aren't in SSM.
 */
import { NextRequest, NextResponse } from "next/server";
import { isMqttConfigured, publishAlertStatus } from "@/lib/mqtt";
import { getConfig } from "@/lib/ssm-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifySecret(req: NextRequest): Promise<boolean> {
  const cfg = await getConfig();
  const expected = cfg.NOTION_WEBHOOK_SECRET;
  if (!expected) return false;
  const got = req.headers.get("x-mqtt-publish-secret");
  if (!got || got.length !== expected.length) return false;
  const { timingSafeEqual } = await import("node:crypto");
  return timingSafeEqual(Buffer.from(got, "utf8"), Buffer.from(expected, "utf8"));
}

export async function POST(req: NextRequest) {
  if (!(await verifySecret(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!(await isMqttConfigured())) {
    return NextResponse.json({ error: "mqtt_not_configured" }, { status: 503 });
  }

  let body: { topic?: string; payload?: unknown; retain?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.topic || typeof body.topic !== "string") {
    return NextResponse.json({ error: "topic required" }, { status: 400 });
  }

  // publishAlertStatus accepts arbitrary `payload` shape (we only enforce
  // the schema for the retained homelab/alerts/status topic — other topics
  // get raw JSON delivered as the broker payload).
  const result = await publishAlertStatus(body.payload as never, {
    topic: body.topic,
    retain: body.retain,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "broker_publish_failed", detail: result.error },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, topic: body.topic });
}
