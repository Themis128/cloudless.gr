import { NextRequest, NextResponse } from "next/server";
import { canonicalOrigin } from "@/lib/canonical-origin";

/**
 * /telegram — stable join URL for the Cloudless Telegram channel.
 *
 * The real invite link is a `t.me/+...` URL created per-source by the
 * SocialAuto bot (named invite links for attribution). Pointing the site at
 * our own redirect keeps every surface (/links page, SOCIAL_ACCOUNTS icon
 * row, printed QR codes) stable when the underlying invite link rotates.
 *
 * Configure via TELEGRAM_CHANNEL_URL (website-source invite link). Falls
 * back to /links until the channel exists so we never ship a dead URL.
 * The route sits on the app root and is exempted from locale prefixing in
 * src/proxy.ts — bare /telegram must reach this handler, not /en/telegram.
 */
export function GET(request: NextRequest) {
  const fallback = new URL("/links", canonicalOrigin(request));
  const target = process.env.TELEGRAM_CHANNEL_URL?.trim();
  if (!target) {
    return NextResponse.redirect(fallback, { status: 307 });
  }
  try {
    const url = new URL(target);
    if (url.protocol !== "https:") {
      return NextResponse.redirect(fallback, { status: 307 });
    }
    return NextResponse.redirect(url, { status: 307 });
  } catch {
    return NextResponse.redirect(fallback, { status: 307 });
  }
}
