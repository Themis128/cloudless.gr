/**
 * POST /api/admin/grafana/prometheus
 *
 * Run a PromQL instant query through the Grafana datasource proxy.
 *
 * Body: { query: string }
 * Response: { results: PrometheusQueryResult[] }
 *
 * Common queries:
 *   - Cluster CPU:   sum(rate(node_cpu_seconds_total{mode!="idle"}[5m])) by (instance)
 *   - Memory usage:  node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes
 *   - Pod restarts:  kube_pod_container_status_restarts_total
 *   - HTTP rate:     rate(nginx_ingress_controller_requests[5m])
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  prometheusQuery,
  GrafanaNotConfiguredError,
  GrafanaApiError,
} from "@/lib/grafana";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { query?: string };
  try {
    body = (await req.json()) as { query?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  try {
    const results = await prometheusQuery(query);
    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof GrafanaNotConfiguredError) {
      return NextResponse.json({ error: "Grafana not configured" }, { status: 503 });
    }
    if (err instanceof GrafanaApiError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    const msg = err instanceof Error ? err.message : "Query failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
