/**
 * Tests for POST /api/internal/ai/generate, POST /api/webhooks/espocrm and
 * POST /api/webhooks/mqtt/publish.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const cfg = vi.hoisted(() => ({ values: {} as Record<string, string> }));
vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn(async () => cfg.values),
}));

const espoHook = vi.hoisted(() => ({
  verifyEspoWebhookSecret: vi.fn(),
  parseEspoEvent: vi.fn(),
}));
vi.mock("@/lib/espocrm-webhook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/espocrm-webhook")>();
  return {
    ...actual,
    verifyEspoWebhookSecret: espoHook.verifyEspoWebhookSecret,
    parseEspoEvent: espoHook.parseEspoEvent,
  };
});

const dispatch = vi.hoisted(() => ({ dispatchEspoEvent: vi.fn() }));
vi.mock("@/lib/espocrm-dispatch", () => dispatch);

const queue = vi.hoisted(() => ({
  isEspoQueueConfigured: vi.fn(),
  enqueueEspoWebhook: vi.fn(),
}));
vi.mock("@/lib/espocrm-queue", () => queue);

const mqttLib = vi.hoisted(() => ({
  isMqttConfigured: vi.fn(),
  publishAlertStatus: vi.fn(),
}));
vi.mock("@/lib/mqtt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mqtt")>();
  return {
    ...actual,
    isMqttConfigured: mqttLib.isMqttConfigured,
    publishAlertStatus: mqttLib.publishAlertStatus,
  };
});

const alerts = vi.hoisted(() => ({ notifyAdmin: vi.fn() }));
vi.mock("@/lib/admin-alerts", () => alerts);

import { POST as aiGenerate } from "@/app/api/internal/ai/generate/route";
import { POST as espoWebhook } from "@/app/api/webhooks/espocrm/route";
import { POST as mqttPublish } from "@/app/api/webhooks/mqtt/publish/route";

const AI = "http://localhost/api/internal/ai/generate";
const ESPO = "http://localhost/api/webhooks/espocrm";
const MQTT = "http://localhost/api/webhooks/mqtt/publish";

describe("POST /api/internal/ai/generate", () => {
  const post = (body: unknown, secret = "internal-secret") =>
    aiGenerate(
      new NextRequest(AI, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(secret ? { "x-internal-secret": secret } : {}),
        },
        body: typeof body === "string" ? body : JSON.stringify(body),
      })
    );

  const cfOk = (text = "generated") =>
    ({
      ok: true,
      json: async () => ({ result: { response: text } }),
    }) as Response;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    cfg.values = { AI_GENERATE_SECRET: "internal-secret" };
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acc");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn(async () => cfOk()));
  });

  const msgs = { messages: [{ role: "user", content: "hi" }] };

  it("503s without secret, 401s on bad/missing/short secret", async () => {
    cfg.values = {};
    expect((await post(msgs)).status).toBe(503);
    cfg.values = { AI_GENERATE_SECRET: "internal-secret" };
    expect((await post(msgs, "")).status).toBe(401);
    expect((await post(msgs, "short")).status).toBe(401);
    expect((await post(msgs, "internal-secretX")).status).toBe(401);
  });

  it("validates body: JSON, messages, user turn, model allowlist", async () => {
    expect((await post("{bad")).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect(
      (await post({ messages: [{ role: "user", content: "  " }] })).status
    ).toBe(400);
    expect(
      (await post({ ...msgs, model: "https://evil.com/x" })).status
    ).toBe(400);
    expect((await post({ ...msgs, model: "@cf/a/../b" })).status).toBe(400);
  });

  it("503s without CF env", async () => {
    vi.unstubAllEnvs();
    expect((await post(msgs)).status).toBe(503);
  });

  it("calls CF with system+messages, clamps maxTokens", async () => {
    const j = await (
      await post({
        system: "sys",
        messages: [{ role: "user", content: "hi" }],
        maxTokens: 99999,
      })
    ).json();
    expect(j.source).toBe("cloudflare");
    expect(j.model).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    const body = JSON.parse(
      (vi.mocked(fetch).mock.calls[0][1] as { body: string }).body
    );
    expect(body.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(body.max_tokens).toBe(8192);
  });

  it("retries the fallback model on CF failure, then 502s", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ errors: [{ message: "boom" }] }),
      } as Response)
      .mockResolvedValueOnce(cfOk("fallback text"));
    const j = await (await post(msgs)).json();
    expect(j.model).toBe("@cf/meta/llama-3.1-8b-instruct-fast");
    expect(j.result).toBe("fallback text");

    // both fail → 502
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);
    const res = await post(msgs);
    expect(res.status).toBe(502);
    expect((await res.json()).detail).toContain("status 500");
  });

  it("does not retry when the caller already asked for the fallback model", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);
    const res = await post({ ...msgs, model: "@cf/meta/llama-3.1-8b-instruct-fast" });
    expect(res.status).toBe(502);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("serializes non-string responses; empty → fallback", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { response: { structured: true } } }),
    } as Response);
    const j = await (await post(msgs)).json();
    expect(j.result).toBe('{"structured":true}');

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: { response: "" } }),
      } as Response)
      .mockResolvedValueOnce(cfOk("second"));
    const j2 = await (await post(msgs)).json();
    expect(j2.result).toBe("second");
  });
});

describe("POST /api/webhooks/espocrm", () => {
  const hook = (body: unknown, suffix = "") =>
    espoWebhook(
      new NextRequest(`${ESPO}${suffix}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      })
    );

  beforeEach(() => {
    vi.clearAllMocks();
    espoHook.verifyEspoWebhookSecret.mockResolvedValue(true);
    espoHook.parseEspoEvent.mockImplementation((ev?: string) =>
      ev ? ev.split(".") : [null, null]
    );
    dispatch.dispatchEspoEvent.mockResolvedValue(undefined);
    queue.isEspoQueueConfigured.mockReturnValue(false);
    queue.enqueueEspoWebhook.mockResolvedValue(undefined);
  });

  it("401s on bad secret, 400s on invalid JSON", async () => {
    espoHook.verifyEspoWebhookSecret.mockResolvedValue(false);
    expect((await hook({})).status).toBe(401);

    espoHook.verifyEspoWebhookSecret.mockResolvedValue(true);
    expect((await hook("{bad")).status).toBe(400);
  });

  it("ACKs verification payloads without dispatching", async () => {
    for (const body of [
      { verification: true },
      { data: { verification: true } },
    ]) {
      const j = await (await hook(body)).json();
      expect(j).toEqual({ ok: true, verification: true });
    }
    expect(dispatch.dispatchEspoEvent).not.toHaveBeenCalled();
  });

  it("202s with no records", async () => {
    const res = await hook({ event: "Contact.create" });
    expect(res.status).toBe(202);
    expect((await res.json()).skipped).toBe("no_records");
  });

  it("202s when the event can't be parsed or inferred", async () => {
    const res = await hook({ data: { id: "1" } });
    expect(res.status).toBe(202);
    expect((await res.json()).skipped).toBe("no_event");
  });

  it("infers the event from ?event= and dispatches", async () => {
    const j = await (
      await hook({ data: { id: "1" } }, "?event=Contact.create")
    ).json();
    expect(j).toEqual({ ok: true, dispatched: 1 });
    expect(dispatch.dispatchEspoEvent).toHaveBeenCalledWith(
      "Contact",
      "create",
      [{ id: "1" }]
    );
  });

  it("dispatches list records for parsed events", async () => {
    const j = await (
      await hook({ event: "Lead.create", list: [{ id: "1" }, { id: "2" }] })
    ).json();
    expect(j.dispatched).toBe(2);
    expect(dispatch.dispatchEspoEvent).toHaveBeenCalledWith(
      "Lead",
      "create",
      [{ id: "1" }, { id: "2" }]
    );
  });

  it("enqueues when the queue is configured; falls back on enqueue failure", async () => {
    queue.isEspoQueueConfigured.mockReturnValue(true);
    await hook({ event: "Contact.create", data: { id: "1" } });
    expect(queue.enqueueEspoWebhook).toHaveBeenCalledWith({
      entity: "Contact",
      action: "create",
      records: [{ id: "1" }],
    });
    expect(dispatch.dispatchEspoEvent).not.toHaveBeenCalled();

    queue.enqueueEspoWebhook.mockRejectedValue(new Error("queue down"));
    await hook({ event: "Contact.create", data: { id: "1" } });
    expect(dispatch.dispatchEspoEvent).toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/mqtt/publish", () => {
  const pub = (body: unknown, secret = "shared-secret") =>
    mqttPublish(
      new NextRequest(MQTT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(secret ? { "x-mqtt-publish-secret": secret } : {}),
        },
        body: typeof body === "string" ? body : JSON.stringify(body),
      })
    );

  beforeEach(() => {
    vi.clearAllMocks();
    cfg.values = { NOTION_WEBHOOK_SECRET: "shared-secret" };
    mqttLib.isMqttConfigured.mockResolvedValue(true);
    mqttLib.publishAlertStatus.mockResolvedValue({ ok: true });
    alerts.notifyAdmin.mockResolvedValue({ delivered: true });
  });

  it("401s on bad/missing/mismatched secret", async () => {
    expect((await pub({}, "nope")).status).toBe(401);
    expect((await pub({}, "")).status).toBe(401);
    cfg.values.NOTION_WEBHOOK_SECRET = "";
    expect((await pub({})).status).toBe(401);
  });

  it("503s when MQTT is not configured", async () => {
    cfg.values.NOTION_WEBHOOK_SECRET = "shared-secret";
    mqttLib.isMqttConfigured.mockResolvedValue(false);
    expect((await pub({ topic: "t" })).status).toBe(503);
  });

  it("400s on invalid JSON / missing topic", async () => {
    expect((await pub("{bad")).status).toBe(400);
    expect((await pub({})).status).toBe(400);
    expect((await pub({ topic: 5 })).status).toBe(400);
  });

  it("publishes and returns ok; 502 on broker failure", async () => {
    const j = await (
      await pub({ topic: "homelab/x", payload: { a: 1 }, retain: false })
    ).json();
    expect(j).toEqual({ ok: true, topic: "homelab/x" });
    expect(mqttLib.publishAlertStatus).toHaveBeenCalledWith(
      { a: 1 },
      { topic: "homelab/x", retain: false }
    );

    mqttLib.publishAlertStatus.mockResolvedValue({
      ok: false,
      error: "broker down",
    });
    const res = await pub({ topic: "t" });
    expect(res.status).toBe(502);
    expect((await res.json()).detail).toBe("broker down");
  });

  it("fans out to notifyAdmin for high/critical on the status topic only", async () => {
    await pub({
      topic: "homelab/alerts/status",
      payload: { severity: "critical", src: "alert-api" },
    });
    await new Promise((r) => setImmediate(r));
    expect(alerts.notifyAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "critical" })
    );

    alerts.notifyAdmin.mockClear();
    await pub({
      topic: "homelab/alerts/status",
      payload: { severity: "warning" },
    });
    await pub({ topic: "other/topic", payload: { severity: "high" } });
    await pub({ topic: "homelab/alerts/status" });
    await new Promise((r) => setImmediate(r));
    expect(alerts.notifyAdmin).not.toHaveBeenCalled();
  });
});
