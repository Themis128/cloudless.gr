#!/usr/bin/env node
/**
 * Re-authorize LinkedIn Marketing API (incl. Lead Gen) and register the webhook.
 *
 * Why: ACCESS + REFRESH tokens on the Pi / GH secrets expire or lack
 * `r_marketing_leadgen_automation`. CAPI token alone returns 403 on
 * leadNotifications.
 *
 * Flow:
 *   1. node scripts/linkedin-reauth-and-register.mjs
 *      → prints authorize URL (open while logged into LinkedIn as ad-account admin)
 *   2. Paste ?code=… from redirect into:
 *      node scripts/linkedin-reauth-and-register.mjs --code <AUTH_CODE>
 *   3. Script exchanges code, updates GH secrets, syncs Pi secrets, registers webhook.
 *
 * Env (or GH vars/secrets):
 *   LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET
 *   LINKEDIN_REDIRECT_URI (default: LinkedIn OAuth Token Tool)
 *   LINKEDIN_AD_ACCOUNT_ID (default 512642510)
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || "77tf4oysp8u3fz";
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || "";
// Must match the LinkedIn Developer App allowlist exactly (verified 2026-09-15:
// only postiz.cloudless.gr/integrations/social/linkedin is registered).
const REDIRECT_URI =
  process.env.LINKEDIN_REDIRECT_URI ||
  "https://postiz.cloudless.gr/integrations/social/linkedin";
const ACCOUNT_ID = process.env.LINKEDIN_AD_ACCOUNT_ID || "512642510";
const WEBHOOK_URL =
  process.env.WEBHOOK_URL || "https://cloudless.gr/api/webhooks/linkedin-leads";
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

async function exchangeCode(code) {
  if (!CLIENT_SECRET) {
    throw new Error("LINKEDIN_CLIENT_SECRET is required to exchange the code");
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
  });
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

async function ghSecretSet(name, value) {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(
    "gh",
    ["secret", "set", name, "--repo", REPO, "--body", value],
    { encoding: "utf8" }
  );
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

async function main() {
  let code = argValue("--code");
  if (!code) {
    const skipLeadgen = process.argv.includes("--no-leadgen");
    console.log("Open this URL, approve scopes, then re-run with --code <AUTH_CODE>:\n");
    console.log(authorizeUrl(!skipLeadgen));
    console.log(
      "\nRedirect URI (must match Developer App allowlist):\n  " +
        REDIRECT_URI +
        "\n\nIf authorize fails with unauthorized_scope_error for\n" +
        "r_marketing_leadgen_automation: enable Lead Sync on the LinkedIn app,\n" +
        "or pass --no-leadgen to refresh marketing tokens without Lead Gen."
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
  console.log(
    `got access_token (len=${tokens.access_token.length}), expires_in=${tokens.expires_in}`
  );

  await ghSecretSet("LINKEDIN_ACCESS_TOKEN", tokens.access_token);
  if (tokens.refresh_token) {
    await ghSecretSet("LINKEDIN_REFRESH_TOKEN", tokens.refresh_token);
  }

  await syncPiSecrets();
  console.log("Registering Lead Gen webhook…");
  await registerWebhook(tokens.access_token);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
