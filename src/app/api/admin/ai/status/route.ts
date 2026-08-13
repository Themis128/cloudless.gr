import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getAdminAiUsageSnapshot } from "@/lib/admin-ai-usage";
import { isAdminAiConfiguredAsync } from "@/lib/admin-ai";
import { isAdminVectorizeConfigured } from "@/lib/admin-vectorize";
import { isEspoQueueConfigured } from "@/lib/espocrm-queue";
import { isTurnstileConfigured, getTurnstileSiteKey } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const usage = getAdminAiUsageSnapshot();
  return NextResponse.json({
    configured: await isAdminAiConfiguredAsync(),
    usage,
    vectorize: { configured: isAdminVectorizeConfigured() },
    turnstile: {
      configured: isTurnstileConfigured(),
      siteKeyPresent: Boolean(getTurnstileSiteKey()),
    },
    espocrmQueue: { configured: isEspoQueueConfigured() },
  });
}
