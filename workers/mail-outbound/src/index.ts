/**
 * mail-outbound — transactional funnel email via the send_email binding.
 *
 * Phases the Cloudflare paid Email Sending feature into the stack:
 *   POST /send   — send one transactional message (Bearer-authed)
 *   POST /verify — send a self-test to the verification inbox
 *   GET  /health — liveness
 *
 * Categories are allowlisted to keep this worker transactional-only;
 * bulk marketing stays on ActiveCampaign/ESP. SocialAuto's SMTP path
 * (omv-ha/Resend) remains the fallback transport — this worker is the
 * Cloudflare-first primary behind the CF_EMAIL_ENABLED gate.
 */

import { EmailMessage } from "cloudflare:email";
import { createMimeMessage, Mailbox } from "mimetext";

interface Env {
  SEND_EMAIL: SendEmail;
  MAIL_OUTBOUND_TOKEN: string;
  DEFAULT_FROM?: string;
  VERIFY_TO?: string;
}

const CATEGORIES = new Set([
  "audit-confirm",
  "nurture",
  "quiet-lead",
  "loa-delivery",
  "playbook",
  "ops-alert",
]);

/**
 * Sender defaults. `DEFAULT_FROM_ADDR` must stay a bare address: it is
 * used both for the MIME `From` header (via `setSender`, which adds the
 * display name itself) and for the SMTP envelope sender passed to
 * `EmailMessage`, which rejects display-name forms.
 */
const DEFAULT_FROM_ADDR = "no-reply@cloudless.gr";
const DEFAULT_FROM_NAME = "Cloudless";

/**
 * Accepts either a bare address (`no-reply@cloudless.gr`) or an RFC 5322
 * display-name form (`Cloudless <no-reply@cloudless.gr>`) and always
 * returns the two parts separately, so a configured `DEFAULT_FROM` in
 * either shape can never corrupt the header or the envelope sender.
 */
function parseSender(value: string): { name: string; addr: string } {
  // Deterministic parse — no regex over untrusted input (CodeQL
  // js/polynomial-redos). Bounded length first.
  const trimmed = value.trim().slice(0, 320);
  const lt = trimmed.indexOf("<");
  if (lt === -1) return { name: DEFAULT_FROM_NAME, addr: trimmed };
  const gt = trimmed.indexOf(">", lt);
  if (gt === -1) return { name: DEFAULT_FROM_NAME, addr: trimmed };
  const addr = trimmed.slice(lt + 1, gt).trim();
  if (!addr || /\s/.test(addr)) return { name: DEFAULT_FROM_NAME, addr: trimmed };
  let name = trimmed.slice(0, lt).trim();
  if (name.length > 1 && name.startsWith('"') && name.endsWith('"')) {
    name = name.slice(1, -1);
  }
  return { name: name || DEFAULT_FROM_NAME, addr };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function authorized(request: Request, env: Env): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return Boolean(token) && token === env.MAIL_OUTBOUND_TOKEN;
}

type SendBody = {
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  from?: string;
  category?: string;
  replyTo?: string;
  listUnsubscribe?: string;
};

async function deliver(env: Env, b: Required<Pick<SendBody, "to" | "subject">> & SendBody) {
  const sender = parseSender(b.from ?? env.DEFAULT_FROM ?? DEFAULT_FROM_ADDR);
  const msg = createMimeMessage();
  msg.setSender(sender);
  msg.setRecipient(b.to);
  msg.setSubject(b.subject);
  if (b.replyTo) msg.setHeader("Reply-To", new Mailbox(b.replyTo));
  if (b.listUnsubscribe) {
    msg.setHeader("List-Unsubscribe", `<${b.listUnsubscribe}>`);
    msg.setHeader("List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
  }
  // mimetext only *declares* Content-Transfer-Encoding — the body is dumped
  // verbatim — so encode ourselves: base64 keeps arbitrary UTF-8 intact
  // under the declared 7bit-default otherwise-corrupting transport.
  // (No nodejs_compat: TextEncoder + btoa, not Buffer.)
  const b64 = (s: string) => {
    const bytes = new TextEncoder().encode(s);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    // RFC 2045 §6.8 / RFC 5322 §2.1.1: base64 payload lines ≤76 chars, CRLF-joined.
    const raw = btoa(bin);
    return raw.replace(/.{1,76}/g, (m) => m + "\r\n");
  };
  msg.addMessage({ contentType: "text/plain", data: b64(b.text ?? ""), encoding: "base64" });
  if (b.html) msg.addMessage({ contentType: "text/html", data: b64(b.html), encoding: "base64" });
  // Envelope sender must be the bare address, never "Name <addr>".
  const raw = new EmailMessage(sender.addr, b.to, msg.asRaw());
  await env.SEND_EMAIL.send(raw);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "mail-outbound" });
    }
    if (!authorized(request, env)) {
      return json({ error: "unauthorized" }, 401);
    }

    if (request.method === "POST" && url.pathname === "/verify") {
      try {
        await deliver(env, {
          to: env.VERIFY_TO ?? "tbaltzakis@cloudless.gr",
          subject: "mail-outbound self-test",
          text: `send_email binding OK — ${new Date().toISOString()}`,
          category: "ops-alert",
        });
        return json({ ok: true, sent: true });
      } catch {
        return json({ ok: false, error: "send failed" }, 502);
      }
    }

    if (request.method === "POST" && url.pathname === "/send") {
      let body: SendBody;
      try {
        body = (await request.json()) as SendBody;
      } catch {
        return json({ error: "invalid_json" }, 400);
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json({ error: "invalid_body" }, 400);
      }
      if (!body.to || !body.subject || (!body.text && !body.html)) {
        return json({ error: "to, subject and text|html are required" }, 400);
      }
      // Header-bound fields must not carry CR/LF — mimetext writes mailbox
      // values raw into headers, so a CRLF here would inject extra headers.
      for (const f of [body.to, body.subject, body.from, body.replyTo, body.listUnsubscribe]) {
        if (typeof f === "string" && /[\r\n]/.test(f)) {
          return json({ error: "header fields must not contain CR/LF" }, 400);
        }
      }
      const category = body.category ?? "ops-alert";
      if (!CATEGORIES.has(category)) {
        return json({ error: `category must be one of: ${[...CATEGORIES].join(", ")}` }, 400);
      }
      try {
        await deliver(env, { ...body, to: body.to, subject: body.subject });
        return json({ ok: true, category });
      } catch {
        return json({ ok: false, error: "send failed" }, 502);
      }
    }

    return json({ error: "not_found" }, 404);
  },
};
