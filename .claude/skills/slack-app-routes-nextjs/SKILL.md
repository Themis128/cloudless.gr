---
name: slack-app-routes-nextjs
description: Next.js App Router (and Lambda-on-Next.js) route templates for the three Slack endpoints — slash commands, events, interactions. Use whenever writing or auditing `src/app/api/<thing>-slack/{commands,events,interactions}/route.ts`. Covers raw-body signature verification, the 3-second response window, replay/dedup protection, and the `response_url` ephemeral-reply pattern. Companion to `slack-app-builder` (manifest design) and `slack-app-debugging` (when things break).
argument-hint: "the endpoint you're writing — 'commands', 'events', 'interactions', or 'all three'"
---

# Slack App Routes — Next.js patterns

Use this skill whenever you write the **server side** of a Slack app in
Next.js App Router or under SST/Lambda. The patterns below are battle-tested
against cloudless.gr's two production Slack apps (Cloudless ops + Newsletter
control). They handle the four things every Slack route gets wrong on the
first try:

1. **Raw-body parsing** for signature verification
2. **3-second response window** (defer heavy work)
3. **Replay attack protection** (signature + event_id dedup)
4. **Response routing** — sync body vs `response_url` follow-up

**Where helpers live in this repo:**

- `src/lib/slack-verify.ts` — main Cloudless app verifier
- `src/lib/newsletter-slack-verify.ts` — Newsletter app verifier (dedicated secret)
- `src/lib/slack-rate-limit.ts` — token-bucket per-IP rate limiter
- `src/lib/slack-notify.ts` — `SlackClient` wrapper for `chat.postMessage`

## Pattern 1 — Signature verification (do this first, in every route)

The signing secret lives at the Slack app's **Basic Information** page. Every
incoming request is signed with HMAC-SHA256 over `v0:<ts>:<rawBody>`. The
verifier must read the **raw bytes** — *before* JSON-parsing or querystring
decoding. In Next.js App Router that means `await req.text()` exactly once.

```ts
// src/lib/slack-verify.ts (essentials)
import { createHmac, timingSafeEqual } from "crypto";

const MAX_AGE_SECONDS = 60 * 5; // 5 min, matches Slack's replay window

export async function verifySlackRequest(
  request: Request,
  signingSecret: string
): Promise<{ ok: true; body: string } | { ok: false; reason: string }> {
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");
  if (!timestamp || !signature) return { ok: false, reason: "missing headers" };

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - Number(timestamp)) > MAX_AGE_SECONDS) {
    return { ok: false, reason: "timestamp too old" };
  }

  const body = await request.text();                 // ← raw body, exactly once
  const base = `v0:${timestamp}:${body}`;
  const expected = "v0=" + createHmac("sha256", signingSecret)
    .update(base, "utf8")
    .digest("hex");

  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature mismatch" };
  }
  return { ok: true, body };
}

```

Also keep an in-process **replay set** keyed on the signature with a 5-minute
TTL — stops a leaked signature from being replayed multiple times within the
window. See `src/lib/slack-verify.ts:31-42` for the lazy-evict implementation.

## Pattern 2 — Slash commands route (`/api/<thing>-slack/commands/route.ts`)

```ts
import { verifySlackRequest, unauthorizedSlack } from "@/lib/slack-verify";
import { checkSlackRateLimit } from "@/lib/slack-rate-limit";

interface SlashPayload {
  command: string; text: string; user_id: string; user_name: string;
  channel_id: string; response_url: string; trigger_id: string;
}

export async function POST(request: Request): Promise<Response> {
  const verified = await verifySlackRequest(request);
  if (!verified.ok) return unauthorizedSlack(verified.reason);

  const rateLimitKey = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkSlackRateLimit(rateLimitKey)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const params = new URLSearchParams(verified.body);   // form-encoded
  const payload: SlashPayload = {
    command: params.get("command") ?? "",
    text: params.get("text") ?? "",
    user_id: params.get("user_id") ?? "",
    user_name: params.get("user_name") ?? "",
    channel_id: params.get("channel_id") ?? "",
    response_url: params.get("response_url") ?? "",
    trigger_id: params.get("trigger_id") ?? "",
  };

  switch (payload.command) {
    case "/<thing>-help":   return handleHelp();
    case "/<thing>-action": return handleAction(payload);
    default:                return slackResponse({
      response_type: "ephemeral",
      text: `Unknown command: \`${payload.command}\``,
    });
  }
}

function slackResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

```

Response body shape:
`{ "response_type": "ephemeral" | "in_channel", "text": "...", "blocks": [...] }`.
Default is `ephemeral`. For follow-ups (>3s of work) POST to `response_url`
(valid 30 min, up to 5 sends).

## Pattern 3 — Events route (`/api/<thing>-slack/events/route.ts`)

Two phases: **`url_verification` handshake** during app install, then
**`event_callback`** envelopes for every subscribed event. Always respond 200
within 3s; offload heavy work to background promise.

```ts
export async function POST(request: Request): Promise<Response> {
  const verified = await verifySlackRequest(request);
  if (!verified.ok) return unauthorizedSlack(verified.reason);

  let payload;
  try { payload = JSON.parse(verified.body); }
  catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

  // Setup handshake — Slack POSTs this once when you save the Request URL
  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }

  if (payload.type === "event_callback") {
    if (isDuplicate(payload.event_id)) return Response.json({ ok: true });

    // 200 immediately; defer work — Slack retries up to 3x within ~5min on no-200
    handleEvent(payload.event).catch((err) =>
      console.error("[Slack Events] handler error:", err)
    );
    return Response.json({ ok: true });
  }

  return Response.json({ ok: true });
}

