import { NextRequest, NextResponse } from "next/server";
import { canonicalOrigin } from "@/lib/canonical-origin";

/**
 * /viber — stable deep link into a Viber chat with the Cloudless number.
 *
 * Viber has no hosted "chat with us" URL like wa.me — the working link is
 * the `viber://chat?number=...` custom scheme, which hands off to the app
 * on mobile. On desktop the scheme has no handler and the navigation
 * silently stays on /viber; the links page also prints the raw number so
 * desktop visitors can add it manually.
 *
 * Configure via VIBER_CHAT_URL (e.g. for a future commercial bot account
 * or a different number). Defaults to the business line +30 697 777 7838.
 * The route sits on the app root and is exempted from locale prefixing in
 * src/proxy.ts — bare /viber must reach this handler, not /en/viber.
 */
const DEFAULT_VIBER_CHAT_URL = "viber://chat?number=%2B306977777838";

export function GET(request: NextRequest) {
  const fallback = new URL("/links", canonicalOrigin(request));
  const target = process.env.VIBER_CHAT_URL?.trim() || DEFAULT_VIBER_CHAT_URL;
  try {
    const url = new URL(target);
    if (url.protocol !== "viber:" && url.protocol !== "https:") {
      return NextResponse.redirect(fallback, { status: 307 });
    }
    return NextResponse.redirect(url, { status: 307 });
  } catch {
    return NextResponse.redirect(fallback, { status: 307 });
  }
}
