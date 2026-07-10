import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { runVoiceBriefAgent } from "@/lib/agent-voice-brief";
import { readVoiceBrief } from "@/lib/voice-brief-store";

interface VoiceBrief {
  text: string;
  generatedAt: string;
  week: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  // Try D1 first via readVoiceBrief (Cloudflare Workers)
  const brief = await readVoiceBrief();
  if (brief) {
    return NextResponse.json({ brief: { text: brief.text, generatedAt: brief.generatedAt, week: brief.week } });
  }
  return NextResponse.json({ brief: null });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const agentResult = await runVoiceBriefAgent({
      dateLabel: new Date().toLocaleDateString("en-IE", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    });
    const brief: VoiceBrief = {
      text: agentResult.text,
      generatedAt: new Date().toISOString(),
      week: "on-demand",
    };
    // Best-effort persist — failure should not fail the user-facing response.
    // persistVoiceBrief is now handled inside agent-voice-brief via voice-brief-store
    import { persistVoiceBrief } from "@/lib/voice-brief-store";
    await persistVoiceBrief(brief).catch((err) =>
      console.warn(
        "[admin/voice-brief] persist failed:",
        err instanceof Error ? err.message : String(err),
      ),
    );
    return NextResponse.json({ brief });
  } catch (e) {
    console.error(
      "[admin/voice-brief] generation failed:",
      e instanceof Error ? e.message : String(e),
    );
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}