/**
 * edge-forms — generic form-capture endpoint writing to D1.
 *
 * POST /submit  { form, fields, website?, ts? }
 *   - `form` must be in the allowlist (env FORMS, default contact/waitlist/newsletter)
 *   - honeypot: non-empty `website` -> silent 200 accept, no insert
 *   - speed bump: `ts` (client submit-time ms) < 2000ms ago -> reject
 *   - per-IP+form cap: 5 submissions / 24h (D1 count, fail-closed on error)
 *   - inserts into `form_submissions`; TG notify on success if secrets set
 *
 * Turnstile-ready: set TURNSTILE_SECRET + require `cf-turnstile-response`
 * field once a widget exists (no token has Turnstile scope yet — human gate).
 *
 * Secrets: TG_BOT_TOKEN, TG_CHAT_ID (optional notify).
 * State: shares portfolio-db (lazy-init tables, prefixed edge_forms_*).
 * TODO(d1-scope): move to a dedicated edge-forms-db when a D1-scoped token exists.
 */

interface Env {
  DB: D1Database;
  TG_BOT_TOKEN?: string;
  TG_CHAT_ID?: string;
  FORMS?: string;
  TURNSTILE_SECRET?: string;
}

const DEFAULT_FORMS = ["contact", "waitlist", "newsletter"];
const DAILY_CAP = 5;
const MAX_FIELD_LEN = 4000;
const MAX_FIELDS = 20;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS edge_forms_submissions (
    id TEXT PRIMARY KEY,
    form TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    fields_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_edge_forms_form_created
    ON edge_forms_submissions(form, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_edge_forms_ip_created
    ON edge_forms_submissions(ip_hash, created_at DESC)`,
];

let schemaReady: Promise<void> | null = null;
function ensureSchema(env: Env): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const stmt of SCHEMA) await env.DB.prepare(stmt).run();
    })().catch((e) => {
      schemaReady = null; // don't cache a rejected init — retry next request
      throw e;
    });
  }
  return schemaReady;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, cf-turnstile-response",
      "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
    },
  });
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function tg(env: Env, text: string): Promise<void> {
  if (!env.TG_BOT_TOKEN || !env.TG_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TG_CHAT_ID, text: text.slice(0, 4000) }),
  });
}

function allowedForms(env: Env): string[] {
  return (env.FORMS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .concat(DEFAULT_FORMS.filter((f) => !(env.FORMS || "").includes(f)));
}

async function verifyTurnstile(env: Env, token: string | null, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true; // not configured yet — honeypot+cap still apply
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
  });
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

async function handleSubmit(request: Request, env: Env): Promise<Response> {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "invalid JSON" });
  }

  const form = String(payload.form || "").trim();
  if (!allowedForms(env).includes(form)) {
    return json(400, { error: "unknown form" });
  }

  // Honeypot — bots fill hidden fields; accept silently, store nothing.
  if (payload.website) return json(200, { ok: true });

  // Speed bump — forms filled <2s are almost always bots.
  const ts = Number(payload.ts || 0);
  if (ts && Date.now() - ts < 2000) return json(200, { ok: true });

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const turnstile = request.headers.get("cf-turnstile-response");
  if (!(await verifyTurnstile(env, turnstile, ip))) {
    return json(403, { error: "verification failed" });
  }

  const rawFields = (payload.fields || {}) as Record<string, unknown>;
  if (typeof rawFields !== "object" || rawFields === null || Array.isArray(rawFields)) {
    return json(400, { error: "fields must be an object" });
  }
  const entries = Object.entries(rawFields).slice(0, MAX_FIELDS);
  const fields: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(k)) continue;
    fields[k] = String(v ?? "").slice(0, MAX_FIELD_LEN);
  }
  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return json(400, { error: "invalid email" });
  }

  await ensureSchema(env);
  const ipHash = (await sha256(ip)).slice(0, 32);

  // Per-IP daily cap — fail closed if the count query errors.
  const since = new Date(Date.now() - 86400_000).toISOString();
  const cap = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM edge_forms_submissions
     WHERE ip_hash = ? AND created_at > ?`
  )
    .bind(ipHash, since)
    .first<{ n: number }>();
  if ((cap?.n ?? DAILY_CAP) >= DAILY_CAP) {
    return json(429, { error: "rate limited" });
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO edge_forms_submissions (id, form, ip_hash, fields_json, created_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, form, ipHash, JSON.stringify(fields), createdAt)
    .run();

  const summary = Object.entries(fields)
    .map(([k, v]) => `*${k}:* ${String(v).slice(0, 200)}`)
    .join("\n");
  try {
    await tg(env, `[edge-forms] new ${form} submission\n${summary}`);
  } catch (e) {
    console.warn("tg notify failed:", e);
  }

  return json(200, { ok: true, id });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, cf-turnstile-response", "Access-Control-Allow-Methods": "POST,OPTIONS,GET" } });
    if (url.pathname === "/health") {
      return json(200, { ok: true, worker: "edge-forms" });
    }
    if (url.pathname === "/submit" && request.method === "POST") {
      try {
        return await handleSubmit(request, env);
      } catch (e) {
        return json(500, { error: String(e instanceof Error ? e.message : e) });
      }
    }
    return json(404, { error: "not found" });
  },
};
