import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isHubSpotConfigured, createNote, listNotes } from "@/lib/hubspot";

export async function GET(
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
  const notes = await listNotes(id);
  return NextResponse.json({ notes });
}

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
  let body: string;
  try {
    const payload = await request.json();
    body = payload.body;
    if (!body) throw new Error("missing body");
  } catch {
    return NextResponse.json({ error: "body is required." }, { status: 400 });
  }

  const note = await createNote(id, body);
  if (!note) {
    return NextResponse.json(
      { error: "Failed to create note." },
      { status: 500 },
    );
  }
  return NextResponse.json({ note });
}
