import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { mapIntegrationError } from "@/lib/api-errors";
import { isEspoCRMConfigured, getDealsByStage, getPipelines } from "@/lib/espocrm";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isEspoCRMConfigured())) {
    return NextResponse.json({ error: "EspoCRM not configured." }, { status: 503 });
  }

  try {
    const [dealsByStage, pipelines] = await Promise.all([getDealsByStage(), getPipelines("deals")]);

    return NextResponse.json({
      dealsByStage,
      pipelines,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    return NextResponse.json({ error: "Failed to fetch pipeline board." }, { status: 500 });
  }
}
