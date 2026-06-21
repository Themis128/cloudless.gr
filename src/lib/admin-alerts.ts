/**
 * admin-alerts — unified fan-out for operator-facing alerts.
 *
 * Today's options:
 *   - Slack (always on, primary): uses `SlackClient` + `getSlackOpsUsers()`
 *     per `feedback_slack_use_slackclient` + `feedback_slack_lambda_env_frozen`.
 *   - ntfy (opt-in, secondary): push-notification fan-out to the operator's
 *     phone via `src/lib/ntfy.ts`. Enabled by env `ADMIN_PUSH_VIA_NTFY=1`.
 *
 * R4 of the 2026-06-21 R-series. Operator wanted phone push for SEV1 alerts
 * even when the laptop is closed; ntfy delivers that without rebuilding the
 * existing Slack flow. Both channels fire in parallel via `Promise.allSettled`
 * so one failing doesn't drop the other.
 *
 * Call site:
 *   await notifyAdmin({
 *     severity: "high",
 *     title:    "espocrm down",
 *     message:  "5xx from /api/v1/App/user for 3min",
 *     click:    "https://espocrm.cloudless.gr",
 *   });
 *
 * Existing `slackContactNotify` etc. keep working unchanged — this helper
 * is purely additive for the new "alerts that should bypass Slack noise
 * filters" lane.
 */
import { SlackClient } from "@/lib/slack-notify";
import { getSlackOpsUsers } from "@/lib/slack-ops-users";
import { publishNtfy } from "@/lib/ntfy";

export type AdminAlertSeverity = "info" | "warning" | "error" | "high" | "critical";

export interface AdminAlertInput {
  severity: AdminAlertSeverity;
  /** Short headline — both Slack title + ntfy notification title. */
  title: string;
  /** Longer body. Plain text; markdown is rendered as-is by Slack and as
   *  plain text by ntfy (ntfy markdown requires a header opt-in we skip). */
  message: string;
  /** Optional click-through URL — shown as a tappable link in ntfy and
   *  appended to the Slack body as `<url|open>`. */
  click?: string;
  /** Optional override of the ntfy topic. Defaults to NTFY_TOPIC SSM key. */
  topic?: string;
}

export interface AdminAlertResult {
  slack: { ok: boolean; error?: string };
  ntfy: { ok: boolean; skipped?: string; error?: string };
}

const SEVERITY_EMOJI: Record<AdminAlertSeverity, string> = {
  info: ":information_source:",
  warning: ":warning:",
  error: ":x:",
  high: ":rotating_light:",
  critical: ":fire:",
};

const SEVERITY_PRIORITY: Record<AdminAlertSeverity, 1 | 2 | 3 | 4 | 5> = {
  info: 2,
  warning: 3,
  error: 4,
  high: 5,
  critical: 5,
};

const SEVERITY_TAGS: Record<AdminAlertSeverity, string[]> = {
  info: ["information_source"],
  warning: ["warning"],
  error: ["x"],
  high: ["rotating_light"],
  critical: ["fire"],
};

/**
 * Fan out an admin alert to Slack (always) + ntfy (when
 * `ADMIN_PUSH_VIA_NTFY=1`). Never throws — surfaces success/failure per
 * channel so callers can log + decide.
 *
 * The Slack send DM's each operator from `getSlackOpsUsers()` (which reads
 * SSM, not env — per `feedback_slack_lambda_env_frozen`). For a one-shot
 * channel post instead use `SlackClient.postToChannel`.
 */
export async function notifyAdmin(input: AdminAlertInput): Promise<AdminAlertResult> {
  const result: AdminAlertResult = {
    slack: { ok: false },
    ntfy: { ok: false },
  };

  const slackText = `${SEVERITY_EMOJI[input.severity]} *${input.title}*\n${input.message}${
    input.click ? `\n<${input.click}|open>` : ""
  }`;

  // Slack: DM each ops user. allSettled so one failed DM doesn't block ntfy.
  const slackTask = (async () => {
    try {
      const opsUsers = await getSlackOpsUsers();
      if (opsUsers.length === 0) {
        result.slack = { ok: false, error: "no ops users configured" };
        return;
      }
      // One client per ops user — `channel` is set in the constructor and
      // chat.postMessage accepts a user ID as `channel` to deliver a DM.
      const sends = await Promise.allSettled(
        opsUsers.map((u) => new SlackClient({ channel: u }).post({ text: slackText }))
      );
      const okCount = sends.filter((s) => s.status === "fulfilled").length;
      result.slack = {
        ok: okCount > 0,
        error: okCount === 0 ? "all DMs failed" : undefined,
      };
    } catch (err) {
      result.slack = { ok: false, error: (err as Error).message };
    }
  })();

  // ntfy: gated by env flag — off by default until operator opts in.
  const ntfyTask = (async () => {
    if (process.env.ADMIN_PUSH_VIA_NTFY !== "1") {
      result.ntfy = { ok: false, skipped: "feature_off" };
      return;
    }
    const r = await publishNtfy({
      title: input.title,
      message: input.message,
      priority: SEVERITY_PRIORITY[input.severity],
      tags: SEVERITY_TAGS[input.severity],
      click: input.click,
      topic: input.topic,
    });
    result.ntfy = r;
  })();

  await Promise.allSettled([slackTask, ntfyTask]);
  return result;
}
