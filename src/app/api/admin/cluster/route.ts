/**
 * GET /api/admin/cluster — Cluster health status endpoint.
 *
 * Aggregates status from:
 * - kuma-status (Uptime Kuma monitoring)
 * - mqtt-status (MQTT broker)
 * - watchdogs (system health)
 *
 * Auth: Bearer token or session cookie (admin required).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getKumaSummary, type KumaMonitor } from "@/lib/kuma";
import { readLatestAlertStatus } from "@/lib/mqtt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ClusterStatus {
  uptime: {
    status: "up" | "down" | "unknown";
    monitors: number;
    upMonitors: number;
    downMonitors: number;
  };
  mqtt: {
    connected: boolean;
    severity?: string;
  };
  nodes: Array<{
    name: string;
    status: "healthy" | "unhealthy" | "unknown";
  }>;
  fetchedAt: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    // Fetch Kuma status
    const kumaSummary = await getKumaSummary(5000);

    // Calculate allUp from monitors
    const allUp = kumaSummary?.monitors?.every((m) => m.status === "up") ?? false;

    // Fetch MQTT status
    let mqttStatus: { connected: boolean; severity?: string } = { connected: false };
    try {
      const payload = await readLatestAlertStatus(3000);
      mqttStatus = {
        connected: payload !== null,
        severity: payload?.severity,
      };
    } catch {
      mqttStatus = { connected: false };
    }

    // Build cluster status
    const status: ClusterStatus = {
      uptime: {
        status: kumaSummary ? (allUp ? "up" : "down") : "unknown",
        monitors: kumaSummary?.monitors?.length ?? 0,
        upMonitors: kumaSummary?.monitors?.filter((m) => m.status === "up")?.length ?? 0,
        downMonitors: kumaSummary?.monitors?.filter((m) => m.status !== "up")?.length ?? 0,
      },
      mqtt: mqttStatus,
      nodes: [
        {
          name: "omv",
          status: kumaSummary?.monitors?.some((m) => m.name.includes("omv") && m.status !== "up")
            ? "unhealthy"
            : "healthy",
        },
        {
          name: "omv-ha",
          status: kumaSummary?.monitors?.some((m) => m.name.includes("omv-ha") && m.status !== "up")
            ? "unhealthy"
            : "healthy",
        },
      ],
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(status, {
      headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
    });
  } catch (err) {
    console.error("[admin/cluster] Error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch cluster status",
        uptime: { status: "unknown", monitors: 0, upMonitors: 0, downMonitors: 0 },
        mqtt: { connected: false },
        nodes: [],
      },
      { status: 500 }
    );
  }
}
