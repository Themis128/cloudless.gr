/**
 * lead-scheduler — Durable Objects for funnel timing + consistency.
 *
 *  LeadFollowup : per-lead quiet-follow-up cadence — enroll → alarm at
 *                 +24h → dispatch → +3d → dispatch → +7d → dispatch → done.
 *                 The manifest's quiet-lead sequence, serverless. Sweep in
 *                 SocialAuto stays the Postgres-authoritative fallback.
 *  BookingSlot  : atomic slot holds for the /audit booking flow —
 *                 hold() succeeds exactly once per slot until released.
 *  WebhookDedup : TTL seen-cache for inbound webhooks (Meta leads,
 *                 Slack events, Stripe) — firstSeen:true only once.
 */

import { DurableObject } from "cloudflare:workers";

interface Env {
  LEAD_FOLLOWUP: DurableObjectNamespace<LeadFollowup>;
  BOOKING_SLOT: DurableObjectNamespace<BookingSlot>;
  WEBHOOK_DEDUP: DurableObjectNamespace<WebhookDedup>;
  SCHEDULER_TOKEN: string;
  DISPATCH_URL?: string; // e.g. https://mail-outbound.<acct>.workers.dev/send
  DISPATCH_TOKEN?: string;
  STEP_DELAYS_HOURS?: string; // "24,72,168"
  STEP_SUBJECTS?: string; // pipe-separated per step
  STEP_BODIES?: string; // pipe-separated per step; "{name}" is substituted
  PUBLIC_BASE_URL?: string; // this worker's public origin — builds unsubscribe links
}

const DEFAULT_DELAYS = [24, 72, 168]; // 24h nudge, 3d pain, 7d clean break
const DEFAULT_SUBJECTS = [
  "Quick question about your free tech checkup",
  "Still fighting slow tools or high software bills?",
  "Last note — closing your file",
];
const DEFAULT_BODIES = [
  "Hi {name},\n\nYou grabbed the free 30-minute tech checkup slot but never booked a time. Happy to walk through your setup — slow site, duplicate SaaS spend, manual busywork — and tell you honestly whether it's worth fixing.\n\nReply to this email or grab a slot at https://cloudless.gr/audit and I'll take a look.",
  "Hi {name},\n\nLast note from me on this. Most of the teams I talk to are losing hours a week to tools that don't talk to each other and software bills that keep growing. If that's not you, ignore this — I'll close your file.\n\nIf it is, the fastest check is the free tech checkup: https://cloudless.gr/audit",
  "Hi {name},\n\nClosing the loop — I won't keep emailing. If the timing's ever right for a tech checkup or a second pair of eyes on your stack, cloudless.gr/audit is always open.\n\nEither way, thanks for your interest.",
];

/** Alarm retry budget for a failing dispatch before the lead is parked. */
const MAX_DISPATCH_ATTEMPTS = 6;
const DISPATCH_RETRY_MS = 3600_000; // 1h between dispatch retries

type LeadState = {
  email: string;
  name?: string;
  step: number; // next step index to send
  startedAt: number;
  done?: boolean;
  /** Consecutive failed dispatch attempts for the current step. */
  attempts?: number;
  lastError?: string;
};

