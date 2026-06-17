import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserProfile, putUserProfile } from "@/lib/user-profile";

export const dynamic = "force-dynamic";

interface ProfileBody {
  name?: string;
  company?: string;
  phone?: string;
  preferences?: unknown;
}

/**
 * GET /api/user/profile
 *
 * Reads the signed-in user's stored profile (name + company/phone/preferences)
 * from DynamoDB so the dashboard Profile/Settings forms render previously-saved
 * values. Provider-agnostic: keyed by the OIDC `sub`, so it works identically
 * across OIDC providers. `name`/`email` fall back to the session when no
 * stored record exists yet.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const profile = await getUserProfile(userId);
    return NextResponse.json({
      name: profile.name ?? session.user.name ?? undefined,
      email: session.user.email ?? undefined,
      company: profile.company,
      phone: profile.phone,
      preferences: profile.preferences,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("USER_PROFILE_TABLE")) {
      return NextResponse.json({
        name: session.user.name ?? undefined,
        email: session.user.email ?? undefined,
      });
    }
    return NextResponse.json({ error: "Could not read profile" }, { status: 502 });
  }
}

/**
 * POST /api/user/profile
 *
 * Upserts the signed-in user's profile fields in DynamoDB. Partial update:
 * only the keys present in the body are written (empty string clears a field).
 */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: ProfileBody;
  try {
    body = (await req.json()) as ProfileBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    await putUserProfile(userId, {
      name: body.name,
      company: body.company,
      phone: body.phone,
      preferences: body.preferences,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 502 });
  }
}
