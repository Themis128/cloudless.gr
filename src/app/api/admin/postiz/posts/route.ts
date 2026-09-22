import { NextResponse } from "next/server";
import {
  createPostFromBody,
  listPostsInWindow,
  readCreateBody,
  saAdminRoute,
} from "@/lib/socialauto";

export const dynamic = "force-dynamic";

/** Scheduled + published posts in a window — backed by SocialAuto
 *  `/content/posts`, exploded per target channel. */
export const GET = saAdminRoute(async (req) => {
  const url = new URL(req.url);
  const startDate =
    url.searchParams.get("startDate") ??
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const endDate =
    url.searchParams.get("endDate") ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const posts = await listPostsInWindow(startDate, endDate);
  return NextResponse.json({ posts });
});

export const POST = saAdminRoute(async (req) => {
  const body = await readCreateBody(req);
  if (body instanceof NextResponse) return body;

  const result = await createPostFromBody(body);
  return NextResponse.json({ result }, { status: 201 });
});
