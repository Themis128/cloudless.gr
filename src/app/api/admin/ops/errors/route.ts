import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getUnresolvedIssues, isSentryConfigured, verifySentryToken } from "@/lib/sentry";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  // In development, return empty data to avoid errors when services aren't configured
  if (process.env.NODE_ENV === "development") {
    return NextResponse.json({ issues: [], total: 0, fetchedAt: new Date().toISOString() });
  }

  if (!(await isSentryConfigured())) {
    return NextResponse.json({ error: "Sentry not configured." }, { status: 503 });
  }

  const result = await getUnresolvedIssues({ limit: 20, sort: "date" });

  if (!result) {
    const token = await verifySentryToken();
    if (token.status === "rejected") {
      return NextResponse.json(
        {
          error:
            token.message ??
            "Sentry token rejected — check SENTRY_AUTH_TOKEN scopes (project:read required).",
          code: "auth_rejected",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Failed to fetch errors from Sentry." }, { status: 502 });
  }

  return NextResponse.json(result);
}
