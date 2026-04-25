/**
 * TikTok Business API OAuth helper.
 *
 * Usage:
 *   pnpm tsx scripts/tiktok-oauth.ts
 *
 * What it does:
 *   1. Starts a local HTTP server on port 9999 to capture the OAuth callback
 *   2. Prints the TikTok authorization URL — open it in a browser and authorize
 *   3. Captures auth_code from the redirect, exchanges it for access_token
 *   4. Lists advertiser IDs accessible by that token
 *   5. Prints the values to copy into .env.local / SSM
 */

import { bypassFetch } from "./dns-bypass.js";
import http from "http";
import { exec } from "child_process";
import { URL } from "url";

const APP_ID = process.env.TIKTOK_APP_ID ?? "awtn8vvhotyxe9oc";
const APP_SECRET =
  process.env.TIKTOK_APP_SECRET ?? "hTgxqCIRDKSYEQD3xuQan7FTm1dagneU";
const REDIRECT_URI = "http://localhost:9999/callback";
const PORT = 9999;

const AUTH_URL =
  `https://business-api.tiktok.com/portal/auth` +
  `?app_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=cloudless`;

async function exchangeAuthCode(authCode: string) {
  const res = await bypassFetch(
    "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: APP_ID, secret: APP_SECRET, auth_code: authCode }),
    }
  );
  return res.json() as Promise<{
    code: number;
    message: string;
    data?: { access_token: string; refresh_token: string; advertiser_ids: number[]; expires_in: number };
  }>;
}

async function listAdvertisers(accessToken: string) {
  const url =
    `https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/` +
    `?app_id=${APP_ID}&secret=${APP_SECRET}`;
  const res = await bypassFetch(url, {
    headers: { "Access-Token": accessToken },
  });
  return res.json() as Promise<{
    code: number;
    data?: { list: Array<{ advertiser_id: number; advertiser_name: string }> };
  }>;
}

function openBrowser(url: string) {
  if (process.platform === "win32") {
    // Use a separate Chrome profile with host-resolver-rules to bypass local DNS blocks
    const rules = [
      "MAP business-api.tiktok.com 2.21.69.8",
      "MAP ads.tiktok.com 2.16.19.9",
      "MAP www.tiktok.com 2.21.69.9",
    ].join(",");
    const profileDir = `C:\\Users\\baltz\\AppData\\Local\\Temp\\chrome-bypass-tiktok`;
    exec(`"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --host-resolver-rules="${rules}" --user-data-dir="${profileDir}" "${url}"`);
  } else {
    exec(process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`);
  }
}

async function main() {
  console.log("\n=== TikTok Business API OAuth ===\n");
  console.log("Starting local callback server on port", PORT);

  await new Promise<void>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url ?? "/", `http://localhost:${PORT}`);
        if (reqUrl.pathname !== "/callback") {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const authCode = reqUrl.searchParams.get("auth_code");
        if (!authCode) {
          res.writeHead(400);
          res.end("Missing auth_code parameter");
          return;
        }

        console.log("\nauth_code received:", authCode.substring(0, 20) + "...");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<h2>Authorization successful!</h2><p>You can close this tab.</p>"
        );
        server.close();

        console.log("\nExchanging auth_code for access_token...");
        const tokenRes = await exchangeAuthCode(authCode);

        if (tokenRes.code !== 0 || !tokenRes.data) {
          console.error("Token exchange failed:", tokenRes);
          reject(new Error(tokenRes.message));
          return;
        }

        const { access_token, refresh_token, advertiser_ids, expires_in } =
          tokenRes.data;

        console.log("\nFetching advertiser accounts...");
        const advRes = await listAdvertisers(access_token);

        console.log("\n========== RESULTS ==========");
        console.log(`TIKTOK_ACCESS_TOKEN=${access_token}`);
        console.log(`TIKTOK_REFRESH_TOKEN=${refresh_token}`);
        console.log(`Token expires in: ${expires_in}s (~${Math.round(expires_in / 3600)}h)`);

        if (advRes.data?.list?.length) {
          advRes.data.list.forEach((adv) => {
            console.log(`\nAdvertiser: ${adv.advertiser_name}`);
            console.log(`TIKTOK_ADVERTISER_ID=${adv.advertiser_id}`);
          });
        } else if (advertiser_ids?.length) {
          advertiser_ids.forEach((id) => {
            console.log(`TIKTOK_ADVERTISER_ID=${id}`);
          });
        } else {
          console.log("No advertiser accounts found for this token.");
        }

        console.log("\n=== Copy the values above into .env.local ===");
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    server.listen(PORT, () => {
      console.log(`\nOpen this URL in your browser to authorize:\n\n${AUTH_URL}\n`);
      openBrowser(AUTH_URL);
    });

    server.on("error", reject);
  });
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
