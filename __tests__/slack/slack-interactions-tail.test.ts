/**
 * slack/interactions tail — 400s, rate limits, async dispatch .catch
 * handlers (fire when response_url fetch rejects), view submissions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockVerify = vi.fn();
vi.mock("@/lib/slack-verify", () => ({
  verifySlackRequest: (...args: unknown[]) => mockVerify(...args),
  unauthorizedSlack: vi.fn((_reason: string) =>
    Response.json({ error: "Unauthorized" }, { status: 401 })
  ),
}));

function verifyOk(formBody: string) {
  mockVerify.mockResolvedValue({ ok: true, body: formBody });
}

function makeRequest(formBody: string, ip = "9.9.9.9"): Request {
  return new Request("http://localhost/api/slack/interactions", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": String(Math.floor(Date.now() / 1000)),
      "x-slack-signature": "v0=test",
      "x-forwarded-for": ip,
    },
    body: formBody,
  });
}

const formFor = (payload: object) =>
  new URLSearchParams({ payload: JSON.stringify(payload) }).toString();

const user = { id: `U${Math.random().toString(36).slice(2, 8)}`, username: "u" };
const blockAction = (action_id: string, extra: Record<string, unknown> = {}) => ({
  type: "block_actions",
  user,
  response_url: "https://hooks.slack.com/actions/x",
  message: { blocks: [{ type: "section" }] },
  actions: [{ action_id, type: "button", value: "v1", ...extra }],
});

const origFetch = globalThis.fetch;

describe("slack/interactions tail", () => {
  let POST: (req: Request) => Promise<Response>;
  beforeEach(async () => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn(async () => {
      throw new Error("net down");
    });
    const mod = await import("@/app/api/slack/interactions/route");
    POST = mod.POST;
  });
  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it("400 when the payload field is missing", async () => {
    verifyOk("other=1");
    const res = await POST(makeRequest("other=1"));
    expect(res.status).toBe(400);
  });

  it("400 on invalid payload JSON", async () => {
    const body = new URLSearchParams({ payload: "{not json" }).toString();
    verifyOk(body);
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
  });

  it("dispatch .catch handlers absorb fetch failures", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const action of [
      "linkedin_ads_pause",
      "socialauto_retry_queue",
      "slack_ack",
      "refresh_orders",
    ]) {
      const payload = blockAction(action);
      verifyOk(formFor(payload));
      const res = await POST(makeRequest(formFor(payload), `9.9.${Date.now() % 200}.${Math.random() * 200 | 0}`));
      expect(res.status).toBe(200);
    }
    await vi.waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 3000 });
    spy.mockRestore();
  });

  it("view_submission modals dispatch without throwing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const callback_id of ["create-ticket-modal", "deploy-confirm-modal", "other-modal"]) {
      const payload = {
        type: "view_submission",
        user,
        view: {
          callback_id,
          private_metadata: "{}",
          state: { values: {} },
        },
      };
      verifyOk(formFor(payload));
      const res = await POST(makeRequest(formFor(payload), `9.8.${Date.now() % 200}.${Math.random() * 200 | 0}`));
      expect(res.status).toBe(200);
    }
    await vi.waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 3000 });
    spy.mockRestore();
  });

  it("429s the IP after 60 requests in the window", async () => {
    verifyOk("payload=");
    let last = 0;
    for (let i = 0; i < 65; i++) {
      const res = await POST(makeRequest("other=1", "7.7.7.7"));
      last = res.status;
      if (last === 429) break;
    }
    expect(last).toBe(429);
  });

  it("429s a single noisy user across distinct IPs", async () => {
    const fixedUser = { id: "Unoisy1", username: "n" };
    const payload = {
      type: "block_actions",
      user: fixedUser,
      actions: [{ action_id: "slack_ack", type: "button" }],
    };
    const body = formFor(payload);
    let last = 0;
    for (let i = 0; i < 65; i++) {
      verifyOk(body);
      const res = await POST(makeRequest(body, `6.6.${i % 200}.${(i * 7) % 250}`));
      last = res.status;
      if (last === 429) break;
    }
    expect(last).toBe(429);
  });

  it("dispatches a RERUN_ACTIONS workflow and warns on unknown action ids", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // rerun action — catch fires when the dispatch fetch rejects
    const rerun = blockAction("rerun_weekly_draft");
    verifyOk(formFor(rerun));
    const r1 = await POST(makeRequest(formFor(rerun), `5.5.${Date.now() % 200}.1`));
    expect(r1.status).toBe(200);
    await vi.waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 3000 });

    // unknown action → warn log, still a 200 ack
    const unknown = blockAction("totally_unknown_button");
    verifyOk(formFor(unknown));
    const r2 = await POST(makeRequest(formFor(unknown), `5.5.${Date.now() % 200}.2`));
    expect(r2.status).toBe(200);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Unhandled action_id: totally_unknown_button")
    );
    spy.mockRestore();
    warn.mockRestore();
  });
});
