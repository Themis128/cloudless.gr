import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getUnresolvedIssues, isSentryConfigured } from "@/lib/sentry";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isSentryConfigured())) {
    return NextResponse.json(
      { error: "Sentry not configured." },
      { status: 503 },
    );
  }

  const result = await getUnresolvedIssues({ limit: 20, sort: "date" });

  if (!result) {
    return NextResponse.json(
      { error: "Failed to fetch errors from Sentry." },
      { status: 502 },
    );
  }

  return NextResponse.json(result);
}
