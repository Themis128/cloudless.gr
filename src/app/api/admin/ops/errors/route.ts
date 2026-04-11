import { NextResponse } from "next/server";
import { getUnresolvedIssues, isSentryConfigured } from "@/lib/sentry";

export async function GET() {
  if (!isSentryConfigured()) {
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
