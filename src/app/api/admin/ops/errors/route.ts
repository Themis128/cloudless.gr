import { NextResponse } from "next/server";
import { getIntegrations, isConfigured } from "@/lib/integrations";

export async function GET() {
  if (!isConfigured("SENTRY_AUTH_TOKEN")) {
    return NextResponse.json({ error: "Sentry not configured." }, { status: 503 });
  }

  const { SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT } = getIntegrations();

  try {
    const res = await fetch(
      `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=is:unresolved&sort=date&limit=20`,
      { headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}` } },
    );

    if (!res.ok) {
      return NextResponse.json({ error: `Sentry API error: ${res.status}` }, { status: 502 });
    }

    const issues = await res.json();

    return NextResponse.json({
      issues: issues.map((i: Record<string, unknown>) => ({
        id: i.id,
        title: i.title,
        culprit: i.culprit,
        level: i.level,
        count: i.count,
        firstSeen: i.firstSeen,
        lastSeen: i.lastSeen,
        status: i.status,
      })),
      total: issues.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Sentry] Error:", err);
    return NextResponse.json({ error: "Failed to fetch errors." }, { status: 500 });
  }
}
