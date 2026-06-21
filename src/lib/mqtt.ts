/**
 * MQTT client wrapper — server-side subscriber for the cluster Mosquitto
 * broker (`monitoring/mosquitto`, public NodePort `31883`, auth-only since
 * 2026-06-21 Phase 3 cutover; see `skills/mqtt-auth-rollout/SKILL.md`).
 *
 * Used by the live `/admin/cluster` status chip to subscribe to the
 * retained `homelab/alerts/status` topic and surface a red / amber / green
 * pill without a polling loop. The Pi `alert-api` Lambda publishes to that
 * topic via `infrastructure/pi-alert-api/mqtt_publish.py` whenever an alert
 * fires or resolves — so this lib is the read counterpart of that publisher,
 * and uses the same SSM credentials.
 *
 * Config (SSM or env):
 *   MQTT_BROKER_HOST  default: mosquitto.monitoring.svc.cluster.local (in-cluster)
 *                     LAN/Cowork default: omv.local
 *   MQTT_BROKER_PORT  default: 1883 (ClusterIP) / 31883 (NodePort)
 *   MQTT_USERNAME     required since 2026-06-21 Phase 3 (allow_anonymous=false)
 *   MQTT_PASSWORD     required
 *
 * Both halves of the app reuse this module:
 *   - Next.js admin route /api/admin/cluster/mqtt-status
 *   - Future Lambda subscribers (e.g. SES bounce → MQTT publish) can
 *     `import { publish } from "@/lib/mqtt"` from the same code path.
 */

import { getConfig } from "@/lib/ssm-config";

export class MqttNotConfiguredError extends Error {
  constructor() {
    super("MQTT broker not configured (MQTT_USERNAME or MQTT_PASSWORD missing)");
    this.name = "MqttNotConfiguredError";
  }
}

/** Cached promise of the resolved broker config — keeps a single SSM call
 *  per warm Lambda invocation (per `feedback_slack_lambda_env_frozen`). */
let mqttConfigPromise: Promise<MqttConfig> | null = null;

interface MqttConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

async function getMqttConfig(): Promise<MqttConfig> {
  if (mqttConfigPromise) return mqttConfigPromise;
  mqttConfigPromise = (async () => {
    const cfg = await getConfig();
    const username = cfg.MQTT_USERNAME;
    const password = cfg.MQTT_PASSWORD;
    if (!username || !password) throw new MqttNotConfiguredError();
    return {
      host: cfg.MQTT_BROKER_HOST || "mosquitto.monitoring.svc.cluster.local",
      port: Number.parseInt(cfg.MQTT_BROKER_PORT || "1883", 10),
      username,
      password,
    };
  })();
  return mqttConfigPromise;
}

/** Force a re-read of MQTT_* from SSM (call after rotation). */
export function resetMqttCache(): void {
  mqttConfigPromise = null;
}

/** Public probe — `true` when SSM has both username + password. */
export async function isMqttConfigured(): Promise<boolean> {
  try {
    await getMqttConfig();
    return true;
  } catch {
    return false;
  }
}

/** Schema of payloads published by alert-api to `homelab/alerts/status`. */
export interface AlertStatusPayload {
  severity: "ok" | "info" | "warning" | "error" | "high" | "critical";
  count: number;
  /** Unix epoch seconds. */
  ts?: number;
  timestamp?: number;
  /** Free-form source tag — `manual-seed`, `alert-api`, etc. */
  src?: string;
}

/**
 * Read the retained `homelab/alerts/status` message ONCE and return it.
 * Implementation note: we use a short-lived `mqtt.connect()` + waiting for
 * the first message on the retained topic, then disconnect. This keeps the
 * Next.js route handler stateless (no long-lived connection across requests
 * — which would leak in serverless contexts) and matches the pattern the
 * alert-api Lambda uses to publish.
 *
 * Timeout default 3 s: the broker delivers the retained payload immediately
 * on subscribe, so anything longer than that means the broker is unreachable
 * or no retained message has ever been set.
 *
 * Returns `null` on:
 *   - MqttNotConfiguredError (caller should show a "—" chip)
 *   - Connection / timeout failure (network down, broker down)
 *   - No retained message on the topic (initial state)
 *
 * Never throws.
 */