// Linear-time email shape check — a single-pass parse avoids the
// polynomial-backtracking regex CodeQL flags on nested [^\s@]+ classes.
function isValidEmail(email: string): boolean {
  if (/\s/.test(email)) return false;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return false;
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  return dot > 0 && dot < domain.length - 1;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

export class LeadFollowup extends DurableObject<Env> {
  private state(): DurableObjectState {
    return this.ctx as DurableObjectState;
  }

  private delays(): number[] {
    const custom = (this.env.STEP_DELAYS_HOURS ?? "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    // Per-step override: a partial STEP_DELAYS_HOURS replaces only the
    // leading steps — padding with defaults keeps later steps aligned
    // instead of shifting them left.
    return DEFAULT_DELAYS.map((d, i) => custom[i] ?? d);
  }

  async enroll(lead: { email: string; name?: string }): Promise<Response> {
    const email = lead.email?.trim() ?? "";
    if (!isValidEmail(email)) {
      return Response.json({ ok: false, reason: "valid-email-required" }, { status: 400 });
    }
    const existing = await this.ctx.storage.get<LeadState>("lead");
    if (existing?.done) return Response.json({ ok: false, reason: "sequence-finished" });
    const delays = this.delays();
    const st: LeadState = existing ?? {
      email,
      name: lead.name?.trim() || undefined,
      step: 0,
      startedAt: Date.now(),
    };
    const nextInHours = delays[st.step] ?? delays[delays.length - 1];
    await this.ctx.storage.put("lead", st);
    // Re-enrolling an already-active lead must not push back the
    // pending alarm — that would postpone the sequence indefinitely
    // for anyone who submits a form twice.
    const pending = await this.ctx.storage.getAlarm();
    if (pending === null) {
      await this.ctx.storage.setAlarm(Date.now() + nextInHours * 3600_000);
    }
    return Response.json({
      ok: true,
      step: st.step,
      nextInHours,
      alarmAt: pending ?? (await this.ctx.storage.getAlarm()),
      alreadyEnrolled: Boolean(existing),
    });
  }

  async unsubscribe(): Promise<Response> {
    const st = await this.ctx.storage.get<LeadState>("lead");
    if (st) await this.ctx.storage.put("lead", { ...st, done: true });
    await this.ctx.storage.deleteAlarm();
    return Response.json({ ok: true });
  }

  async status(): Promise<Response> {
    const st = await this.ctx.storage.get<LeadState>("lead");
    return Response.json({ lead: st ?? null, alarm: await this.ctx.storage.getAlarm() });
  }

  /**
   * Park a failed dispatch: keep `step` where it is, retry in an hour and
   * give up (without pretending the mail went out) once the attempt
   * budget is spent. Never advances the step on failure.
   */
  private async retryLater(st: LeadState, reason: string): Promise<void> {
    // The dispatch fetch above is an input-gate await — /unsubscribe may
    // have flipped `done` meanwhile. Re-read before writing so the retry
    // state can't resurrect a finished sequence or re-arm its alarm.
    const fresh = (await this.ctx.storage.get<LeadState>("lead")) ?? st;
    if (fresh.done) return;
    const attempts = (fresh.attempts ?? 0) + 1;
    const exhausted = attempts >= MAX_DISPATCH_ATTEMPTS;
    await this.ctx.storage.put("lead", {
      ...fresh,
      attempts,
      lastError: reason,
      ...(exhausted ? { done: true } : {}),
    });
    if (exhausted) {
      console.error(
        `lead-scheduler: giving up on step ${fresh.step} after ${attempts} attempts — ${reason}`
      );
      return;
    }
    console.warn(
      `lead-scheduler: dispatch attempt ${attempts} for step ${fresh.step} failed — ${reason}`
    );
    await this.ctx.storage.setAlarm(Date.now() + DISPATCH_RETRY_MS);
  }

  async alarm(): Promise<void> {
    const st = await this.ctx.storage.get<LeadState>("lead");
    if (!st || st.done) return;
    const delays = this.delays();
    const subjects = (this.env.STEP_SUBJECTS ?? "").split("|").filter(Boolean);
    const subject = subjects[st.step] ?? DEFAULT_SUBJECTS[st.step] ?? `Follow-up ${st.step + 1}`;
    const bodies = (this.env.STEP_BODIES ?? "").split("|").filter(Boolean);
    const bodyTpl =
      bodies[st.step] ?? DEFAULT_BODIES[st.step] ?? DEFAULT_BODIES[DEFAULT_BODIES.length - 1];
    // Signed public unsubscribe link — the DO's own id is unguessable and
    // the HMAC proves the link came from us, so /u/ needs no bearer token.
    const uid = this.ctx.id.toString();
    const unsubUrl = this.env.PUBLIC_BASE_URL
      ? `${this.env.PUBLIC_BASE_URL.replace(/\/+$/, "")}/u/${uid}/${await hmacHex(uid, this.env.SCHEDULER_TOKEN)}`
      : undefined;
    if (!unsubUrl) {
      console.warn("lead-scheduler: PUBLIC_BASE_URL unset — dispatching without unsubscribe link");
    }
    let text = bodyTpl.replaceAll("{name}", st.name ?? "there");
    if (unsubUrl) text += `\n\n—\nCloudless · Unsubscribe: ${unsubUrl}`;
    if (!this.env.DISPATCH_URL) {
      // Misconfiguration, not a delivered step — retry rather than
      // silently burning through the cadence.
      await this.retryLater(st, "DISPATCH_URL is not configured");
      return;
    }
    let res: Response;
    try {
      res = await fetch(this.env.DISPATCH_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.env.DISPATCH_TOKEN ?? ""}`,
        },
        body: JSON.stringify({
          to: st.email,
          subject,
          text,
          category: "quiet-lead",
          listUnsubscribe: unsubUrl,
        }),
      });
    } catch (err) {
      await this.retryLater(st, `dispatch request failed: ${String(err)}`);
      return;
    }
    if (!res.ok) {
      await this.retryLater(st, `dispatch returned HTTP ${res.status}`);
      return;
    }
    // Durable Object input gates open across the awaited fetch above, so
    // a concurrent /unsubscribe may have run in the meantime. Re-read the
    // record instead of writing back the pre-fetch snapshot, which would
    // clobber `done` and re-arm a deleted alarm.
    const fresh = (await this.ctx.storage.get<LeadState>("lead")) ?? st;
    if (fresh.done) return;
    const next = Math.max(fresh.step, st.step) + 1;
    if (next >= delays.length) {
      await this.ctx.storage.put("lead", { ...fresh, step: next, attempts: 0, done: true });
      return;
    }
    await this.ctx.storage.put("lead", { ...fresh, step: next, attempts: 0 });
    await this.ctx.storage.setAlarm(Date.now() + delays[next] * 3600_000);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const body =
      request.method === "POST"
        ? (((await request.json().catch(() => ({}))) ?? {}) as {
            email?: string;
            name?: string;
          })
        : {};
    if (url.pathname === "/enroll")
      return this.enroll({ email: body.email ?? "", name: body.name });
    if (url.pathname === "/unsubscribe") return this.unsubscribe();
    if (url.pathname === "/status") return this.status();
    return Response.json({ error: "not_found" }, { status: 404 });
  }
}

const DEFAULT_HOLD_TTL_S = 900; // 15 min
const MAX_HOLD_TTL_S = 24 * 3600;

export class BookingSlot extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/hold") {
      const slotId = url.searchParams.get("slot") ?? "";
      if (!slotId) return Response.json({ ok: false, error: "slot required" }, { status: 400 });
      // An unvalidated `ttl` (NaN, 0, negative) would store an already
      // expired hold and silently break slot exclusivity.
      const rawTtl = url.searchParams.get("ttl");
      if (rawTtl !== null) {
        const parsed = Number(rawTtl);
        if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_HOLD_TTL_S) {
          return Response.json(
            { ok: false, error: `ttl must be a number between 1 and ${MAX_HOLD_TTL_S} seconds` },
            { status: 400 }
          );
        }
      }
      const ttl = (rawTtl === null ? DEFAULT_HOLD_TTL_S : Number(rawTtl)) * 1000;
      const expiresAt = await this.ctx.storage.transaction(async () => {
        const cur = await this.ctx.storage.get<number>(slotId);
        if (typeof cur === "number" && cur > Date.now()) return null;
        const next = Date.now() + ttl;
        await this.ctx.storage.put(slotId, next);
        return next;
      });
      return Response.json({ ok: expiresAt !== null, expiresAt });
    }
    if (url.pathname === "/release") {
      const slotId = url.searchParams.get("slot") ?? "";
      await this.ctx.storage.delete(slotId);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  }
}

export class WebhookDedup extends DurableObject<Env> {
  private static TTL = 7 * 24 * 3600_000;
  private static SWEEP_MS = 24 * 3600_000;

  async fetch(request: Request): Promise<Response> {
    const body = ((await request.json().catch(() => ({}))) ?? {}) as {
      eventId?: string;
    };
    const eventId = body.eventId;
    if (!eventId) return Response.json({ error: "eventId required" }, { status: 400 });
    const first = await this.ctx.storage.transaction(async () => {
      const cur = await this.ctx.storage.get<number>(eventId);
      // Stored values are expiry timestamps: an entry past its TTL must
      // not keep deduplicating forever, so treat it as unseen.
      if (typeof cur === "number" && cur > Date.now()) return false;
      await this.ctx.storage.put(eventId, Date.now() + WebhookDedup.TTL);
      return true;
    });
    // Keep exactly one sweep alarm armed so expired keys are purged and
    // storage stays bounded.
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + WebhookDedup.SWEEP_MS);
    }
    return Response.json({ firstSeen: first });
  }

  /** Purge expired dedup keys; re-arm while entries remain. */
  async alarm(): Promise<void> {
    const now = Date.now();
    const entries = await this.ctx.storage.list<number>();
    const expired: string[] = [];
    for (const [key, expiresAt] of entries) {
      if (typeof expiresAt !== "number" || expiresAt <= now) expired.push(key);
    }
    // DO storage.delete() accepts at most 128 keys per call — chunk.
    for (let i = 0; i < expired.length; i += 128) {
      await this.ctx.storage.delete(expired.slice(i, i + 128));
    }
    if (expired.length < entries.size) {
      await this.ctx.storage.setAlarm(now + WebhookDedup.SWEEP_MS);
    }
  }
}

function authorized(request: Request, env: Env): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return Boolean(token) && token === env.SCHEDULER_TOKEN;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "lead-scheduler" });
    }
    // Public unsubscribe: /u/<doId>/<hmac> — the signature (HMAC of the DO
    // id under SCHEDULER_TOKEN) is the credential, so no bearer token is
    // needed inside an email link. GET covers the link; POST covers
    // RFC 8058 one-click (List-Unsubscribe-Post) from mail clients.
    const um = url.pathname.match(/^\/u\/([0-9a-f]{64})\/([0-9a-f]{64})$/);
    if ((request.method === "GET" || request.method === "POST") && um) {
      const [, uid, sig] = um;
      const expected = await hmacHex(uid, env.SCHEDULER_TOKEN ?? "");
      if (!env.SCHEDULER_TOKEN || sig !== expected) {
        return Response.json({ error: "invalid_signature" }, { status: 403 });
      }
      const stub = env.LEAD_FOLLOWUP.get(env.LEAD_FOLLOWUP.idFromString(uid));
      return stub.fetch(new Request(`${url.origin}/unsubscribe`, request));
    }
    if (!authorized(request, env)) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    // /do/<kind>/<id>/<action>  kind: followup | slot | dedup
    const m = url.pathname.match(/^\/do\/(followup|slot|dedup)\/([^/]+)(\/.*)?$/);
    if (!m) return Response.json({ error: "not_found" }, { status: 404 });
    const [, kind, id, action = ""] = m;
    const stub =
      kind === "followup"
        ? env.LEAD_FOLLOWUP.get(env.LEAD_FOLLOWUP.idFromName(id))
        : kind === "slot"
          ? env.BOOKING_SLOT.get(env.BOOKING_SLOT.idFromName(id))
          : env.WEBHOOK_DEDUP.get(env.WEBHOOK_DEDUP.idFromName(id));
    const forward = new URL(url.origin + action + url.search);
    return stub.fetch(new Request(forward.toString(), request));
  },
};
