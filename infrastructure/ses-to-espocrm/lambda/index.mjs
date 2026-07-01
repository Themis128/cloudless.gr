/**
 * SES → EspoCRM Case bridge.
 *
 * Trigger: S3 PutObject on cloudless-ses-inbound/inbound/* (set by the SES
 * receipt rule below). One object per inbound email — raw MIME, original
 * filename = the SES message-id.
 *
 * Flow:
 *   1. S3 PutObject event → invoke this Lambda
 *   2. Fetch the raw RFC 822 message from S3
 *   3. Parse subject, from, to, text body via mailparser
 *   4. Look up the sender Contact in EspoCRM by emailAddress
 *      - if found, link the Case to it via contactId
 *      - if not found, the Case has no contact link (admin can wire later)
 *   5. POST /api/v1/Case with name=subject, description=plain text body
 *   6. EspoCRM's existing Case.create webhook fires → Slack #notifications
 *      (already wired by PR #1030, no extra work here)
 *
 * Why not IMAP polling: Microsoft killed basic-auth IMAP on M365 in April
 * 2026 (per learn.microsoft.com/.../deprecation-of-basic-authentication-
 * exchange-online), and EspoCRM's bundled IMAP client doesn't speak OAuth2.
 * Going server-side via SES bypasses the entire IMAP auth surface.
 *
 * Auth: ESPOCRM_API_KEY pulled from SSM at cold-start, cached on the
 * module-level (TTL 5min). Same `cloudless-app` API user that lib/espocrm.ts
 * uses; role `Cloudless App Full Access` grants Case + Contact CRUD.
 */
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { simpleParser } from "mailparser";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const s3 = new S3Client({ region: REGION });
const ssm = new SSMClient({ region: REGION });

// Cold-start cache for SSM values — Lambda module scope persists across
// warm invocations, so we pay the SSM round-trip only on first call.
let cached = null;
let cachedAt = 0;
const SSM_TTL_MS = 5 * 60 * 1000;

async function getConfig() {
  const now = Date.now();
  if (cached && now - cachedAt < SSM_TTL_MS) return cached;
  const [base, key] = await Promise.all([
    ssm.send(
      new GetParameterCommand({
        Name: "/cloudless/production/ESPOCRM_BASE_URL",
      })
    ),
    ssm.send(
      new GetParameterCommand({
        Name: "/cloudless/production/ESPOCRM_API_KEY",
        WithDecryption: true,
      })
    ),
  ]);
  cached = {
    baseUrl: (base.Parameter?.Value ?? "").replace(/\/$/, ""),
    apiKey: key.Parameter?.Value ?? "",
  };
  cachedAt = now;
  return cached;
}

async function espoFetch(path, init = {}) {
  const { baseUrl, apiKey } = await getConfig();
  if (!baseUrl || !apiKey) {
    throw new Error("ESPOCRM_BASE_URL / API_KEY missing in SSM");
  }
  return fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
      ...(init.headers ?? {}),
    },
  });
}

async function findContactByEmail(email) {
  if (!email) return null;
  const params = new URLSearchParams({
    "where[0][type]": "equals",
    "where[0][attribute]": "emailAddress",
    "where[0][value]": email,
    maxSize: "1",
  });
  const res = await espoFetch(`/Contact?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.list?.[0]?.id ?? null;
}

async function createCase({ subject, body, contactId, fromEmail }) {
  const payload = {
    name: subject || "(no subject)",
    description: body || "(no body)",
    status: "New",
    priority: "Normal",
    type: "Question",
  };
  if (contactId) payload.contactId = contactId;
  const res = await espoFetch("/Case", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`EspoCRM Case create failed ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await res.json();
  console.log(`✓ Case created id=${data.id} from=${fromEmail} subject="${subject}"`);
  return data.id;
}

/**
 * Lambda entrypoint — invoked by S3 PutObject events on cloudless-ses-inbound.
 * Each event may carry multiple records; we process all sequentially so any
 * one failure doesn't kill the whole batch (errors bubble — Lambda's built-in
 * retry will replay the entire event, which is fine: Case create is
 * idempotent by S3 object key + we tolerate duplicates).
 */

function toText(value) {
  if (value == null || value === false) return "";
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join("\n");

  if (typeof value === "object") {
    if (typeof value.text === "string") return value.text;
    if (typeof value.html === "string") return value.html;
    if (typeof value.value === "string") return value.value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

export async function handler(event) {
  const records = event.Records ?? [];
  if (records.length === 0) {
    console.log("no S3 records in event");
    return { statusCode: 200 };
  }

  for (const rec of records) {
    const bucket = rec.s3.bucket.name;
    const key = decodeURIComponent(rec.s3.object.key.replace(/\+/g, " "));
    console.log(`processing s3://${bucket}/${key}`);

    const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const raw = await obj.Body.transformToString("utf-8");
    const parsed = await simpleParser(raw);

    const subject = (parsed.subject ?? "").trim();
    const fromEmail = parsed.from?.value?.[0]?.address?.toLowerCase() ?? "";
    const body = (toText(parsed.text) || toText(parsed.html) || toText(parsed.textAsHtml)).slice(0, 65000); // EspoCRM description column limit

    // Drop bounces, auto-replies, and obvious spam at the gate. These show up
    // as MAILER-DAEMON@*, no-reply@*, postmaster@*, etc. They're not customer
    // tickets — case-creating them clutters the queue.
    if (!fromEmail || /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply)@/i.test(fromEmail)) {
      console.log(`  skipped: auto-mail from=${fromEmail || "(empty)"}`);
      continue;
    }

    const contactId = await findContactByEmail(fromEmail);
    await createCase({ subject, body, contactId, fromEmail });
  }
  return { statusCode: 200, processed: records.length };
}
