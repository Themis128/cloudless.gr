import { NextRequest, NextResponse } from "next/server";
import { prepareOrchestration } from "./_shared";

import { requireAdmin } from "@/lib/api-auth";
export async function POST(request: NextRequest) {

const auth = await requireAdmin(request);
if (!auth.ok) return auth.response;
  const prepared = await prepareOrchestration(request, "Analytics orchestration failed.");
  if (!prepared.ok) return prepared.response;

  return NextResponse.json(prepared.data.orchestration);
}
