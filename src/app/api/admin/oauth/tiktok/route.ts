import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createHmac } from "crypto";
import { getConfig } from "@/lib/ssm-config";

const TIKTOK_AUTH_URL = "https://business-api.tiktok.com/portal/auth";

function signState(nonce: string, secret: string): string {
  return createHmac("sha256", secret).update(nonce).digest("hex").slice(0, 16);
}

export function buildTikTokAuthUrl(
  appId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    app_id: appId,
    redirect_uri: redirectUri,
    state,
  });
  return `${TIKTOK_AUTH_URL}?${params.toString()}`;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const cfg = await getConfig();
  if (!cfg.TIKTOK_APP_ID || !cfg.TIKTOK_APP_SECRET) {
    return NextResponse.json(
      {
        error:
          "TIKTOK_APP_ID and TIKTOK_APP_SECRET must be set before starting OAuth.",
      },
      { status: 503 },
    );
  }

  const secret = process.env.CRON_SECRET ?? cfg.TIKTOK_APP_SECRET;
  const nonce = crypto.randomUUID();
  const sig = signState(nonce, secret);
  const state = `${nonce}.${sig}`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:4000";
  const redirectUri = `${appUrl}/api/admin/oauth/tiktok/callback`;
  const authUrl = buildTikTokAuthUrl(cfg.TIKTOK_APP_ID, redirectUri, state);

  return NextResponse.redirect(authUrl);
}
