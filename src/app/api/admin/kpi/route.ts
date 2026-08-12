import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

import { getSeoSnapshot } from "@/lib/gsc";
import { getAnalyticsSummary } from "@/lib/notion-analytics";
import {
  listProjects,
  getTaskSummary,
  getOverdueTasks,
  type Project,
} from "@/lib/notion-projects";

import { isConfiguredAsync } from "@/lib/integrations";
import { getConfig } from "@/lib/ssm-config";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  // NOTION_ANALYTICS_DB_ID was decommissioned 2026-06-20 (see project_notion_decom_plan).
  // The notion-analytics module is now a no-op shim; we still call
  // getAnalyticsSummary() so the KPI tile exists, it just returns zeros until the
  // Athena replacement wire-up lands.
  const [projectsConf, tasksConf, cfg] = await Promise.all([
    isConfiguredAsync("NOTION_API_KEY", "NOTION_PROJECTS_DB_ID"),
    isConfiguredAsync("NOTION_API_KEY", "NOTION_TASKS_DB_ID"),
    getConfig(),
  ]);
  const analyticsConf = true;
  const gscConf = !!(cfg.GOOGLE_CLIENT_EMAIL && cfg.GOOGLE_PRIVATE_KEY);

  const [analyticsResult, gscResult, projectsResult, taskSummaryResult, overdueResult] =
    await Promise.allSettled([
      analyticsConf ? getAnalyticsSummary(7) : Promise.resolve(null),
      gscConf ? getSeoSnapshot() : Promise.resolve(null),
      projectsConf ? listProjects() : Promise.resolve([]),
      tasksConf ? getTaskSummary() : Promise.resolve({}),
      tasksConf ? getOverdueTasks() : Promise.resolve([]),
    ]);

  const analytics = analyticsResult.status === "fulfilled" ? analyticsResult.value : null;
  const gsc = gscResult.status === "fulfilled" ? gscResult.value : null;
  const projects: Project[] =
    projectsResult.status === "fulfilled" ? projectsResult.value : [];
  const taskSummary = taskSummaryResult.status === "fulfilled" ? taskSummaryResult.value : {};
  const overdueTasks = overdueResult.status === "fulfilled" ? overdueResult.value : [];

  const projectsByStatus: Record<string, number> = {};
  for (const p of projects) {
    projectsByStatus[p.status] = (projectsByStatus[p.status] ?? 0) + 1;
  }

  return NextResponse.json({
    analytics,
    gsc,
    projects: {
      total: projects.length,
      byStatus: projectsByStatus,
      activeCount: projects.filter((p) => p.status === "In Progress" || p.status === "Planning")
        .length,
    },
    tasks: {
      summary: taskSummary,
      overdueCount: overdueTasks.length,
    },
    fetchedAt: new Date().toISOString(),
  });
}
