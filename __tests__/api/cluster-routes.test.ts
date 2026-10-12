/**
 * Tests for /api/admin/cluster{,/kuma-status,/mqtt-status,/watchdogs}.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const apiAuth = vi.hoisted(() => ({ ok: true }));
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () =>
    apiAuth.ok
      ? { ok: true, user: { id: "u1" } }
      : { ok: false, response: NextResponse.json({ error: "no" }, { status: 401 }) }
  ),
}));

const kuma = vi.hoisted(() => ({ getKumaSummary: vi.fn() }));
vi.mock("@/lib/kuma", () => kuma);

const mqtt = vi.hoisted(() => ({ readLatestAlertStatus: vi.fn() }));
vi.mock("@/lib/mqtt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mqtt")>();
  return { ...actual, readLatestAlertStatus: mqtt.readLatestAlertStatus };
});

const k8s = vi.hoisted(() => ({
  isInCluster: vi.fn(),
  listWatchdogCronJobs: vi.fn(),
}));
vi.mock("@/lib/k8s-cluster", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/k8s-cluster")>();
  return { ...actual, ...k8s };
});

import { GET as clusterGet } from "@/app/api/admin/cluster/route";
import { GET as kumaGet } from "@/app/api/admin/cluster/kuma-status/route";
import { GET as mqttGet } from "@/app/api/admin/cluster/mqtt-status/route";
import { GET as watchdogsGet } from "@/app/api/admin/cluster/watchdogs/route";

const B = "http://localhost/api/admin/cluster";

beforeEach(() => {
  vi.clearAllMocks();
  apiAuth.ok = true;
});

describe("GET /api/admin/cluster", () => {
  it("401s non-admin", async () => {
    apiAuth.ok = false;
    expect((await clusterGet(new NextRequest(B))).status).toBe(401);
  });

  it("aggregates kuma + mqtt into cluster status", async () => {
    kuma.getKumaSummary.mockResolvedValue({
      monitors: [
        { name: "omv", status: "up" },
        { name: "omv-ha", status: "up" },
        { name: "web", status: "down" },
      ],
    });
    mqtt.readLatestAlertStatus.mockResolvedValue({ severity: "ok" });
    const res = await clusterGet(new NextRequest(B));
    const j = await res.json();
    expect(j.uptime).toEqual({
      status: "down",
      monitors: 3,
      upMonitors: 2,
      downMonitors: 1,
    });
    expect(j.mqtt).toEqual({ connected: true, severity: "ok" });
    expect(j.nodes).toEqual([
      { name: "omv", status: "healthy" },
      { name: "omv-ha", status: "healthy" },
    ]);
    expect(res.headers.get("Cache-Control")).toContain("private");
  });

  it("marks named nodes unhealthy; unknown when kuma null; mqtt failures degrade", async () => {
    kuma.getKumaSummary.mockResolvedValue({
      monitors: [{ name: "omv-disk", status: "down" }],
    });
    mqtt.readLatestAlertStatus.mockRejectedValue(new Error("broker down"));
    const j = await (await clusterGet(new NextRequest(B))).json();
    expect(j.nodes[0].status).toBe("unhealthy");
    expect(j.nodes[1].status).toBe("healthy");
    expect(j.mqtt).toEqual({ connected: false });
    expect(j.uptime.status).toBe("down");

    kuma.getKumaSummary.mockResolvedValue(null);
    mqtt.readLatestAlertStatus.mockResolvedValue(null);
    const j2 = await (await clusterGet(new NextRequest(B))).json();
    expect(j2.uptime).toMatchObject({ status: "unknown", monitors: 0 });
    expect(j2.mqtt.connected).toBe(false);
    expect(j2.nodes.every((n: { status: string }) => n.status === "healthy")).toBe(true);
  });

  it("500s with safe fallback body on kuma throw", async () => {
    kuma.getKumaSummary.mockRejectedValue(new Error("kuma down"));
    const res = await clusterGet(new NextRequest(B));
    expect(res.status).toBe(500);
    const j = await res.json();
    expect(j.error).toBe("Failed to fetch cluster status");
    expect(j.uptime.status).toBe("unknown");
  });
});

describe("kuma-status + mqtt-status + watchdogs", () => {
  it("kuma-status returns summary (or null) with no-store", async () => {
    kuma.getKumaSummary.mockResolvedValue({ monitors: [] });
    const res = await kumaGet(new NextRequest(`${B}/kuma-status`));
    expect(res.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(await res.json()).toEqual({ summary: { monitors: [] } });

    kuma.getKumaSummary.mockResolvedValue(null);
    expect(await (await kumaGet(new NextRequest(`${B}/kuma-status`))).json()).toEqual({
      summary: null,
    });
  });

  it("mqtt-status returns retained payload or null", async () => {
    mqtt.readLatestAlertStatus.mockResolvedValue({ severity: "critical" });
    const j = await (await mqttGet(new NextRequest(`${B}/mqtt-status`))).json();
    expect(j.status).toEqual({ severity: "critical" });

    mqtt.readLatestAlertStatus.mockResolvedValue(null);
    const j2 = await (await mqttGet(new NextRequest(`${B}/mqtt-status`))).json();
    expect(j2.status).toBeNull();
  });

  it("watchdogs: 503 outside cluster; lists jobs inside", async () => {
    k8s.isInCluster.mockReturnValue(false);
    expect((await watchdogsGet(new NextRequest(`${B}/watchdogs`))).status).toBe(
      503
    );

    k8s.isInCluster.mockReturnValue(true);
    k8s.listWatchdogCronJobs.mockResolvedValue([{ name: "cluster-alerts" }]);
    const j = await (
      await watchdogsGet(new NextRequest(`${B}/watchdogs`))
    ).json();
    expect(j.watchdogs).toEqual([{ name: "cluster-alerts" }]);
    expect(k8s.listWatchdogCronJobs).toHaveBeenCalledWith([
      "cluster-alerts",
      "omv-disk-watchdog",
      "omv-backup-verify",
      "postiz-slack-notify",
    ]);
  });
});
