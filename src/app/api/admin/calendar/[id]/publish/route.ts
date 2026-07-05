import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getCalendarItems, updateCalendarItem } from "@/lib/content-calendar";
import {
  isPostizConfigured,
  listPostizIntegrations,
  matchIntegrationsForPlatform,
  schedulePost,
} from "@/lib/postiz";

/**
 * Publish (or schedule) a `social_post` calendar item through Postiz.
 *
 * Body (all optional):
 *   { content?: string, asDraft?: boolean }
 *   — content overrides the item's notes; defaults to notes, then title.
 *
 * The item's `date` decides scheduling: future → scheduled in Postiz,
 * past/now → published immediately. On success the calendar item status
 * moves to "scheduled" (future) or "published" (immediate).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isPostizConfigured())) {
    return NextResponse.json({ error: "Postiz not configured." }, { status: 503 });
  }

  const { id } = await params;

  let body: { content?: string; asDraft?: boolean } = {};
  try {
    body = ((await request.json()) as any);
  } catch {
    // Empty body is fine — all fields are optional.
  }

  const items = await getCalendarItems();
  const item = items.find((i) => i.id === id);
  if (!item) {
    return NextResponse.json({ error: "Calendar item not found." }, { status: 404 });
  }
  if (item.type !== "social_post") {
    return NextResponse.json(
      { error: "Only social_post items can be published via Postiz." },
      { status: 400 }
    );
  }

  const content = (body.content ?? item.notes ?? item.title ?? "").trim();
  if (!content) {
    return NextResponse.json(
      { error: "No content to publish — add notes to the calendar item." },
      { status: 400 }
    );
  }

  const integrations = await listPostizIntegrations();
  const targets = matchIntegrationsForPlatform(integrations, item.platform);
  if (targets.length === 0) {
    return NextResponse.json(
      {
        error: `No connected Postiz channel for platform "${item.platform}". Connect it in Postiz first.`,
      },
      { status: 409 }
    );
  }

  const result = await schedulePost({
    content,
    integrationIds: targets.map((t) => t.id),
    scheduleAt: item.date,
    asDraft: body.asDraft,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Publish failed." }, { status: 502 });
  }

  const isFuture = new Date(item.date).getTime() > Date.now();
  let newStatus: "draft" | "scheduled" | "published";
  if (body.asDraft) {
    newStatus = "draft";
  } else {
    newStatus = isFuture ? "scheduled" : "published";
  }
  // Merge with any previously-stored ids — republishing an item is rare but
  // happens (e.g. user re-runs after fixing notes); never lose history.
  const mergedIds = Array.from(new Set([...(item.postizPostIds ?? []), ...result.postIds]));
  const updated = await updateCalendarItem(id, {
    status: newStatus,
    postizPostIds: mergedIds,
  });

  return NextResponse.json({
    success: true,
    postIds: result.postIds,
    channels: targets.map((t) => ({ id: t.id, name: t.name, identifier: t.identifier })),
    item: updated,
  });
}
