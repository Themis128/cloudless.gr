import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  listIntegrations,
  PostizApiError,
  PostizNotConfiguredError,
} from "@/lib/postiz";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const integrations = await listIntegrations();
    return NextResponse.json({ integrations });
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
