/**
 * GET  /api/admin/grafana/datasources — list all Grafana datasources
 * POST /api/admin/grafana/datasources — sync Prometheus datasource
 *
 * POST body: { prometheusUrl?: string } — defaults to in-cluster kube-prom URL
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  listDatasources,
  syncPrometheusDatasource,
  GrafanaNotConfiguredError,
  GrafanaApiError,
} from "@/lib/grafana";
import { getConfig } from "@/lib/ssm-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_PROMETHEUS_URL =
  "http://kube-prom-stack-kube-prome-prometheus.monitoring.svc.cluster.local:9090";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const datasources = await listDatasources();
    return NextResponse.json({ datasources });
  } catch (err) {
    if (err instanceof GrafanaNotConfiguredError) {
      return NextResponse.json({ error: "Grafana not configured" }, { status: 503 });
    }
    if (err instanceof GrafanaApiError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Failed to list datasources" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const cfg = await getConfig();
  let prometheusUrl = cfg.PROMETHEUS_URL || DEFAULT_PROMETHEUS_URL;
  try {
    const body = (((await req.json()) as any)) as { prometheusUrl?: string };
    if (body.prometheusUrl) prometheusUrl = body.prometheusUrl;
  } catch {
    // body is optional
  }

  try {
    const ds = await syncPrometheusDatasource(prometheusUrl);
    return NextResponse.json({ ok: true, datasource: ds });
  } catch (err) {
    if (err instanceof GrafanaNotConfiguredError) {
      return NextResponse.json({ error: "Grafana not configured" }, { status: 503 });
    }
    if (err instanceof GrafanaApiError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Failed to sync Prometheus datasource" }, { status: 500 });
  }
}
