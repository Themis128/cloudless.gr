import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  createPostFromBody,
  listPostsInWindow,
  SocialAutoApiError,
  SocialAutoNotConfiguredError,
} from "@/lib/socialauto";
import type { CreatePostBody } from "@/lib/postiz";

export const dynamic = "force-dynamic";

/** Scheduled + published posts in a window — backed by SocialAuto
 *  `/content/posts`, exploded per target channel. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const startDate =
    url.searchParams.get("startDate") ??
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const endDate =
    url.searchParams.get("endDate") ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const posts = await listPostsInWindow(startDate, endDate);
    return NextResponse.json({ posts });
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

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

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
    const result = await createPostFromBody(body);
    return NextResponse.json({ result }, { status: 201 });
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
