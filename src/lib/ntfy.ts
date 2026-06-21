/**
 * ntfy — self-hosted push notification broker. Used by the cluster's
 * `alert-api` Pi-side Lambda and by any cloudless.gr Lambda that wants to
 * fan out a one-off notification to the operator's phone (Slack alternative
 * for things that should bypass Slack's per-channel noise filters).
 *
 * Config (SSM or env):
 *   NTFY_BASE_URL   default: http://ntfy.monitoring.svc.cluster.local (in-cluster),
 *                   set to https://ntfy.cloudless.gr if tunnel-exposed.
 *   NTFY_TOPIC      default: cloudless-ops (operator-created topic).
 *   NTFY_TOKEN      optional Bearer token; ntfy supports anonymous publish
 *                   when ACL allows. When unset we skip the Authorization header.
 *
 * All exports degrade gracefully when unconfigured — `publish` returns
 * `{ ok: false, skipped: "ntfy_unconfigured" }` and never throws so callers
 * (alert paths) don't crash on a misconfigured deploy.
 */
import { getConfig } from "@/lib/ssm-config";

export interface NtfyPublishInput {
  /** Message body. */
  message: string;
  /** Override topic for this single publish. Defaults to NTFY_TOPIC. */
  topic?: string;
  /** Bold title rendered above the body. */
  title?: string;
  /** One of: min, low, default, high, max (1-5). */
  priority?: 1 | 2 | 3 | 4 | 5;
  /** Comma-separated emoji tags. */
  tags?: string[];
  /** Optional click-through URL. */
  click?: string;
}

export interface NtfyPublishResult {
  ok: boolean;
  /** Set when the call was intentionally skipped (no creds, missing topic). */
  skipped?: "ntfy_unconfigured" | "no_topic";
  error?: string;
}

export async function isNtfyConfigured(): Promise<boolean> {
  const cfg = await getConfig();
  return Boolean(cfg.NTFY_BASE_URL && cfg.NTFY_TOPIC);
}

export async function publishNtfy(input: NtfyPublishInput): Promise<NtfyPublishResult> {
  const cfg = await getConfig();
  const baseUrl = (cfg.NTFY_BASE_URL || "").replace(/\/$/, "");
  const topic = input.topic || cfg.NTFY_TOPIC;
  if (!baseUrl) return { ok: false, skipped: "ntfy_unconfigured" };
  if (!topic) return { ok: false, skipped: "no_topic" };

  const headers: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
  };
  if (cfg.NTFY_TOKEN) headers.Authorization = `Bearer ${cfg.NTFY_TOKEN}`;
  if (input.title) headers.Title = input.title;
  if (input.priority) headers.Priority = String(input.priority);
  if (input.tags?.length) headers.Tags = input.tags.join(",");
  if (input.click) headers.Click = input.click;

  try {
    const res = await fetch(`${baseUrl}/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers,
      body: input.message,
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
