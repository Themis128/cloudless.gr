/**
 * X (Twitter) Ads API setup helper.
 *
 * Generates OAuth 1.0a signature and lists accessible ad accounts.
 * Usage: pnpm tsx scripts/x-ads-setup.ts
 */

import { createHmac } from "crypto";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const API_KEY     = process.env.X_API_KEY ?? "";
const API_SECRET  = process.env.X_API_SECRET ?? "";
const ACCESS_TOKEN  = process.env.X_ACCESS_TOKEN ?? "";
const ACCESS_SECRET = process.env.X_ACCESS_SECRET ?? "";

function oauthSign(method: string, url: string, params: Record<string, string>, consumerSecret: string, tokenSecret: string): string {
  const sorted = Object.keys(params).sort().map(k =>
    `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`
  ).join("&");
  const base = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sorted)}`;
  const key  = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return createHmac("sha1", key).update(base).digest("base64");
}

function buildAuthHeader(method: string, url: string): string {
  const nonce     = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  const timestamp = String(Math.floor(Date.now() / 1000));

  const oauthParams: Record<string, string> = {
    oauth_consumer_key:     API_KEY,
    oauth_nonce:            nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp:        timestamp,
    oauth_token:            ACCESS_TOKEN,
    oauth_version:          "1.0",
  };

  const signature = oauthSign(method, url, oauthParams, API_SECRET, ACCESS_SECRET);
  oauthParams.oauth_signature = signature;

  const header = "OAuth " + Object.keys(oauthParams).sort().map(k =>
    `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`
  ).join(", ");
  return header;
}

async function main() {
  if (!API_KEY || !API_SECRET || !ACCESS_TOKEN || !ACCESS_SECRET) {
    console.error("Missing X API credentials in .env.local");
    process.exit(1);
  }

  console.log("\n=== X Ads API Setup Helper ===\n");

  // First verify credentials work with the standard API
  const verifyUrl = "https://api.x.com/2/users/me";
  const verifyRes = await fetch(verifyUrl, {
    headers: { Authorization: buildAuthHeader("GET", verifyUrl) },
  });
  const verifyData = await verifyRes.json() as { data?: { id: string; name: string; username: string } };
  if (verifyData.data) {
    console.log(`Authenticated as: @${verifyData.data.username} (${verifyData.data.name})`);
    console.log(`User ID: ${verifyData.data.id}\n`);
  } else {
    console.log("Auth response:", JSON.stringify(verifyData));
  }

  // Try Ads API accounts endpoint
  const adsUrl = "https://ads-api.x.com/12/accounts";
  console.log("Calling X Ads API...");
  const adsRes = await fetch(adsUrl, {
    headers: { Authorization: buildAuthHeader("GET", adsUrl) },
  });
  const adsData = await adsRes.json() as { data?: Array<{ id: string; name: string }> ; errors?: unknown };

  console.log(`Ads API HTTP status: ${adsRes.status}`);

  if (adsData.data?.length) {
    console.log("\n========== RESULTS ==========");
    adsData.data.forEach((acct, i) => {
      console.log(`\nAccount ${i + 1}: X_AD_ACCOUNT_ID=${acct.id}  (${acct.name})`);
    });
    console.log("\n=== Copy X_AD_ACCOUNT_ID into .env.local ===\n");
  } else {
    console.log("Response:", JSON.stringify(adsData, null, 2));
    console.log("\nIf you see a 403 or 'not authorized' error, the X Ads API requires");
    console.log("separate approval. Apply at: https://ads.x.com/help\n");
  }
}

main().catch(err => { console.error("Error:", err.message); process.exit(1); });
