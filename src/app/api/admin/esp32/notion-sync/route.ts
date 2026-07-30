/**
 * Admin — ESP32 → Notion sync endpoint.
 *
 * Pulls the current device snapshot from the Pi Alert API and mirrors it into
 * the Notion devices DB so the admin UI keeps showing useful state even when
 * the cluster is offline. Intended to be invoked either:
 *
 *   - On-demand by the admin UI (button) — POST
 *   - On a schedule (k8s CronJob / CF Cron)                  — POST with X-Cron-Secret
 *   - For reading the latest Notion-cached snapshot          — GET
 *
 * Returns the synced device id(s) or the cached snapshot list.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { safeEqual } from "@/lib/cron-auth";
import { getConfig } from "@/lib/ssm-config";
import {
  isEsp32NotionConfigured,
  getEsp32NotionConfig,
  upsertEsp32DeviceInNotion,
  readEsp32DevicesFromNotion,
  type Esp32Status,
} from "@/lib/notion-esp32";

const ALERT_API_URL = process.env.ALERT_API_URL ?? "http://192.168.1.128:30800";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const cfg = await getEsp32NotionConfig();
  if (!isEsp32NotionConfigured(cfg)) {
    return NextResponse.json(
      {
        configured: false,
        message:
          "NOTION_ESP32_DEVICES_DB_ID is not set. ESP32 ↔ Notion mirror disabled.",
        devices: [],
      },
      { status: 200 },
    );
  }

  try {
    const devices = await readEsp32DevicesFromNotion();
    return NextResponse.json({ configured: true, devices });
  } catch (err) {
    console.error("[esp32/notion-sync] Notion read failed:", err);
    return NextResponse.json({ error: "Notion read failed" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  // Allow either an authenticated admin OR a server-to-server cron call with
  // the shared secret (k8s CronJob / Cloudflare Cron).
  const ssmCfg = await getConfig().catch(() => null);
  const cronSecret = ssmCfg?.CRON_SECRET ?? process.env.CRON_SECRET;
  const headerSecret = request.headers.get("x-cron-secret");
  const isCron =
    cronSecret &&
    headerSecret &&
    safeEqual(headerSecret, cronSecret);

  if (!isCron) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;
  }

  const cfg = await getEsp32NotionConfig();
  if (!isEsp32NotionConfigured(cfg)) {
    return NextResponse.json(
      {
        configured: false,
        message: "NOTION_ESP32_DEVICES_DB_ID is not set. Sync skipped.",
      },
      { status: 200 },
    );
  }

  // 1) Pull from the Alert API
  let status: Esp32Status | null = null;
  try {
    const res = await fetch(`${ALERT_API_URL}/api/esp32/status`, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json(
        {
          error: `Alert API HTTP ${res.status}`,
          offline: true,
        },
        { status: 503 },
      );
    }
    status = (await res.json()) as Esp32Status;
  } catch (err) {
    console.error("[esp32/notion-sync] Alert API unreachable:", err);
    return NextResponse.json({ error: "Alert API unreachable", offline: true }, { status: 503 });
  }

  // 2) Push into Notion
  try {
    const pageId = await upsertEsp32DeviceInNotion(status);
    return NextResponse.json({
      ok: true,
      synced: pageId,
      device_id: status.device_id,
      last_heartbeat: status.last_heartbeat,
    });
  } catch (err) {
    console.error("[esp32/notion-sync] Notion write failed:", err);
    return NextResponse.json({ error: "Notion write failed" }, { status: 502 });
  }
}
