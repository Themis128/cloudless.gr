/**
 * GET /api/admin/cluster/watchdogs
 *
 * Returns live status of the cluster's monitoring CronJobs so /admin/cluster
 * can render a status panel without needing kubectl access. Read-only — uses
 * the in-pod ServiceAccount + RBAC role `watchdog-reader` granted by
 * `infrastructure/monitoring/watchdog-reader-rbac.yaml`.
 *
 * Returns 503 when called outside the cluster (local dev) — frontend renders
 * a quiet "running outside cluster" empty state.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isInCluster, listWatchdogCronJobs } from "@/lib/k8s-cluster";

export const dynamic = "force-dynamic";

const WATCHDOG_NAMES = [
  "cluster-alerts",
  "omv-disk-watchdog",
  "omv-backup-verify",
  "postiz-slack-notify",
];

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!isInCluster()) {
    return NextResponse.json(
      {
        error: "Not running inside the cluster — /admin/cluster only renders in the live pod.",
      },
      { status: 503 }
    );
  }

  const watchdogs = await listWatchdogCronJobs(WATCHDOG_NAMES);
  return NextResponse.json({
    watchdogs,
    fetchedAt: new Date().toISOString(),
  });
}
