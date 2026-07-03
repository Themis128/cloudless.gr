import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { findPortalByToken, readPortals, writePortals } from "@/lib/client-portals";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { publishPortalNotification } from "@/lib/sns-notify";

/**
 * POST /api/portal/[token]/comments
 * Allows the client to reply to a step comment thread.
 * Auth: portal token (magic link credential — no JWT required).
 * Body: { stepId: string, text: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const rl = rateLimit(`portal-comment:${getClientIp(request)}`, 20, 60_000);
  if (!rl.ok) return rl.response;

  const { token } = await params;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!token || !UUID_RE.test(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const portal = await findPortalByToken(token);
  if (!portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  let body: { stepId?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { stepId, text } = body;
  if (!stepId || !text?.trim()) {
    return NextResponse.json({ error: "stepId and text are required" }, { status: 400 });
  }

  const step = portal.steps.find((s) => s.id === stepId);
  if (!step) {
    return NextResponse.json({ error: "Step not found" }, { status: 404 });
  }

  const comment = {
    id: randomUUID(),
    author: portal.clientName || portal.clientEmail.split("@")[0],
    text: String(text).trim().slice(0, 2000),
    createdAt: new Date().toISOString(),
  };

  step.comments.push(comment);

  // Persist
  const allPortals = await readPortals();
  const idx = allPortals.findIndex((p) => p.token === token);
  if (idx !== -1) {
    const targetStep = allPortals[idx]!.steps.find((s) => s.id === stepId);
    if (targetStep) {
      targetStep.comments.push(comment);
      await writePortals(allPortals);
    }
  }

  // Notify the team via SNS (fire-and-forget)
  publishPortalNotification({
    eventType: "comment_added",
    portalLabel: portal.label,
    clientName: portal.clientName || portal.clientEmail,
    clientEmail: portal.clientEmail,
    title: `New comment from ${portal.clientName || portal.clientEmail} on "${step.name}"`,
    description: `Step: ${step.name}\nComment: ${comment.text.slice(0, 500)}`,
    url: `https://cloudless.gr/portal/${portal.token}`,
    metadata: {
      stepId,
      commentId: comment.id,
      portalToken: portal.token,
    },
  }).catch(() => {});

  return NextResponse.json({ comment }, { status: 201 });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
