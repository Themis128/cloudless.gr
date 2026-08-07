/**
 * R2 Node helpers via aws4fetch (S3-compatible API, no @aws-sdk/client-s3).
 */

import { AwsClient } from "aws4fetch";

function requireR2Env() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
  const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing R2 credentials: CLOUDFLARE_ACCOUNT_ID and CF_R2_ACCESS_KEY_ID/CF_R2_SECRET_ACCESS_KEY required"
    );
  }
  return { accountId, accessKeyId, secretAccessKey };
}

export function createR2ClientFromEnv(): AwsClient {
  const { accessKeyId, secretAccessKey } = requireR2Env();
  return new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });
}

export function r2ObjectUrl(key: string, bucket: string): string {
  const { accountId } = requireR2Env();
  const encoded = key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encoded}`;
}

/** DOM BodyInit rejects Uint8Array<ArrayBufferLike> (TS 5.7+); copy onto ArrayBuffer. */
function toBodyInit(body: Buffer | Uint8Array | string): BodyInit {
  if (typeof body === "string") return body;
  // Explicit ArrayBuffer backing — see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html
  const ab = new ArrayBuffer(body.byteLength);
  const view = new Uint8Array(ab);
  view.set(body);
  return ab;
}

export async function r2PutObject(options: {
  bucket: string;
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
}): Promise<void> {
  const client = createR2ClientFromEnv();
  const contentType = options.contentType || "application/octet-stream";
  const res = await client.fetch(r2ObjectUrl(options.key, options.bucket), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: toBodyInit(options.body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `R2 PUT ${options.bucket}/${options.key} → ${res.status}: ${text.slice(0, 300)}`
    );
  }
}

export async function r2GetObject(options: { bucket: string; key: string }): Promise<Buffer> {
  const client = createR2ClientFromEnv();
  const res = await client.fetch(r2ObjectUrl(options.key, options.bucket), { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `R2 GET ${options.bucket}/${options.key} → ${res.status}: ${text.slice(0, 300)}`
    );
  }
  return Buffer.from(await res.arrayBuffer());
}
