import { NextRequest, NextResponse } from "next/server";
import type { SocialAutoAnalyticsEvent } from "@/lib/socialauto-analytics";
import { sendSocialAutoEventServer } from "@/lib/socialauto-analytics-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isSocialAutoAnalyticsEvent(parsed)) {
    return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  }

  await sendSocialAutoEventServer(parsed, req);
  return NextResponse.json({ ok: true });
}

function isSocialAutoAnalyticsEvent(input: unknown): input is SocialAutoAnalyticsEvent {
  if (!input || typeof input !== "object") return false;
  const obj = input as Record<string, unknown>;
  return typeof obj.event === "string" && typeof obj.domain === "string";
}
