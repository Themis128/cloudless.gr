import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserProfile, putUserProfile } from "@/lib/user-profile";
import { getAuthDbFromEnv, getUserBySession } from "@/lib/auth-d1";

export const dynamic = "force-dynamic";

interface ProfileBody {
  name?: string;
  company?: string;
  phone?: string;
  preferences?: unknown;
}

async function resolveUser(
  req: NextRequest
): Promise<{ id: string; email?: string; name?: string } | null> {
  const sessionId = req.cookies.get("session_token")?.value;
  const db = getAuthDbFromEnv();
  if (sessionId && db) {
    const user = await getUserBySession(db, sessionId);
    if (user) {
      return { id: user.id, email: user.email, name: user.name ?? undefined };
    }
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return {
    id: userId,
    email: session?.user?.email ?? undefined,
    name: session?.user?.name ?? undefined,
  };
}

/**
 * GET /api/user/profile
 *
 * Cloudflare-first: D1 `user` row when AUTH_DB bound; else DynamoDB fallback.
 */
export async function GET(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const profile = await getUserProfile(user.id);
    return NextResponse.json({
      name: profile.name ?? user.name ?? undefined,
      email: user.email ?? undefined,
      company: profile.company,
      phone: profile.phone,
      preferences: profile.preferences,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("USER_PROFILE_TABLE")) {
      return NextResponse.json({
        name: user.name ?? undefined,
        email: user.email ?? undefined,
      });
    }
    return NextResponse.json({ error: "Could not read profile" }, { status: 502 });
  }
}

/**
 * POST /api/user/profile
 *
 * Upserts profile fields (D1 preferred, DynamoDB legacy).
 */
export async function POST(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: ProfileBody;
  try {
    body = (await req.json()) as ProfileBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    await putUserProfile(user.id, {
      name: body.name,
      company: body.company,
      phone: body.phone,
      preferences: body.preferences,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[user/profile] PUT failed:", msg);
    if (msg.includes("USER_PROFILE_TABLE")) {
      return NextResponse.json(
        { error: "Profile storage not available — please retry" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Failed to update profile" }, { status: 502 });
  }
}
