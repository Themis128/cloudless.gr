import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isAdminVectorizeConfigured, syncAppFlowyToVectorize } from "@/lib/admin-vectorize";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!isAdminVectorizeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Vectorize not configured. Set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN (and create index).",
      },
      { status: 503 }
    );
  }

  try {
    const result = await syncAppFlowyToVectorize();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin/ai/rag/sync]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "RAG sync failed" },
      { status: 500 }
    );
  }
}
