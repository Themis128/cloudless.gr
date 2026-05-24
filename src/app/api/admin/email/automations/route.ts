import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json({ automations: [], total: 0 });
}
