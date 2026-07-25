import { NextRequest, NextResponse } from "next/server";
import { prepareOrchestration } from "./_shared";

export async function POST(request: NextRequest) {
  const prepared = await prepareOrchestration(request, "Analytics orchestration failed.");
  if (!prepared.ok) return prepared.response;

  return NextResponse.json(prepared.data.orchestration);
}
