import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  createAgencyProject,
  isAgencyProjectStatus,
  listAgencyProjects,
  updateAgencyProjectStatus,
  type AgencyProject,
} from "@/lib/agency-projects-d1";
import { isValidEmail } from "@/lib/validation";

export type { AgencyProject };

const AP_RE = /^ap_[a-zA-Z0-9-]+$/;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? "50") || 50, 100);
    const { bound, projects } = await listAgencyProjects(limit);
    if (!bound) {
      return NextResponse.json({ error: "AUTH_DB not configured" }, { status: 503 });
    }
    return NextResponse.json({ projects, total: projects.length });
  } catch (e) {
    console.error("[delivery] list projects failed:", e);
    return NextResponse.json({ error: "Failed to list projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "create";

  try {
    if (action === "create") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const clientEmail =
        typeof body.clientEmail === "string" ? body.clientEmail.trim().toLowerCase() : "";
      const notes = typeof body.notes === "string" ? body.notes.trim() : "";
      const hourlyRateEur = Number(body.hourlyRateEur);
      const hourlyRateCents =
        typeof body.hourlyRateCents === "number"
          ? Math.round(body.hourlyRateCents)
          : Number.isFinite(hourlyRateEur) && hourlyRateEur >= 0
            ? Math.round(hourlyRateEur * 100)
            : null;

      if (!name) {
        return NextResponse.json({ error: "name required" }, { status: 400 });
      }
      if (clientEmail && !isValidEmail(clientEmail)) {
        return NextResponse.json({ error: "Invalid clientEmail" }, { status: 400 });
      }

      const project = await createAgencyProject({
        name,
        clientEmail: clientEmail || null,
        hourlyRateCents,
        notes: notes || null,
      });
      if (!project) {
        return NextResponse.json(
          { error: "Failed to create project (AUTH_DB unbound or DB error)" },
          { status: 503 }
        );
      }
      return NextResponse.json({ project }, { status: 201 });
    }

    if (action === "set_status") {
      const id = typeof body.id === "string" ? body.id.trim() : "";
      const status = typeof body.status === "string" ? body.status.trim() : "";
      if (!AP_RE.test(id) || !isAgencyProjectStatus(status)) {
        return NextResponse.json({ error: "Valid id and status required" }, { status: 400 });
      }
      const ok = await updateAgencyProjectStatus(id, status);
      if (!ok) {
        return NextResponse.json({ error: "Project not found or update failed" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, id, status });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("[delivery] project action failed:", e);
    return NextResponse.json({ error: "Project action failed" }, { status: 500 });
  }
}
