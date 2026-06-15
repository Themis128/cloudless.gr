import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  uploadFromUrl,
  PostizApiError,
  PostizNotConfiguredError,
} from "@/lib/postiz";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => null)) as { url?: string } | null;
  if (!body?.url) {
    return NextResponse.json({ error: "missing_url" }, { status: 400 });
  }

  try {
    const uploaded = await uploadFromUrl(body.url);
    return NextResponse.json(uploaded, { status: 201 });
  } catch (err) {
    if (err instanceof PostizNotConfiguredError) {
      return NextResponse.json(
        { error: "postiz_not_configured" },
        { status: 503 },
      );
    }
    if (err instanceof PostizApiError) {
      return NextResponse.json(
        { error: "postiz_upstream", status: err.status, body: err.body },
        { status: 502 },
      );
    }
    throw err;
  }
}
