import { NextRequest, NextResponse } from "next/server";
import { assignVariant, getABFlags, DEFAULT_FLAGS } from "@/lib/ab-flags";

export const runtime = "nodejs";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function GET(request: NextRequest, context: { params: Promise<{ flagId: string }> }) {
  const { flagId } = await context.params;
  const id = (flagId || "").trim().slice(0, 64);
  if (!id) {
    return NextResponse.json({ error: "flagId required" }, { status: 400 });
  }

  const flags = await getABFlags();
  const flag = flags.find((f) => f.id === id) ?? DEFAULT_FLAGS.find((f) => f.id === id);
  if (!flag) {
    return NextResponse.json({ error: "Unknown experiment" }, { status: 404 });
  }

  const cookieName = `ab_${flag.id}`;
  const existing = request.cookies.get(cookieName)?.value;
  const variant = assignVariant(flag, existing);
  const res = NextResponse.json({
    id: flag.id,
    enabled: flag.enabled,
    variant,
    label: flag.variants[variant],
  });

  if (existing !== variant) {
    res.cookies.set(cookieName, variant, {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return res;
}
