import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isHubSpotConfigured, moveDealStage } from "@/lib/hubspot";
import { mapIntegrationError } from "@/lib/api-errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isHubSpotConfigured())) {
    return NextResponse.json(
      { error: "HubSpot not configured." },
      { status: 503 },
    );
  }

  const { id } = await params;
  let stageId: string;
  try {
    const body = await request.json();
    stageId = body.stageId;
    if (!stageId) throw new Error("missing stageId");
  } catch (err) {
    const _r = mapIntegrationError(err); if (_r) return _r;
    return NextResponse.json(
      { error: "stageId is required." },
      { status: 400 },
    );
  }

  try {
    const deal = await moveDealStage(id, stageId);
    if (!deal) {
      return NextResponse.json(
        { error: "Failed to move deal." },
        { status: 500 },
      );
    }
    return NextResponse.json({ deal });
  } catch (err) {
    const _r = mapIntegrationError(err); if (_r) return _r;
    return NextResponse.json(
      { error: "Failed to move deal." },
      { status: 500 },
    );
  }
}