```

The `isDuplicate(event_id)` cache prevents processing the same event twice
when Slack retries on delayed 200s. TTL of 5 minutes matches the retry window.

Key bot events and required scopes:

| Event | Scope | When it fires |
|---|---|---|
| `app_home_opened` | (none — Home tab toggle in manifest) | User opens your Home tab |
| `app_mention` | `app_mentions:read` | `@bot` in a channel the bot is in |
| `message.im` | `im:history` | DM to the bot |
| `message.channels` | `channels:history` | Public channel message |
| `member_joined_channel` | `channels:read` or `groups:read` | Someone joins a channel the bot is in |
| `link_shared` | `links:read` | Unfurling — only for registered domains |

## Pattern 4 — Interactions route (`/api/<thing>-slack/interactions/route.ts`)

**All** interactivity (button clicks, select menus, modals, shortcuts) comes
to **one** Request URL as `application/x-www-form-urlencoded` with a single
`payload` field whose value is JSON. Switch on `payload.type`.

```ts
export async function POST(request: Request): Promise<Response> {
  const verified = await verifySlackRequest(request);
  if (!verified.ok) return unauthorizedSlack(verified.reason);

  const params = new URLSearchParams(verified.body);
  const raw = params.get("payload");
  if (!raw) return Response.json({ error: "missing payload" }, { status: 400 });

  const payload = JSON.parse(raw);

  // block_actions: button or select click
  // view_submission: modal submitted
  // view_closed: modal canceled (only if notify_on_close was true on the view)
  // shortcut / message_action: global / message shortcuts

  if (payload.type === "block_actions") {
    const action = payload.actions?.[0];
    // Defer heavy work; 200 immediately so Slack doesn't render "we had trouble"
    handleAction(payload.user.id, action, payload.response_url).catch(log);
    return Response.json({ ok: true });
  }

  if (payload.type === "view_submission") {
    // Validate; either close (return {}) or return errors / push
    return Response.json({}); // close modal
  }

  return Response.json({ ok: true });
}

```

**Critical timings** to memorise:

- `trigger_id` — **3 seconds, single-use** for the first `views.open`.
- `views.push` from inside a modal generates a *new* `trigger_id` valid ~5s.
- `response_url` — **30 minutes, up to 5 sends**.

## Pattern 5 — `response_url` ephemeral follow-up

After responding 200 to a slash command or button click, you can post up to
**5 follow-up messages** to the `response_url` within 30 min. Use this for
work that takes longer than 3 s.

```ts
async function replyEphemeral(responseUrl: string, text: string): Promise<void> {
  if (!responseUrl) return;
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response_type: "ephemeral", text }),
  }).catch((err) => console.warn("[Slack] response_url POST failed:", err));
}

```

Add `"replace_original": true` (on a button-triggered follow-up) to update the
message the button was attached to; `"delete_original": true` to remove it.

## Pattern 6 — App Home view publish

```ts
// On app_home_opened:
const data = await gatherDashboardData();
const view = { type: "home", blocks: [...] };
const resp = await fetch("https://slack.com/api/views.publish", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${botToken}`,
    "Content-Type": "application/json; charset=utf-8",
  },
  body: JSON.stringify({ user_id: userId, view }),
});
const json = await resp.json();
if (!json.ok) console.warn("[Slack] views.publish failed:", json.error);

```

Block limits: **100 blocks per Home view, 100 per modal, 50 per chat message**.

## Pattern 7 — Where the secrets live

Per-route handler reads from a config getter that tries env → SSM fallback.
Pattern in `src/lib/integrations.ts`:

```ts
export async function getSlackConfigAsync(): Promise<SlackConfig> {
  // env-first
  let token = process.env.SLACK_BOT_TOKEN ?? "";
  let signingSecret = process.env.SLACK_SIGNING_SECRET ?? "";

  // SSM fallback under /cloudless/production/SLACK_*
  if (!signingSecret) {
    const { getConfig } = await import("@/lib/ssm-config");
    const ssm = await getConfig();
    if (!signingSecret) signingSecret = ssm.SLACK_SIGNING_SECRET ?? "";
    if (!token) token = ssm.SLACK_BOT_TOKEN ?? "";
  }
  return { SLACK_BOT_TOKEN: token, SLACK_SIGNING_SECRET: signingSecret, ... };
}

```

For a **second** Slack app (e.g. Newsletter), copy this pattern with a
distinct prefix: `NEWSLETTER_SLACK_*`. Never share a signing secret between
two apps — a leak on one will let an attacker forge requests to the other.
See `src/lib/newsletter-slack-config.ts` for the reference implementation.

## Common-mistakes cheat sheet

1. **Calling `await req.json()` before `verifySlackRequest`.** The verifier
   needs the raw bytes; once you've consumed the stream, it can't.

2. **Doing the work inside the handler.** Slack's 3 s window fires before
   your DB / API call returns. Pattern: `res.status(200).end()` first,
   `void doWork().catch(log)` after.

3. **Not deduping events.** Slack retries up to 3x on no-200. Hash on
   `event.event_id` with a 5-min TTL.

4. **Forgetting that `response_url` ≠ chat.postMessage.** `response_url` is
   ephemeral by default, expires in 30 min, and only allows 5 sends. For
   permanent posts use the Web API.

5. **Verifying with the wrong signing secret.** Each Slack app has its own
   secret — never reuse. Per-app verifier files (`slack-verify.ts`,
   `newsletter-slack-verify.ts`) keep them isolated.

## See also

- `slack-app-builder` — manifest design + scope selection (do this first)
- `slack-app-debugging` — when your endpoint returns 401/500 or Slack times out
- `scripts/slack-app-doctor.sh` — live health probe against a deployed app
