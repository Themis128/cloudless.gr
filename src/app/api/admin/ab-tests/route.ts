import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getABFlags, DEFAULT_FLAGS, type ABFlag } from "@/lib/ab-flags";
import { writeJsonConfig } from "@/lib/app-config-json";

const CONFIG_KEY = "AB_FLAGS_JSON";

async function persistFlags(flags: ABFlag[]): Promise<void> {
  await writeJsonConfig(CONFIG_KEY, flags, "A/B test flags");
}

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
    updates = await request.json();
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
    await persistFlags(flags);
  } catch {
    return NextResponse.json({
      flags,
      warning: "Config store unavailable — changes not persisted",
    });
  }

  return NextResponse.json({ flags });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: { action: "reset" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (body.action === "reset") {
    try {
      await persistFlags(DEFAULT_FLAGS);
    } catch {
      return NextResponse.json({
        flags: DEFAULT_FLAGS,
        warning: "Config store unavailable — changes not persisted",
      });
    }
    return NextResponse.json({ flags: DEFAULT_FLAGS });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
