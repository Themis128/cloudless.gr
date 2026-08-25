import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createPostsBulk, PostizNotConfiguredError, type CreatePostBody } from "@/lib/postiz";

export const dynamic = "force-dynamic";

const MAX_BULK = 30;

/** POST /api/admin/postiz/posts/bulk — schedule many posts (one create-post
 *  call per item). Body: `{ items: CreatePostBody[] }` (max 30). */
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
    const results = await createPostsBulk(items);
    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;
    return NextResponse.json({ results, succeeded, failed }, { status: failed === 0 ? 201 : 207 });
  } catch (err) {
    if (err instanceof PostizNotConfiguredError) {
      return NextResponse.json({ error: "postiz_not_configured" }, { status: 503 });
    }
    throw err;
  }
}