export async function readLatestAlertStatus(timeoutMs = 3000): Promise<AlertStatusPayload | null> {
  let cfg: MqttConfig;
  try {
    cfg = await getMqttConfig();
  } catch {
    return null;
  }

  // Lazy import — `mqtt` is a 600 KB+ dep we don't want to pull into routes
  // that never call this fn. dynamic import → tree-shakable.
  let mqttLib: typeof import("mqtt");
  try {
    mqttLib = await import("mqtt");
  } catch {
    // Lib not installed yet (CI runs before `pnpm install` of new dep).
    return null;
  }

  return new Promise<AlertStatusPayload | null>((resolve) => {
    let done = false;
    const finish = (val: AlertStatusPayload | null) => {
      if (done) return;
      done = true;
      try {
        client.end(true);
      } catch {
        /* noop */
      }
      resolve(val);
    };

    const client = mqttLib.connect(`mqtt://${cfg.host}:${cfg.port}`, {
      username: cfg.username,
      password: cfg.password,
      connectTimeout: timeoutMs,
      reconnectPeriod: 0, // single-shot read; we end() after the first message
      clientId: `cloudless-app-status-reader-${Date.now()}`,
    });

    const overall = setTimeout(() => finish(null), timeoutMs);

    client.on("connect", () => {
      client.subscribe("homelab/alerts/status", { qos: 1 }, (err) => {
        if (err) finish(null);
      });
    });

    client.on("message", (topic, message) => {
      if (topic !== "homelab/alerts/status") return;
      clearTimeout(overall);
      try {
        const parsed = JSON.parse(message.toString()) as AlertStatusPayload;
        finish(parsed);
      } catch {
        finish(null);
      }
    });

    client.on("error", () => finish(null));
  });
}

/**
 * Fire-and-forget publish — used by future Lambda subscribers + admin
 * "test alert" UI. Matches the schema the alert-api uses so consumers
 * (Display ESP32 LED, future dashboards) don't need to special-case
 * different writers.
 *
 * Resolves once the broker has ACK'd the publish (QoS 1) OR `timeoutMs`
 * elapses. `ok: false` on any failure — never throws.
 */
export async function publishAlertStatus(
  payload: AlertStatusPayload,
  options: { topic?: string; retain?: boolean; timeoutMs?: number } = {}
): Promise<{ ok: boolean; error?: string }> {
  const topic = options.topic ?? "homelab/alerts/status";
  const retain = options.retain ?? topic === "homelab/alerts/status"; // status is retained, events aren't
  const timeoutMs = options.timeoutMs ?? 3000;

  let cfg: MqttConfig;
  try {
    cfg = await getMqttConfig();
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  let mqttLib: typeof import("mqtt");
  try {
    mqttLib = await import("mqtt");
  } catch (err) {
    return { ok: false, error: `mqtt lib not installed: ${(err as Error).message}` };
  }

  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    let done = false;
    const finish = (result: { ok: boolean; error?: string }) => {
      if (done) return;
      done = true;
      try {
        client.end(true);
      } catch {
        /* noop */
      }
      resolve(result);
    };

    const client = mqttLib.connect(`mqtt://${cfg.host}:${cfg.port}`, {
      username: cfg.username,
      password: cfg.password,
      connectTimeout: timeoutMs,
      reconnectPeriod: 0,
      clientId: `cloudless-app-publisher-${Date.now()}`,
    });

    const overall = setTimeout(() => finish({ ok: false, error: "timeout" }), timeoutMs);

    client.on("connect", () => {
      client.publish(
        topic,
        JSON.stringify({ ...payload, ts: payload.ts ?? Math.floor(Date.now() / 1000) }),
        { qos: 1, retain },
        (err) => {
          clearTimeout(overall);
          finish(err ? { ok: false, error: err.message } : { ok: true });
        }
      );
    });

    client.on("error", (err) => finish({ ok: false, error: err.message }));
  });
}
