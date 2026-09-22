import { NextResponse } from "next/server";
import {
  createBodyInvalidDetail,
  createPostFromBody,
  readJsonBody,
  saAdminRoute,
  SocialAutoApiError,
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
export const POST = saAdminRoute(async (req) => {
  const body = await readJsonBody<{ items?: CreatePostBody[] }>(req);
  if (body instanceof NextResponse) return body;

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
    const detail = createBodyInvalidDetail(item);
    if (detail) {
      return NextResponse.json(
        { error: "invalid_payload", detail: `items[${i}]: ${detail}` },
        { status: 400 }
      );
    }
  }

  const results: BulkResult[] = [];
  for (const [index, item] of items.entries()) {
    try {
      results.push({ index, ok: true, result: await createPostFromBody(item) });
    } catch (err) {
      let message: string;
      if (err instanceof SocialAutoApiError) {
        message = err.body.slice(0, 300) || err.message;
      } else if (err instanceof Error) {
        message = err.message;
      } else {
        message = String(err);
      }
      results.push({
        index,
        ok: false,
        error: message,
        status: err instanceof SocialAutoApiError ? err.status : undefined,
      });
    }
  }
  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;
  return NextResponse.json({ results, succeeded, failed }, { status: failed === 0 ? 201 : 207 });
});
