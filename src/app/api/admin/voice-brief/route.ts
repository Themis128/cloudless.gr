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

  const region = process.env.AWS_REGION ?? "eu-central-1";

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

  // Trigger on-demand generation by calling the cron route internally.
  // Pin the base URL to a known allowlist so a misconfigured or tampered env
  // var cannot redirect this server-side fetch to an attacker host (SSRF guard).
  const ALLOWED_BASE_URLS = [
    "https://cloudless.gr",
    "https://cloudless.online",
    "http://localhost:3000",
  ];
  const envBase =
    process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const baseUrl = ALLOWED_BASE_URLS.includes(envBase)
    ? envBase
    : "https://cloudless.gr";
  // Read CRON_SECRET from SSM-backed config — process.env is not populated
  // in Lambda runtime where secrets live only in SSM.
  const cfg = await getConfig();
  const cronSecret = cfg.CRON_SECRET ?? process.env.CRON_SECRET ?? "";
  try {
    const res = await fetch(`${baseUrl}/api/cron/voice-brief`, {
      headers: { authorization: `Bearer ${cronSecret}` },
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
    // Log only the message — the raw error may carry the internal fetch's
    // Authorization header (CRON_SECRET) in its request context.
    console.error(
      "[admin/voice-brief] generation failed:",
      e instanceof Error ? e.message : String(e),
    );
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
