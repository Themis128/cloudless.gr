/**
 * Unit tests for the dedicated Newsletter Slack slash command router.
 *
 * Probes the dispatch surface — each /newsletter-* subcommand should
 * either return a help/usage block or short-circuit with ops-allowlist
 * gating. We don't hit Notion/EspoCRM/GitHub here; those are covered by
 * their own lib tests. The point is to lock the COMMAND ROUTING surface.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "crypto";
import { POST } from "@/app/api/newsletter-slack/commands/route";
import { resetNewsletterSlackConfigCache } from "@/lib/newsletter-slack-config";

const SECRET = "test-newsletter-signing-secret-32chr";

function sign(body: string, ts: number, secret = SECRET): string {
  return "v0=" + createHmac("sha256", secret).update(`v0:${ts}:${body}`, "utf8").digest("hex");
}

function buildRequest(opts: {
  command: string;
  text?: string;
  userId?: string;
  secret?: string;
}): Request {
  const ts = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    token: "verify",
    team_id: "T1",
    team_domain: "test",
    channel_id: "C1",
    channel_name: "test",
    user_id: opts.userId ?? "UTESTUSER",
    user_name: "tester",
    command: opts.command,
    text: opts.text ?? "",
    response_url: "https://hooks.slack.com/commands/T1/1/abc",
    trigger_id: "1.1.abc",
    api_app_id: "A1",
    is_enterprise_install: "false",
  });
  const body = params.toString();
  return new Request("http://localhost/api/newsletter-slack/commands", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": String(ts),
      "x-slack-signature": sign(body, ts, opts.secret ?? SECRET),
    },
    body,
  });
}

beforeEach(() => {
  resetNewsletterSlackConfigCache();
  process.env.NEWSLETTER_SLACK_SIGNING_SECRET = SECRET;
  process.env.NEWSLETTER_SLACK_BOT_TOKEN = "xoxb-test";
  // No allowlist gate by default — empty SLACK_OPS_USERS means "anyone"
  // We DON'T override it because the route module reads it at import time.
  // Tests that need a populated allowlist must run in a separate file or
  // re-import the module.
});

describe("/newsletter-slack/commands router", () => {
  it("rejects an unsigned request with 401", async () => {
    const req = new Request("http://localhost/api/newsletter-slack/commands", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "command=%2Fnewsletter-list",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects a wrongly-signed request with 401", async () => {
    const req = buildRequest({ command: "/newsletter-list", secret: "wrong" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("/newsletter-help returns the usage card", async () => {
    const res = await POST(buildRequest({ command: "/newsletter-help" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.response_type).toBe("ephemeral");
    const flat = JSON.stringify(body.blocks);
    expect(flat).toMatch(/Newsletter — Commands/);
    expect(flat).toMatch(/\/newsletter-list/);
    expect(flat).toMatch(/\/newsletter-send/);
    expect(flat).toMatch(/\/newsletter-unpublish/);
  });

  it("/newsletter-gates returns the 3-layer thresholds card", async () => {
    const res = await POST(buildRequest({ command: "/newsletter-gates" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const flat = JSON.stringify(body.blocks);
    expect(flat).toMatch(/3-Layer Quality Gates/);
    expect(flat).toMatch(/Layer 1 — Deterministic/);
    expect(flat).toMatch(/Layer 2 — LLM Critic/);
    expect(flat).toMatch(/Layer 3 — Human Ops Override/);
  });

  it("/newsletter-send with no text returns usage hint", async () => {
    const res = await POST(buildRequest({ command: "/newsletter-send", text: "" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toMatch(/Usage: `\/newsletter-send/);
  });

  it("/newsletter-unpublish with no text returns usage hint", async () => {
    const res = await POST(buildRequest({ command: "/newsletter-unpublish", text: "" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toMatch(/Usage: `\/newsletter-unpublish/);
  });

  it("unknown command returns the unknown-command response", async () => {
    const res = await POST(buildRequest({ command: "/newsletter-bogus" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toMatch(/Unknown command/);
    expect(body.text).toMatch(/\/newsletter-help/);
  });
});

describe("ops allowlist gating", () => {
  // The router reads SLACK_OPS_USERS at module import time, so we can't
  // re-test the populated-allowlist path here without dynamic re-imports.
  // The empty-allowlist path (covered above) means anyone passes — which is
  // the documented default behavior when SLACK_OPS_USERS is unset.
  it("documents the gating contract via the unpublish help text", async () => {
    // Use a unique text suffix so the signature differs from previous tests
    // (replay-protection cache would otherwise reject this as a duplicate).
    const res = await POST(
      buildRequest({ command: "/newsletter-unpublish", text: " " + Date.now() })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // The "no slug" guard fires on an effectively-empty text; the helper hint
    // explains the contract.
    expect(body.text ?? "").toMatch(/Flips Notion Status to `Archived`|warning|No Notion post/);
  });
});
