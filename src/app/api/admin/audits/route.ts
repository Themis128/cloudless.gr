/**
 * /api/admin/audits — Audit operations endpoint.
 *
 * GET: Redirects to /api/admin/audits/latest (for UI compatibility)
 * POST: Triggers audit dispatch via GitHub Actions workflow
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

const REPO = "Themis128/cloudless.gr";
const WORKFLOW = "audits-aggregator.yml";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/audits — Trigger audit workflow.
 *
 * Body:
 *   - branch: string (optional, defaults to main)
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const token = process.env.GITHUB_TOKEN ?? "";
  if (!token) {
    return NextResponse.json(
      { error: "GitHub Actions dispatch not configured" },
      { status: 404 }
    );
  }

  try {
    const body = (await request.json()) as { branch?: string };

    const dispatchRes = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${encodeURIComponent(WORKFLOW)}/dispatches`,
      {
        method: "POST",
        headers: {
          "User-Agent": "cloudless-app/1.0",
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: body.branch ?? "main",
        }),
      }
    );

    if (!dispatchRes.ok) {
      const errorText = await dispatchRes.text();
      return NextResponse.json(
        { error: `Failed to dispatch audit workflow: ${dispatchRes.status}`, detail: errorText },
        { status: dispatchRes.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Audit workflow dispatched",
      dispatchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[admin/audits] Dispatch error:", err);
    return NextResponse.json(
      { error: "Failed to dispatch audit workflow" },
      { status: 500 }
    );
  }
}