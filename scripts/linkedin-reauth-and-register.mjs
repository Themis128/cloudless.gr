#!/usr/bin/env node
/**
 * Re-authorize LinkedIn Marketing API (incl. Lead Gen) and register the webhook.
 *
 * Why: ACCESS + REFRESH tokens on the Pi / GH secrets expire or lack
 * `r_marketing_leadgen_automation`. CAPI token alone returns 403 on
 * leadNotifications.
 *
 * Flow:
 *   0. Non-interactive (if refresh still valid):
 *      node scripts/linkedin-reauth-and-register.mjs --refresh --no-leadgen
 *      or: gh workflow run "Refresh LinkedIn marketing token"
 *   1. Prefer local callback (add http://127.0.0.1:8765/callback to the
 *      Developer App Auth → Redirect URLs once):
 *      LINKEDIN_CLIENT_SECRET=… node scripts/linkedin-reauth-and-register.mjs --listen --no-leadgen
 *   2. Or Postiz redirect: print URL, paste ?code= from the Access-blocked redirect:
 *      node scripts/linkedin-reauth-and-register.mjs --code <AUTH_CODE>
 *   3. Script exchanges code, updates GH secrets, syncs Pi secrets, registers webhook
 *      (skip webhook with --no-leadgen).
 *
 * Env (or GH vars/secrets):
 *   LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET
 *   LINKEDIN_REDIRECT_URI (default: Postiz LinkedIn callback)
 *   LINKEDIN_AD_ACCOUNT_ID (default 512642510)
 */

import { createInterface } from "node:readline/promises";
import { createServer } from "node:http";
import { stdin as input, stdout as output } from "node:process";

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || "77tf4oysp8u3fz";
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || "";
const LOCAL_CALLBACK = "http://127.0.0.1:8765/callback";
// Must match the LinkedIn Developer App allowlist exactly (verified 2026-09-15:
// only postiz.cloudless.gr/integrations/social/linkedin is registered unless
// you add LOCAL_CALLBACK for --listen).
let REDIRECT_URI =
  process.env.LINKEDIN_REDIRECT_URI || "https://postiz.cloudless.gr/integrations/social/linkedin";
const ACCOUNT_ID = process.env.LINKEDIN_AD_ACCOUNT_ID || "512642510";
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://cloudless.gr/api/webhooks/linkedin-leads";
const REPO = process.env.GH_REPO || "Themis128/cloudless.gr";

const SCOPES = [
  "r_ads",
  "rw_ads",
  "r_ads_reporting",
  "r_organization_social",
  "w_organization_social",
  "rw_organization_admin",
  // Requires LinkedIn Marketing Developer Platform → Lead Sync product on the
  // app. If authorize returns unauthorized_scope_error for this scope, remove
  // it temporarily and enable the product in developers.linkedin.com first.
  "r_marketing_leadgen_automation",
].join(" ");

const SCOPES_WITHOUT_LEADGEN = [
  "r_ads",
  "rw_ads",
  "r_ads_reporting",
  "r_organization_social",
  "w_organization_social",
  "rw_organization_admin",
].join(" ");

function authorizeUrl(includeLeadgen = true) {
  const u = new URL("https://www.linkedin.com/oauth/v2/authorization");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", CLIENT_ID);
  u.searchParams.set("redirect_uri", REDIRECT_URI);
  u.searchParams.set("state", `cloudless-${Date.now()}`);
  u.searchParams.set("scope", includeLeadgen ? SCOPES : SCOPES_WITHOUT_LEADGEN);
  return u.toString();
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}

/** Capture OAuth ?code= on http://127.0.0.1:8765/callback (requires app allowlist). */
function listenForCode() {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      try {
        const u = new URL(req.url || "/", "http://127.0.0.1:8765");
        const err = u.searchParams.get("error");
        if (err) {
          const desc = u.searchParams.get("error_description") || "";
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(`OAuth error: ${err} ${desc}`);
          server.close();
          reject(new Error(`oauth error: ${err} ${desc}`.trim()));
          return;
        }
        const code = u.searchParams.get("code");
        if (!code) {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("missing code");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<!doctype html><html><body><p>LinkedIn auth OK — you can close this tab.</p></body></html>"
        );
        server.close();
        resolve(code);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
    server.on("error", reject);
    server.listen(8765, "127.0.0.1", () => {
      console.log(`Listening for OAuth redirect on ${LOCAL_CALLBACK}`);
    });
  });
}

