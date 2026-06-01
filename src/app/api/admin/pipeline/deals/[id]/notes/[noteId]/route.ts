import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isHubSpotConfigured, deleteNote } from "@/lib/hubspot";
import { mapIntegrationError } from "@/lib/api-errors";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  if (!(await isHubSpotConfigured())) {
    return NextResponse.json({ error: "HubSpot not configured." }, { status: 503 });
  }

  const { noteId } = await params;
  try {
    const ok = await deleteNote(noteId);
    if (!ok) {
      return NextResponse.json({ error: "Failed to delete note." }, { status: 500 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const _r = mapIntegrationError(err);
    if (_r) return _r;
    console.error("[HubSpot] Error deleting note:", err);
    return NextResponse.json({ error: "Failed to delete note." }, { status: 500 });
  }
}
