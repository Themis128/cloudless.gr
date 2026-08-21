import { NextRequest, NextResponse } from "next/server";
import type { EspoEntityRecord } from "@/lib/espocrm-webhook";
import { dispatchEspoEvent } from "@/lib/espocrm-dispatch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/webhooks/espocrm/fanout — called by the espocrm-fanout Queue consumer.
 * Auth: Bearer ESPOCRM_QUEUE_PRODUCER_SECRET (same secret as the producer Worker).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.ESPOCRM_QUEUE_PRODUCER_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "queue_not_configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { entity?: string; action?: string; records?: EspoEntityRecord[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const entity = String(body.entity ?? "");
  const action = String(body.action ?? "");
  const records = Array.isArray(body.records) ? body.records : [];
  if (!entity || !action) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  await dispatchEspoEvent(entity, action, records);
  return NextResponse.json({ ok: true, dispatched: records.length });
}
