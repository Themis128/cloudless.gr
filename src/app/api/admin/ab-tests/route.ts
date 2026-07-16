import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getABFlags, saveFlagsToD1, DEFAULT_FLAGS, type ABFlag } from "@/lib/ab-flags";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const flags = await getABFlags();
  return NextResponse.json({ flags });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let updates: Partial<ABFlag> & { id: string };
  try {
    updates = (await request.json()) as Partial<ABFlag> & { id: string };
    if (!updates.id) throw new Error("id required");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid input" },
      { status: 400 }
    );
  }

  const flags = await getABFlags();
  const idx = flags.findIndex((f) => f.id === updates.id);
  if (idx === -1) {
    return NextResponse.json({ error: "Flag not found" }, { status: 404 });
  }

  flags[idx] = { ...flags[idx], ...updates, id: flags[idx].id };

  try {
    await saveFlagsToD1(flags);
  } catch (err) {
    console.warn("[ab-tests] D1 save failed:", err instanceof Error ? err.message : err);
    // Return the updated flags but warn that they weren't persisted to D1
    // (SSM fallback would require re-implementing SSM write in this route)
    return NextResponse.json({
      flags,
      warning: "D1 unavailable — changes not persisted",
    });
  }

  return NextResponse.json({ flags });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: { action: "reset" };
  try {
    body = (await request.json()) as { action: "reset" };
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (body.action === "reset") {
    try {
      await saveFlagsToD1(DEFAULT_FLAGS);
    } catch (err) {
      console.warn("[ab-tests] D1 reset failed:", err instanceof Error ? err.message : err);
      return NextResponse.json({
        flags: DEFAULT_FLAGS,
        warning: "D1 unavailable — changes not persisted",
      });
    }
    return NextResponse.json({ flags: DEFAULT_FLAGS });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}