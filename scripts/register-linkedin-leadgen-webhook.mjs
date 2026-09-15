#!/usr/bin/env node
/**
 * Register an owner-level LinkedIn Lead Gen webhook subscription.
 *
 * Usage (from repo root, with secrets in env):
 *   LINKEDIN_ACCESS_TOKEN=… LINKEDIN_AD_ACCOUNT_ID=512642510 \
 *     node scripts/register-linkedin-leadgen-webhook.mjs
 *
 * Optional:
 *   WEBHOOK_URL=https://cloudless.gr/api/webhooks/linkedin-leads
 *
 * Requires token scopes that include r_marketing_leadgen_automation (Lead Sync).
 */

const API = "https://api.linkedin.com/rest";
const VERSION = "202605";

const token = process.env.LINKEDIN_ACCESS_TOKEN || process.env.LINKEDIN_CAPI_ACCESS_TOKEN;
const accountId = process.env.LINKEDIN_AD_ACCOUNT_ID || "512642510";
const webhook =
  process.env.WEBHOOK_URL || "https://cloudless.gr/api/webhooks/linkedin-leads";

if (!token) {
  console.error("Missing LINKEDIN_ACCESS_TOKEN (or LINKEDIN_CAPI_ACCESS_TOKEN)");
  process.exit(1);
}

const body = {
  webhook,
  owner: { sponsoredAccount: `urn:li:sponsoredAccount:${accountId}` },
  leadType: "SPONSORED",
};

const res = await fetch(`${API}/leadNotifications`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await res.text();
console.log("status", res.status);
console.log(text);
if (!res.ok) process.exit(1);
console.log("\nDone. LinkedIn will GET-challenge the webhook, then push leads on CREATED.");
