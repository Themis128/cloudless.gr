/**
 * S3-compatible R2Bucket shim for Node (Pi / next start).
 * Workers use native bindings; here we use CF_R2_* + aws4fetch.
 */

import type {
  R2Bucket,
  R2GetOptions,
  R2HTTPMetadata,
  R2ListOptions,
  R2Object,
  R2ObjectBody,
  R2Objects,
  R2PutOptions,
} from "@cloudflare/workers-types";
import { createR2ClientFromEnv, r2ObjectUrl } from "@/lib/r2-upload";

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  return ab;
}

function toBodyInit(body: ArrayBuffer | ArrayBufferView | string | Blob | ReadableStream): BodyInit {
  if (typeof body === "string") return body;
  if (body instanceof Blob) return body;
  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) return body;
  if (body instanceof ArrayBuffer) return body;
  if (ArrayBuffer.isView(body)) {
    return bytesToArrayBuffer(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
  }
  throw new TypeError("Unsupported R2 put body type");
}

async function bodyToBytes(
  value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null
): Promise<Uint8Array> {
  if (value == null) return new Uint8Array(0);
  if (typeof value === "string") return new TextEncoder().encode(value);
  if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (typeof ReadableStream !== "undefined" && value instanceof ReadableStream) {
    const res = new Response(value);
    return new Uint8Array(await res.arrayBuffer());
  }
  throw new TypeError("Unsupported R2 body");
}

function putContentType(options?: R2PutOptions): string {
  const meta = options?.httpMetadata;
  if (!meta) return "application/octet-stream";
  if (typeof Headers !== "undefined" && meta instanceof Headers) {
    return meta.get("content-type") || "application/octet-stream";
  }
  const typed = meta as R2HTTPMetadata;
  return typed.contentType || "application/octet-stream";
}

function stubObject(
  key: string,
  size: number,
  contentType?: string | null,
  extra?: Partial<R2Object>
): R2Object {
  return {
    key,
    size,
    etag: "",
    httpEtag: "",
    uploaded: new Date(),
    httpMetadata: contentType ? { contentType } : {},
    customMetadata: {},
    storageClass: "STANDARD",
    checksums: {},
    writeHttpMetadata(headers: Headers) {
      if (contentType) headers.set("content-type", contentType);
    },
    ...extra,
  } as unknown as R2Object;
}

function makeObjectBody(key: string, bytes: Uint8Array, contentType?: string | null): R2ObjectBody {
  const size = bytes.byteLength;
  const abPart = bytesToArrayBuffer(bytes);
  const base = stubObject(key, size, contentType);
  return {
    ...base,
    body: new Blob([abPart]).stream(),
    bodyUsed: false,
    arrayBuffer: async () => bytesToArrayBuffer(bytes),
    text: async () => new TextDecoder().decode(bytes),
    json: async <T>() => JSON.parse(new TextDecoder().decode(bytes)) as T,
    blob: async () => new Blob([abPart], { type: contentType || undefined }),
  } as unknown as R2ObjectBody;
}

function hasR2S3Credentials(): boolean {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
  const accessKeyId = process.env.CF_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CF_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
  return Boolean(accountId && accessKeyId && secretAccessKey);
}

export function resolveDataLakeBucketName(): string {
  return (
    process.env.ANALYTICS_BUCKET ||
    process.env.DATALAKE_BUCKET_NAME ||
    process.env.R2_BUCKET_NAME ||
    "datalake-bucket"
  );
}

/** Minimal R2Bucket backed by the S3-compatible R2 API. */
export function createNodeDataLakeBucket(bucketName = resolveDataLakeBucketName()): R2Bucket | null {
  if (!hasR2S3Credentials()) return null;

  const client = createR2ClientFromEnv();

  const get = async (key: string, _options?: R2GetOptions): Promise<R2ObjectBody | null> => {
    const res = await client.fetch(r2ObjectUrl(key, bucketName), { method: "GET" });
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`R2 GET ${bucketName}/${key} → ${res.status}: ${text.slice(0, 300)}`);
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    return makeObjectBody(key, bytes, res.headers.get("content-type"));
  };

  const head = async (key: string): Promise<R2Object | null> => {
    const res = await client.fetch(r2ObjectUrl(key, bucketName), { method: "HEAD" });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`R2 HEAD ${bucketName}/${key} → ${res.status}`);
    }
    const size = Number(res.headers.get("content-length") || 0);
    const contentType = res.headers.get("content-type");
    return stubObject(key, size, contentType, {
      etag: res.headers.get("etag") || "",
      httpEtag: res.headers.get("etag") || "",
      uploaded: new Date(res.headers.get("last-modified") || Date.now()),
    });
  };

  const put = async (
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
    options?: R2PutOptions
  ): Promise<R2Object> => {
    const bytes = await bodyToBytes(value);
    const contentType = putContentType(options);
    const res = await client.fetch(r2ObjectUrl(key, bucketName), {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: toBodyInit(bytes),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`R2 PUT ${bucketName}/${key} → ${res.status}: ${text.slice(0, 300)}`);
    }
    return stubObject(key, bytes.byteLength, contentType, {
      etag: res.headers.get("etag") || "",
      httpEtag: res.headers.get("etag") || "",
      customMetadata: options?.customMetadata || {},
    });
  };

  const del = async (keys: string | string[]): Promise<void> => {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
      const res = await client.fetch(r2ObjectUrl(key, bucketName), { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        throw new Error(`R2 DELETE ${bucketName}/${key} → ${res.status}`);
      }
    }
  };

  const list = async (options?: R2ListOptions): Promise<R2Objects> => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
    if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID required");
    const listUrl = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucketName}`);
    listUrl.searchParams.set("list-type", "2");
    if (options?.prefix) listUrl.searchParams.set("prefix", options.prefix);
    if (options?.cursor) listUrl.searchParams.set("continuation-token", options.cursor);
    const limit = options?.limit ?? 1000;
    listUrl.searchParams.set("max-keys", String(limit));
    if (options?.delimiter) listUrl.searchParams.set("delimiter", options.delimiter);

    const res = await client.fetch(listUrl.toString(), { method: "GET" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`R2 LIST ${bucketName} → ${res.status}: ${text.slice(0, 300)}`);
    }
    const xml = await res.text();
    const objects: R2Object[] = [];
    const keyRe = /<Key>([^<]*)<\/Key>/g;
    let m: RegExpExecArray | null;
    while ((m = keyRe.exec(xml)) !== null) {
      objects.push(stubObject(m[1], 0, null, { uploaded: new Date(0) }));
    }
    const truncated = /<IsTruncated>true<\/IsTruncated>/i.test(xml);
    const nextToken = xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/)?.[1];
    return {
      objects,
      truncated,
      cursor: nextToken,
      delimitedPrefixes: [],
    } as unknown as R2Objects;
  };

  return {
    get,
    head,
    put,
    delete: del,
    list,
    createMultipartUpload: async () => {
      throw new Error("Node R2 shim: createMultipartUpload not implemented");
    },
    resumeMultipartUpload: () => {
      throw new Error("Node R2 shim: resumeMultipartUpload not implemented");
    },
  } as unknown as R2Bucket;
}
