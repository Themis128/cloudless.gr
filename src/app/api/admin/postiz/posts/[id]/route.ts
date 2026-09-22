import { NextResponse } from "next/server";
import { deletePostById, readCreateBody, saAdminRoute, updatePostFromBody } from "@/lib/socialauto";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Path id or the 400 response to return. */
async function postIdOr400(params: Promise<{ id: string }>): Promise<string | NextResponse> {
  const { id } = await params;
  return id || NextResponse.json({ error: "missing_id" }, { status: 400 });
}

export const DELETE = saAdminRoute<Ctx>(async (_req, { params }) => {
  const id = await postIdOr400(params);
  if (id instanceof NextResponse) return id;

  await deletePostById(id);
  return NextResponse.json({ deleted: true });
});

/** Edit a scheduled or draft post — SocialAuto PATCH /content/posts/:id. The
 *  body keeps the Postiz create-post shape; the client translates it. */
export const PUT = saAdminRoute<Ctx>(async (req, { params }) => {
  const id = await postIdOr400(params);
  if (id instanceof NextResponse) return id;

  const body = await readCreateBody(req);
  if (body instanceof NextResponse) return body;

  const result = await updatePostFromBody(id, body);
  return NextResponse.json({ result });
});
