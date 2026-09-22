import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  createPostFromBody,
  SocialAutoApiError,
  SocialAutoNotConfiguredError,
} from "@/lib/socialauto";
import type { CreatePostBody } from "@/lib/postiz";

export const dynamic = "force-dynamic";

const MAX_BULK = 30;

interface BulkResult {
  index: number;
  ok: boolean;
  result?: Array<{ postId: string; integration: string }>;
  error?: string;
  status?: number;
}

/** POST /api/admin/postiz/posts/bulk — schedule many posts (one SocialAuto
 *  create-post call per item). Body: `{ items: CreatePostBody[] }` (max 30). */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { items?: CreatePostBody[] };
  try {
    body = (await req.json()) as { items?: CreatePostBody[] };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "invalid_payload", detail: "items[] is required" },
      { status: 400 }
    );
  }
  if (items.length > MAX_BULK) {
    return NextResponse.json(
      { error: "too_many", detail: `max ${MAX_BULK} items per request` },
      { status: 400 }
    );
  }

  for (const [i, item] of items.entries()) {
    if (!item?.type || !Array.isArray(item.posts) || item.posts.length === 0) {
      return NextResponse.json(
        { error: "invalid_payload", detail: `items[${i}]: type and posts[] are required` },
        { status: 400 }
      );
    }
  }

  try {
    const results: BulkResult[] = [];
    for (const [index, item] of items.entries()) {
      try {
        results.push({ index, ok: true, result: await createPostFromBody(item) });
      } catch (err) {
        results.push({
          index,
          ok: false,
          error:
            err instanceof SocialAutoApiError
              ? err.body.slice(0, 300) || err.message
              : err instanceof Error
                ? err.message
                : String(err),
          status: err instanceof SocialAutoApiError ? err.status : undefined,
        });
      }
    }
    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;
    return NextResponse.json({ results, succeeded, failed }, { status: failed === 0 ? 201 : 207 });
  } catch (err) {
    if (err instanceof SocialAutoNotConfiguredError) {
      return NextResponse.json({ error: "socialauto_not_configured" }, { status: 503 });
    }
    throw err;
  }
}
