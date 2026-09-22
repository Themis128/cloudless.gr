import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  deletePostById,
  SocialAutoApiError,
  SocialAutoNotConfiguredError,
  updatePostFromBody,
} from "@/lib/socialauto";
import type { CreatePostBody } from "@/lib/postiz";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  try {
    await deletePostById(id);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    if (err instanceof SocialAutoNotConfiguredError) {
      return NextResponse.json({ error: "socialauto_not_configured" }, { status: 503 });
    }
    if (err instanceof SocialAutoApiError) {
      return NextResponse.json(
        { error: "socialauto_upstream", status: err.status, body: err.body },
        { status: 502 }
      );
    }
    throw err;
  }
}

/** Edit a scheduled or draft post — SocialAuto PATCH /content/posts/:id. The
 *  body keeps the Postiz create-post shape; the client translates it. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  let body: CreatePostBody;
  try {
    body = (await req.json()) as CreatePostBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.type || !Array.isArray(body.posts) || body.posts.length === 0) {
    return NextResponse.json(
      { error: "invalid_payload", detail: "type and posts[] are required" },
      { status: 400 }
    );
  }

  try {
    const result = await updatePostFromBody(id, body);
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof SocialAutoNotConfiguredError) {
      return NextResponse.json({ error: "socialauto_not_configured" }, { status: 503 });
    }
    if (err instanceof SocialAutoApiError) {
      return NextResponse.json(
        { error: "socialauto_upstream", status: err.status, body: err.body },
        { status: err.status === 429 ? 429 : 502 }
      );
    }
    throw err;
  }
}
