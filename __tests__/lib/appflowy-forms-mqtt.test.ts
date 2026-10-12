/**
 * Tests for src/lib/appflowy-forms.ts and src/lib/mqtt.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const appflowy = vi.hoisted(() => ({
  listAllWorkspaces: vi.fn(),
  listAllViewsDeep: vi.fn(),
  getDocument: vi.fn(),
  extractDocText: vi.fn(),
  isAppFlowyConfigured: vi.fn(),
  getWorkspaceFolder: vi.fn(),
  createPage: vi.fn(),
  appendBlockToPage: vi.fn(),
}));
vi.mock("@/lib/appflowy", () => appflowy);

const cfg = vi.hoisted(() => ({ values: {} as Record<string, string> }));
vi.mock("@/lib/ssm-config", () => ({
  getConfig: vi.fn(async () => cfg.values),
}));

// Fake mqtt client — captures event handlers so tests can drive them.
const mqttFake = vi.hoisted(() => ({
  clients: [] as Array<{
    handlers: Record<string, ((...a: unknown[]) => void)[]>;
    subscribe: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    emit(ev: string, ...args: unknown[]): void;
  }>,
  failImport: false,
}));
vi.mock("mqtt", async () => {
  if (mqttFake.failImport) throw new Error("not installed");
  return {
    connect: vi.fn(() => {
      const c = {
        handlers: {} as Record<string, ((...a: unknown[]) => void)[]>,
        on(ev: string, cb: (...a: unknown[]) => void) {
          (c.handlers[ev] ??= []).push(cb);
          return c;
        },
        subscribe: vi.fn((_t: string, _o: unknown, cb?: (e?: Error) => void) =>
          cb?.()
        ),
        publish: vi.fn(
          (_t: string, _m: string, _o: unknown, cb?: (e?: Error) => void) =>
            cb?.()
        ),
        end: vi.fn(),
        emit(ev: string, ...args: unknown[]) {
          for (const cb of c.handlers[ev] ?? []) cb(...args);
        },
      };
      mqttFake.clients.push(c);
      return c;
    }),
  };
});

import {
  saveSubmission,
  listSubmissions,
  updateSubmissionStatus,
} from "@/lib/appflowy-forms";
import {
  isMqttConfigured,
  readLatestAlertStatus,
  publishAlertStatus,
  resetMqttCache,
} from "@/lib/mqtt";

describe("appflowy-forms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appflowy.isAppFlowyConfigured.mockResolvedValue(true);
    appflowy.listAllWorkspaces.mockResolvedValue([{ workspace_id: "ws1" }]);
    appflowy.getWorkspaceFolder.mockResolvedValue({
      view_id: "root",
      children: [{ name: "General", view_id: "general-v" }],
    });
    appflowy.createPage.mockResolvedValue({ view_id: "page-1" });
    appflowy.appendBlockToPage.mockResolvedValue(true);
  });

  it("returns null when unconfigured", async () => {
    appflowy.isAppFlowyConfigured.mockResolvedValue(false);
    expect(await saveSubmission({ name: "n", email: "e@x", message: "m" })).toBeNull();
    expect(await listSubmissions()).toEqual([]);
    expect(await updateSubmissionStatus("p", "Done")).toBe(false);
  });

  it("returns null without workspace/email/parent view", async () => {
    appflowy.listAllWorkspaces.mockResolvedValue([]);
    expect(await saveSubmission({ name: "n", email: "e@x", message: "m" })).toBeNull();

    appflowy.listAllWorkspaces.mockResolvedValue([{ workspace_id: "ws1" }]);
    expect(await saveSubmission({ name: "n", email: "  ", message: "m" })).toBeNull();

    appflowy.getWorkspaceFolder.mockResolvedValue(null);
    expect(await saveSubmission({ name: "n", email: "e@x", message: "m" })).toBeNull();
  });

  it("returns null when workspace listing throws", async () => {
    appflowy.listAllWorkspaces.mockRejectedValue(new Error("down"));
    expect(await saveSubmission({ name: "n", email: "e@x", message: "m" })).toBeNull();
    expect(await listSubmissions()).toEqual([]);
  });

  it("prefers the General child view, falls back to first child then root", async () => {
    await saveSubmission({ name: "n", email: "e@x", message: "m" });
    expect(appflowy.createPage).toHaveBeenCalledWith(
      "ws1",
      expect.objectContaining({ parent_view_id: "general-v" })
    );

    appflowy.getWorkspaceFolder.mockResolvedValue({
      view_id: "root",
      children: [{ name: "Other", view_id: "other-v" }],
    });
    await saveSubmission({ name: "n", email: "e@x", message: "m" });
    expect(appflowy.createPage).toHaveBeenLastCalledWith(
      "ws1",
      expect.objectContaining({ parent_view_id: "other-v" })
    );

    appflowy.getWorkspaceFolder.mockResolvedValue({ view_id: "root", children: [] });
    await saveSubmission({ name: "n", email: "e@x", message: "m" });
    expect(appflowy.createPage).toHaveBeenLastCalledWith(
      "ws1",
      expect.objectContaining({ parent_view_id: "root" })
    );
  });

  it("returns null when createPage has no view_id or append fails", async () => {
    appflowy.createPage.mockResolvedValue({});
    expect(await saveSubmission({ name: "n", email: "e@x", message: "m" })).toBeNull();

    appflowy.createPage.mockResolvedValue({ view_id: "p1" });
    appflowy.appendBlockToPage.mockResolvedValue(false);
    expect(await saveSubmission({ name: "n", email: "e@x", message: "m" })).toBeNull();
  });

  it("creates the page with all optional fields as blocks", async () => {
    const id = await saveSubmission({
      name: "N",
      email: "e@x",
      phone: "123",
      company: "C",
      service: "S",
      message: "hello",
      source: "subscribe",
    });
    expect(id).toBe("page-1");
    const blocks = appflowy.appendBlockToPage.mock.calls[0][2] as Array<{
      data: { delta: { insert: string }[] };
    }>;
    const text = blocks.map((b) => b.data.delta[0].insert).join("\n");
    expect(text).toContain("**Phone**: 123");
    expect(text).toContain("**Company**: C");
    expect(text).toContain("**Service**: S");
    expect(text).toContain("**Source**: subscribe");
  });

  it("lists, parses and sorts submissions; skips bad docs", async () => {
    appflowy.listAllViewsDeep.mockResolvedValue([
      { view_id: "v1", name: "[Contact] A", last_edited_time: "2026-01-02" },
      { view_id: "v2", name: "[Subscribe] B", last_edited_time: "2026-01-01" },
      { view_id: "v3", name: "not a submission", last_edited_time: "" },
      { view_id: "v4", name: "[Contact] bad", last_edited_time: "" },
    ]);
    appflowy.getDocument.mockImplementation(async (_w: string, id: string) => {
      if (id === "v4") throw new Error("doc gone");
      return { id };
    });
    appflowy.extractDocText.mockImplementation(async (doc: { id: string }) =>
      doc.id === "v1"
        ? "**Name**: Alice\n**Email**: a@x\n**Date**: 2026-01-05\n**Status**: Done\n**Message**: hi"
        : "**Email**: b@x\nnot-a-field line\n**Source**: subscribe"
    );

    const out = await listSubmissions();
    expect(out).toHaveLength(2);
    // v2 has no **Date** field → parseContactFields defaults to now() so it
    // sorts ahead of v1's 2026-01-05.
    expect(out[0].id).toBe("v2");
    expect(out[0].source).toBe("subscribe");
    expect(out[0].status).toBe("New");
    expect(out[1].id).toBe("v1");
    expect(out[1].name).toBe("Alice");
    expect(out[1].status).toBe("Done");
    expect(out[1].submittedAt).toBe("2026-01-05");
  });

  it("honors the limit and returns [] on outer failure", async () => {
    appflowy.listAllViewsDeep.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        view_id: `v${i}`,
        name: "[Contact] x",
        last_edited_time: "",
      }))
    );
    appflowy.getDocument.mockResolvedValue({});
    appflowy.extractDocText.mockResolvedValue("");
    expect(await listSubmissions(2)).toHaveLength(2);

    appflowy.listAllViewsDeep.mockRejectedValue(new Error("list\nfail"));
    expect(await listSubmissions()).toEqual([]);
  });
});


async function clientAt(i: number) {
  await vi.waitFor(() => {
    if (mqttFake.clients.length <= i) throw new Error("no client yet");
  });
  return mqttFake.clients[i];
}

describe("mqtt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mqttFake.clients.length = 0;
    mqttFake.failImport = false;
    cfg.values = {
      MQTT_USERNAME: "u",
      MQTT_PASSWORD: "p",
      MQTT_BROKER_HOST: "broker.local",
      MQTT_BROKER_PORT: "31883",
    };
    resetMqttCache();
  });

  it("reports configured only with both credentials", async () => {
    expect(await isMqttConfigured()).toBe(true);
    cfg.values = { MQTT_USERNAME: "u" };
    resetMqttCache();
    expect(await isMqttConfigured()).toBe(false);
  });

  it("caches config until reset", async () => {
    const { getConfig } = await import("@/lib/ssm-config");
    await isMqttConfigured();
    await isMqttConfigured();
    expect(getConfig).toHaveBeenCalledTimes(1);
    resetMqttCache();
    await isMqttConfigured();
    expect(getConfig).toHaveBeenCalledTimes(2);
  });

  it("readLatestAlertStatus returns null unconfigured", async () => {
    cfg.values = {};
    resetMqttCache();
    expect(await readLatestAlertStatus()).toBeNull();
  });

  it("reads the retained message and disconnects", async () => {
    const p = readLatestAlertStatus();
    const c = await clientAt(0);
    c.emit("connect");
    expect(c.subscribe).toHaveBeenCalledWith(
      "homelab/alerts/status",
      { qos: 1 },
      expect.any(Function)
    );
    c.emit("message", "other/topic", Buffer.from("{}"));
    c.emit(
      "message",
      "homelab/alerts/status",
      Buffer.from('{"severity":"ok","count":0}')
    );
    expect(await p).toEqual({ severity: "ok", count: 0 });
    expect(c.end).toHaveBeenCalled();
  });

  it("returns null on bad JSON / client error / subscribe error", async () => {
    const p1 = readLatestAlertStatus();
    const c1 = await clientAt(0);
    c1.emit("connect");
    c1.emit("message", "homelab/alerts/status", Buffer.from("{bad"));
    expect(await p1).toBeNull();

    const p2 = readLatestAlertStatus();
    (await clientAt(1)).emit("error", new Error("conn refused"));
    expect(await p2).toBeNull();

    const p3 = readLatestAlertStatus();
    const c3 = await clientAt(2);
    c3.subscribe.mockImplementation(
      (_t: string, _o: unknown, cb?: (e?: Error) => void) =>
        cb?.(new Error("sub fail"))
    );
    c3.emit("connect");
    expect(await p3).toBeNull();
  });

  it("returns null on timeout", async () => {
    const p = readLatestAlertStatus(20);
    // never emit anything
    expect(await p).toBeNull();
  });

  it("uses defaults for host/port when unset", async () => {
    cfg.values = { MQTT_USERNAME: "u", MQTT_PASSWORD: "p" };
    resetMqttCache();
    const p = readLatestAlertStatus();
    await clientAt(0);
    const { connect } = await import("mqtt");
    expect(connect).toHaveBeenCalledWith(
      "mqtt://mosquitto.monitoring.svc.cluster.local:1883",
      expect.objectContaining({ username: "u" })
    );
    mqttFake.clients[0].emit("error", new Error("x"));
    await p;
  });

  it("publishes with retain on the status topic, ts default", async () => {
    const p = publishAlertStatus({ severity: "warning", count: 2 });
    const c = await clientAt(0);
    c.emit("connect");
    expect(c.publish).toHaveBeenCalledWith(
      "homelab/alerts/status",
      expect.stringContaining('"severity":"warning"'),
      { qos: 1, retain: true },
      expect.any(Function)
    );
    const body = JSON.parse(c.publish.mock.calls[0][1] as string);
    expect(body.ts).toBeTypeOf("number");
    expect(await p).toEqual({ ok: true });
  });

  it("publish: custom topic not retained, errors surface", async () => {
    const p1 = publishAlertStatus(
      { severity: "info", count: 1, ts: 7 },
      { topic: "homelab/alerts/event" }
    );
    const c1 = await clientAt(0);
    c1.emit("connect");
    expect(c1.publish.mock.calls[0][2]).toEqual({ qos: 1, retain: false });
    const body1 = JSON.parse(c1.publish.mock.calls[0][1] as string);
    expect(body1.ts).toBe(7);
    expect(await p1).toEqual({ ok: true });

    const p2 = publishAlertStatus({ severity: "ok", count: 0 });
    const c2 = await clientAt(1);
    c2.publish.mockImplementation(
      (_t: string, _m: string, _o: unknown, cb?: (e?: Error) => void) =>
        cb?.(new Error("pub fail"))
    );
    c2.emit("connect");
    expect(await p2).toEqual({ ok: false, error: "pub fail" });

    const p3 = publishAlertStatus({ severity: "ok", count: 0 });
    (await clientAt(2)).emit("error", new Error("boom"));
    expect(await p3).toEqual({ ok: false, error: "boom" });

    const p4 = publishAlertStatus({ severity: "ok", count: 0 }, { timeoutMs: 20 });
    expect(await p4).toEqual({ ok: false, error: "timeout" });
  });

  it("publish returns error when unconfigured", async () => {
    cfg.values = {};
    resetMqttCache();
    const res = await publishAlertStatus({ severity: "ok", count: 0 });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("not configured");
  });
});