async function tokenRequest(body) {
  if (!CLIENT_SECRET) {
    throw new Error("LINKEDIN_CLIENT_SECRET is required");
  }
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`token exchange failed: ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

async function exchangeCode(code) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    })
  );
}

/** Non-interactive refresh using LINKEDIN_REFRESH_TOKEN (GH secret / Pi env). */
async function refreshAccessToken(refreshToken) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    })
  );
}

async function ghSecretSet(name, value) {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync("gh", ["secret", "set", name, "--repo", REPO, "--body", value], {
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`gh secret set ${name} failed: ${r.stderr || r.stdout}`);
  }
  console.log(`updated GH secret ${name}`);
}

async function registerWebhook(accessToken) {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync("node", ["scripts/register-linkedin-leadgen-webhook.mjs"], {
    encoding: "utf8",
    env: {
      ...process.env,
      LINKEDIN_ACCESS_TOKEN: accessToken,
      LINKEDIN_AD_ACCOUNT_ID: ACCOUNT_ID,
      WEBHOOK_URL,
    },
  });
  process.stdout.write(r.stdout || "");
  process.stderr.write(r.stderr || "");
  if (r.status !== 0) {
    throw new Error("register-linkedin-leadgen-webhook.mjs failed");
  }
}

async function syncPiSecrets() {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(
    "gh",
    ["workflow", "run", "sync-campaign-ads-pi-secrets.yml", "--repo", REPO, "--ref", "main"],
    { encoding: "utf8" }
  );
  if (r.status !== 0) {
    console.warn("warn: could not dispatch sync-campaign-ads-pi-secrets:", r.stderr || r.stdout);
    return;
  }
  console.log("dispatched sync-campaign-ads-pi-secrets.yml");
}

async function persistAndMaybeRegister(tokens, { registerLeadgen }) {
  console.log(
    `got access_token (len=${tokens.access_token.length}), expires_in=${tokens.expires_in}`
  );

  await ghSecretSet("LINKEDIN_ACCESS_TOKEN", tokens.access_token);
  if (tokens.refresh_token) {
    await ghSecretSet("LINKEDIN_REFRESH_TOKEN", tokens.refresh_token);
  }

  await syncPiSecrets();

  if (!registerLeadgen) {
    console.log("Skipped Lead Gen webhook registration (--no-leadgen / --refresh-only).");
    console.log("Done.");
    return;
  }

  console.log("Registering Lead Gen webhook…");
  await registerWebhook(tokens.access_token);
  console.log("Done.");
}

async function main() {
  const skipLeadgen = process.argv.includes("--no-leadgen");
  const refreshOnly = process.argv.includes("--refresh") || process.argv.includes("--refresh-only");
  const listen = process.argv.includes("--listen");
  let code = argValue("--code");

  if (refreshOnly) {
    const refreshToken = process.env.LINKEDIN_REFRESH_TOKEN || "";
    if (!refreshToken) {
      throw new Error("LINKEDIN_REFRESH_TOKEN is required for --refresh");
    }
    console.log("Refreshing access token via refresh_token grant…");
    const tokens = await refreshAccessToken(refreshToken);
    await persistAndMaybeRegister(tokens, { registerLeadgen: !skipLeadgen });
    return;
  }

  if (listen) {
    REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || LOCAL_CALLBACK;
    console.log(
      "Add this Redirect URL in the LinkedIn Developer App (Auth tab) if missing:\n  " +
        REDIRECT_URI +
        "\n\nOpen this URL, approve scopes:\n"
    );
    console.log(authorizeUrl(!skipLeadgen));
    console.log("");
    code = await listenForCode();
  } else if (!code) {
    console.log("Open this URL, approve scopes, then re-run with --code <AUTH_CODE>:\n");
    console.log(authorizeUrl(!skipLeadgen));
    console.log(
      "\nRedirect URI (must match Developer App allowlist):\n  " +
        REDIRECT_URI +
        "\n\nPreferred (avoids Cloudflare Access OTP): add then use --listen:\n  " +
        LOCAL_CALLBACK +
        "\n\nPostiz Tailscale (no Access): http://100.74.191.58:30500/\n" +
        "(LinkedIn still redirects to the public HTTPS URI; copy ?code= from the\n" +
        "blocked URL bar if needed.)\n\n" +
        "If authorize fails with unauthorized_scope_error for\n" +
        "r_marketing_leadgen_automation: enable Lead Sync on the LinkedIn app,\n" +
        "or pass --no-leadgen to refresh marketing tokens without Lead Gen.\n\n" +
        "Non-interactive refresh failed 2026-09-15 (invalid_grant) — browser OAuth required."
    );
    if (process.stdin.isTTY) {
      const rl = createInterface({ input, output });
      code = (await rl.question("\nPaste authorization code (or Enter to exit): ")).trim();
      rl.close();
      if (!code) process.exit(0);
    } else {
      process.exit(0);
    }
  }

  // Allow pasting a full redirect URL
  if (code.includes("code=")) {
    code = new URL(code.includes("://") ? code : `https://x/?${code}`).searchParams.get("code");
  }

  console.log("Exchanging code…");
  const tokens = await exchangeCode(code);
  await persistAndMaybeRegister(tokens, { registerLeadgen: !skipLeadgen });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
