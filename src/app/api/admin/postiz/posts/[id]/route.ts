import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  deletePostById,
  invalidCreateBodyResponse,
  saErrorToResponse,
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
    return saErrorToResponse(err);
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
  const invalid = invalidCreateBodyResponse(body);
  if (invalid) return invalid;

  try {
    const result = await updatePostFromBody(id, body);
    return NextResponse.json({ result });
  } catch (err) {
    return saErrorToResponse(err);
  }
}
