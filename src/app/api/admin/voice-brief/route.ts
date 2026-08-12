import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { runVoiceBriefAgent } from "@/lib/agent-voice-brief";
import { persistVoiceBrief, readVoiceBrief } from "@/lib/voice-brief-store";

interface VoiceBrief {
  text: string;
  generatedAt: string;
  week: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const brief = await readVoiceBrief();
  return NextResponse.json({ brief });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const agentResult = await runVoiceBriefAgent({
      dateLabel: new Date().toLocaleDateString("en-IE", { weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric", timeZone: "Europe/Athens" }),
    });
    const brief: VoiceBrief = {
      text: agentResult.text,
      generatedAt: new Date().toISOString(),
      week: "on-demand",
    };
    await persistVoiceBrief(brief).catch((err) =>
      console.warn(
        "[admin/voice-brief] persist failed:",
        err instanceof Error ? err.message : String(err)
      )
    );
    return NextResponse.json({ brief });
  } catch (e) {
    console.error(
      "[admin/voice-brief] generation failed:",
      e instanceof Error ? e.message : String(e)
    );
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
