import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getConfig } from "@/lib/ssm-config";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

interface VoiceBrief {
  text: string;
  generatedAt: string;
  week: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const cfg = (await getConfig()) as unknown as Record<
    string,
    string | undefined
  >;
  const region = cfg.AWS_REGION ?? "eu-central-1";

  try {
    const client = new SSMClient({ region });
    const res = await client.send(
      new GetParameterCommand({ Name: "/cloudless/VOICE_BRIEF_LATEST" }),
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

  // Trigger on-demand generation by calling the cron route internally
  const baseUrl =
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://cloudless.gr";
  try {
    const res = await fetch(`${baseUrl}/api/cron/voice-brief`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`Cron returned ${res.status}`);
    const data = await res.json();
    return NextResponse.json({
      brief: {
        text: data.text,
        generatedAt: data.generatedAt,
        week: "on-demand",
      },
    });
  } catch (e) {
    console.error("[admin/voice-brief] generation failed:", e);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
