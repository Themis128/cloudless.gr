import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { isEspoCRMConfigured, listOwners } from "@/lib/espocrm";
import { mapIntegrationError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isEspoCRMConfigured())) {
    return NextResponse.json({ error: "EspoCRM not configured." }, { status: 503 });
  }

  try {
    const owners = await listOwners();

    return NextResponse.json({
      owners,
      total: Array.isArray(owners) ? owners.length : 0,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[EspoCRM] Error listing owners:", err);
    return NextResponse.json({ error: "Failed to fetch owners." }, { status: 500 });
  }
}
