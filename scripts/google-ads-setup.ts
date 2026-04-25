/**
 * Google Ads API setup helper.
 *
 * Prerequisites:
 *   1. Create a Google Ads Manager Account at ads.google.com
 *   2. Apply for a developer token at ads.google.com/aw/apicenter
 *   3. Add ga-service-account@credentials-462313.iam.gserviceaccount.com
 *      to the Manager Account (Admin > Access and Security > Users > +)
 *   4. Set GOOGLE_ADS_DEVELOPER_TOKEN in .env.local
 *
 * Usage:
 *   pnpm tsx scripts/google-ads-setup.ts
 */

import { createSign } from "crypto";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const SCOPE = "https://www.googleapis.com/auth/adwords";

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_CLIENT_EMAIL ?? "";
  const rawKey = process.env.GOOGLE_PRIVATE_KEY ?? "";
  const privateKey = rawKey.replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    throw new Error("GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY not set in .env.local");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({ iss: email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = base64url(signer.sign(privateKey));
  const jwt = `${header}.${payload}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });

  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`Token exchange failed: ${data.error} — ${data.error_description}`);
  }
  return data.access_token;
}

async function listCustomers(accessToken: string, devToken: string): Promise<string[]> {
  const res = await fetch(
    "https://googleads.googleapis.com/v19/customers:listAccessibleCustomers",
    { headers: { Authorization: `Bearer ${accessToken}`, "developer-token": devToken } }
  );
  const data = (await res.json()) as { resourceNames?: string[]; error?: { message: string } };
  if (data.error) throw new Error(`listAccessibleCustomers: ${data.error.message}`);
  return (data.resourceNames ?? []).map((n) => n.replace("customers/", ""));
}

async function main() {
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "";
  if (!devToken) {
    console.error(
      "\nMissing GOOGLE_ADS_DEVELOPER_TOKEN in .env.local\n" +
      "Get it from: https://ads.google.com/aw/apicenter\n" +
      "(Requires a Google Ads Manager Account — create one at ads.google.com if needed)\n"
    );
    process.exit(1);
  }

  console.log("\n=== Google Ads Setup Helper ===\n");
  console.log("Generating service account access token...");
  const accessToken = await getAccessToken();
  console.log("Access token generated (valid 1 hour)\n");

  console.log("Listing accessible customer IDs...");
  const customerIds = await listCustomers(accessToken, devToken);

  if (customerIds.length === 0) {
    console.log(
      "\nNo customer IDs found.\n" +
      "Make sure ga-service-account@credentials-462313.iam.gserviceaccount.com\n" +
      "has been added to your Google Ads Manager Account.\n"
    );
    return;
  }

  console.log("\n========== RESULTS ==========");
  console.log(`GOOGLE_ADS_ACCESS_TOKEN is generated at runtime — no static value needed`);
  customerIds.forEach((id, i) => {
    console.log(`\nAccount ${i + 1}: GOOGLE_ADS_CUSTOMER_ID=${id}`);
  });
  console.log("\n=== Copy GOOGLE_ADS_CUSTOMER_ID into .env.local ===");
  console.log("The access token is generated automatically by the app — do not store it.\n");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
