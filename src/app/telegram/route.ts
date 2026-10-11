import { NextResponse } from "next/server";

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
 */
export function GET(request: Request) {
  const target = process.env.TELEGRAM_CHANNEL_URL?.trim();
  const fallback = new URL("/links", request.url);
  if (!target) {
    return NextResponse.redirect(fallback, { status: 307 });
  }
  return NextResponse.redirect(target, { status: 307 });
}
