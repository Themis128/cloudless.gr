import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { runVoiceBriefAgent } from "@/lib/agent-voice-brief";
import { persistVoiceBrief, VOICE_BRIEF_SSM_NAME } from "@/lib/voice-brief-store";

interface VoiceBrief {
  text: string;
  generatedAt: string;
  week: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  // Region defaults to us-east-1 (where all production SSM lives). Lambda's
  // runtime auto-sets AWS_REGION; we read it but fall back to the prod region.
  const region = process.env.AWS_REGION || "us-east-1";

  try {
    const client = new SSMClient({ region });
    const res = await client.send(
      new GetParameterCommand({ Name: VOICE_BRIEF_SSM_NAME }),
    );
    const raw = res.Parameter?.Value;
    if (!raw) {
      return NextResponse.json({ brief: null });
    }
    const brief: VoiceBrief = JSON.parse(raw);
    return NextResponse.json({ brief });
  } catch {
    return NextResponse.json({ brief: null });
  }
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
