import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createHmac, timingSafeEqual } from "crypto";
import { getConfig } from "@/lib/ssm-config";

const TOKEN_URL =
  "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function verifyState(state: string, secret: string): boolean {
  const dot = state.lastIndexOf(".");
  if (dot === -1) return false;
  const nonce = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac("sha256", secret)
    .update(nonce)
    .digest("hex")
    .slice(0, 16);
  const sigBuf = Buffer.from(sig, "utf-8");
  const expectedBuf = Buffer.from(expected, "utf-8");
  if (sigBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(sigBuf, expectedBuf);
}

interface TikTokTokenResponse {
  code: number;
  message: string;
  data?: {
    access_token: string;
    token_type: string;
    scope: string[];
    advertiser_ids: string[];
    creator_id: string;
    creator_name: string;
  };
}

async function exchangeCode(
  appId: string,
  secret: string,
  authCode: string,
): Promise<TikTokTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, secret, auth_code: authCode }),
    signal: AbortSignal.timeout(10_000),
  });
  return res.json() as Promise<TikTokTokenResponse>;
}

function successHtml(accessToken: string, advertiserIds: string[]): string {
  const adsBlock = advertiserIds
    .map((id) => `<code>TIKTOK_ADVERTISER_ID=${escapeHtml(id)}</code>`)
    .join("<br>");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>TikTok OAuth — Success</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 4rem auto; padding: 0 1rem; }
  h1 { color: #1a1a1a; } code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; word-break: break-all; }
  .box { background: #f9f9f9; border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; margin: 1rem 0; }
  .success { color: #16a34a; } .warn { color: #92400e; background: #fef3c7; padding: .75rem 1rem; border-radius: 6px; }
</style></head><body>
<h1 class="success">TikTok OAuth complete</h1>
<p>Add these values to <strong>AWS SSM</strong> under <code>/cloudless/production/</code> or to your <code>.env.local</code>:</p>
<div class="box">
  <code>TIKTOK_ACCESS_TOKEN=${escapeHtml(accessToken)}</code><br><br>
  ${adsBlock || "<em>No advertiser accounts returned. Ensure your app has access to at least one TikTok Ads account.</em>"}
</div>
<p class="warn">Store the access token securely. Do not commit it to version control. After saving, restart the server (or wait for the SSM cache to expire).</p>
<p><a href="/admin">Return to admin dashboard</a></p>
</body></html>`;
}

function errorHtml(message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>TikTok OAuth — Error</title>
<style>body { font-family: system-ui, sans-serif; max-width: 640px; margin: 4rem auto; padding: 0 1rem; } h1 { color: #dc2626; }</style>
</head><body>
<h1>TikTok OAuth failed</h1>
<p>${escapeHtml(message)}</p>
<p><a href="/admin">Return to admin dashboard</a></p>
</body></html>`;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const authCode = searchParams.get("auth_code");
  const state = searchParams.get("state") ?? "";
  const error = searchParams.get("error");

  if (error) {
    return new NextResponse(errorHtml(`TikTok returned an error: ${error}`), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (!authCode) {
    return new NextResponse(
      errorHtml("Missing auth_code in callback parameters."),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  const cfg = await getConfig();
  const secret = process.env.CRON_SECRET ?? cfg.TIKTOK_APP_SECRET;

  if (!verifyState(state, secret)) {
    return new NextResponse(
      errorHtml(
        "Invalid state parameter — possible CSRF. Restart the OAuth flow.",
      ),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  if (!cfg.TIKTOK_APP_ID || !cfg.TIKTOK_APP_SECRET) {
    return new NextResponse(
      errorHtml("TIKTOK_APP_ID or TIKTOK_APP_SECRET not configured."),
      {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  let tokenData: TikTokTokenResponse;
  try {
    tokenData = await exchangeCode(
      cfg.TIKTOK_APP_ID,
      cfg.TIKTOK_APP_SECRET,
      authCode,
    );
  } catch {
    return new NextResponse(
      errorHtml("Token exchange request failed. Check network connectivity."),
      {
        status: 502,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  if (tokenData.code !== 0 || !tokenData.data?.access_token) {
    return new NextResponse(
      errorHtml(
        `TikTok token exchange failed: ${tokenData.message ?? "unknown error"} (code ${tokenData.code})`,
      ),
      { status: 502, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  const { access_token, advertiser_ids } = tokenData.data;
  return new NextResponse(successHtml(access_token, advertiser_ids ?? []), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
