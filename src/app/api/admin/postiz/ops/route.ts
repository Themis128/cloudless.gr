import { NextRequest, NextResponse } from "next/server";
import {
  getOpsConsole,
  runOpsAction,
  readJsonBody,
  saAdminRoute,
  type SaOpsAction,
} from "@/lib/socialauto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// session-heal probes every platform session server-side and can exceed the
// default serverless timeout — give the proxied call a full minute.
export const maxDuration = 60;

const VALID_ACTIONS = new Set(["session-heal", "release-browser-lock", "set-tiktok-audit"]);

/**
 * GET /api/admin/postiz/ops — aggregated SocialAuto ops state
 * (services, accounts, publish queue, media pipeline, TikTok audit).
 */
export const GET = saAdminRoute(async () => {
  return NextResponse.json(await getOpsConsole());
});

/**
 * POST /api/admin/postiz/ops — trigger an allowlisted ops action.
 * Body: { action: "session-heal" | "release-browser-lock" | "set-tiktok-audit", ... }
 */
export const POST = saAdminRoute(async (req: NextRequest) => {
  const body = await readJsonBody<{ action?: string } & Record<string, unknown>>(req);
  if (body instanceof NextResponse) return body;
  if (!body.action || !VALID_ACTIONS.has(body.action)) {
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }
  if (body.action === "set-tiktok-audit" && typeof body.status !== "string") {
    return NextResponse.json({ error: "status_required" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, result: await runOpsAction(body as SaOpsAction) });
});
