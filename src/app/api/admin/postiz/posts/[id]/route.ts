import { NextResponse } from "next/server";
import {
  deletePostById,
  invalidCreateBodyResponse,
  readJsonBody,
  saAdminRoute,
  updatePostFromBody,
} from "@/lib/socialauto";
import type { CreatePostBody } from "@/lib/postiz";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = saAdminRoute<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  await deletePostById(id);
  return NextResponse.json({ deleted: true });
});

/** Edit a scheduled or draft post — SocialAuto PATCH /content/posts/:id. The
 *  body keeps the Postiz create-post shape; the client translates it. */
export const PUT = saAdminRoute<Ctx>(async (req, { params }) => {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const body = await readJsonBody<CreatePostBody>(req);
  if (body instanceof NextResponse) return body;

  const invalid = invalidCreateBodyResponse(body);
  if (invalid) return invalid;

  const result = await updatePostFromBody(id, body);
  return NextResponse.json({ result });
});
