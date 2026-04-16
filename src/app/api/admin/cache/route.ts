import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { invalidateCache } from "@/lib/notion-cache";

export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const prefix: string | undefined = body?.prefix;

    invalidateCache(prefix);

    return NextResponse.json({
      ok: true,
      clearedPrefix: prefix ?? "all",
      clearedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cache] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
