/**
 * Set CORS on an R2 bucket via S3-compatible API (aws4fetch).
 * Usage: node scripts/r2-cors-policy.js
 *
 * Requires CF_R2_ACCESS_KEY_ID + CF_R2_SECRET_ACCESS_KEY + CLOUDFLARE_ACCOUNT_ID.
 */
import { AwsClient } from "aws4fetch";

const ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID ||
  process.env.CF_ACCOUNT_ID ||
  "fb7dc7b69b662480cd5961a4d1913c78";
const BUCKET_NAME = process.env.R2_ASSETS_BUCKET || "cloudless-assets";
const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

async function setCorsPolicy() {
  if (!accessKeyId || !secretAccessKey) {
    console.error("Missing CF_R2_ACCESS_KEY_ID / CF_R2_SECRET_ACCESS_KEY");
    process.exit(1);
  }

  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });

  const corsXml = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>86400</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>`;

  try {
    const res = await client.fetch(
      `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET_NAME}?cors`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/xml" },
        body: corsXml,
      }
    );
    if (!res.ok) {
      throw new Error(`${res.status} ${await res.text()}`);
    }
    console.log(`✅ CORS policy set on ${BUCKET_NAME}`);
  } catch (error) {
    console.error("❌ CORS setup failed:", error instanceof Error ? error.message : error);
    console.log(
      "\nManual alternative: Cloudflare Dashboard → R2 → bucket → Settings → CORS"
    );
    process.exit(1);
  }
}

setCorsPolicy();
