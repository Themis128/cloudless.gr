/**
 * Slack workspace & app identity via Web API.
 *
 * Docs:
 *   https://api.slack.com/methods/auth.test
 *   https://api.slack.com/methods/team.info
 *
 * Required bot token scopes:
 *   (none beyond the token itself for auth.test)
 *   team:read  (team.info)
 *
 * NOTE — Slack app branding (icon, name, description) is set in two places:
 *
 *   1. Per-message  — `username` + `icon_url` params on chat.postMessage.
 *      Already applied globally in slack-notify.ts (BOT_USERNAME / BOT_ICON_URL).
 *
 *   2. App-level    — Upload via api.slack.com/apps → your app → Basic Information
 *      → Display Information.  Cannot be changed via API with a bot token;
 *      requires manual upload or an app-level token with `apps:write`.
 *
 * Use `getBotInfo()` to inspect the current in-workspace identity, and
 * `getWorkspaceInfo()` to read the workspace icon / domain for audit purposes.
 */

import { getSlackConfigAsync } from "@/lib/integrations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BotInfo {
  /** Slack user ID of the bot, e.g. "U08X…" */
  userId: string;
  /** Human-readable name the bot appears under in the workspace */
  botName: string;
  /** Workspace name, e.g. "cloudless" */
  team: string;
  /** Workspace ID, e.g. "T08X…" */
  teamId: string;
  /** API base URL for the workspace */
  url: string;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  domain: string;
  emailDomain: string;
  /** URL of the workspace icon (largest available) */
  iconUrl: string | null;
}

interface AuthTestResponse {
  ok: boolean;
  error?: string;
  url?: string;
  team?: string;
  user?: string;
  team_id?: string;
  user_id?: string;
  bot_id?: string;
}

interface TeamInfoResponse {
  ok: boolean;
  error?: string;
  team?: {
    id: string;
    name: string;
    domain: string;
    email_domain: string;
    icon: {
      image_34?: string;
      image_44?: string;
      image_68?: string;
      image_88?: string;
      image_102?: string;
      image_132?: string;
      image_230?: string;
      image_default?: boolean;
    };
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const BASE = "https://slack.com/api";

async function slackGet(
  method: string,
  params: Record<string, string>,
  token: string
): Promise<Response> {
  const qs = new URLSearchParams(params).toString();
  return fetch(`${BASE}/${method}${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Verify the bot token and return the bot's in-workspace identity.
 * No additional scopes required beyond the token itself.
 *
 * Docs: https://api.slack.com/methods/auth.test
 */
export async function getBotInfo(token?: string): Promise<BotInfo> {
  const resolvedToken = token ?? (await getSlackConfigAsync()).SLACK_BOT_TOKEN;
  if (!resolvedToken) throw new Error("[SlackWorkspace] SLACK_BOT_TOKEN is not configured");

  const res = await fetch(`${BASE}/auth.test`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resolvedToken}`,
      "Content-Type": "application/json",
    },
  });
  const data = (await res.json()) as AuthTestResponse;
  if (!data.ok) throw new Error(`[SlackWorkspace] auth.test: ${data.error}`);

  return {
    userId: data.user_id ?? "",
    botName: data.user ?? "",
    team: data.team ?? "",
    teamId: data.team_id ?? "",
    url: data.url ?? "",
  };
}

/**
 * Return workspace metadata including name, domain, and icon URL.
 * Requires team:read scope.
 *
 * Docs: https://api.slack.com/methods/team.info
 */
export async function getWorkspaceInfo(token?: string): Promise<WorkspaceInfo> {
  const resolvedToken = token ?? (await getSlackConfigAsync()).SLACK_BOT_TOKEN;
  if (!resolvedToken) throw new Error("[SlackWorkspace] SLACK_BOT_TOKEN is not configured");

  const res = await slackGet("team.info", {}, resolvedToken);
  const data = (await res.json()) as TeamInfoResponse;
  if (!data.ok || !data.team) throw new Error(`[SlackWorkspace] team.info: ${data.error}`);

  const icon = data.team.icon;
  const iconUrl = icon.image_230 ?? icon.image_132 ?? icon.image_102 ?? icon.image_88 ?? null;

  return {
    id: data.team.id,
    name: data.team.name,
    domain: data.team.domain,
    emailDomain: data.team.email_domain,
    iconUrl: icon.image_default ? null : iconUrl,
  };
}

/**
 * Combined audit: returns bot identity and workspace info in one call.
 * Useful for the /slack-workspace-info skill.
 */
export async function getSlackBrandingAudit(token?: string): Promise<{
  bot: BotInfo;
  workspace: WorkspaceInfo;
  perMessageBranding: { username: string; iconUrl: string };
  appLevelBrandingUrl: string;
}> {
  const resolvedToken = token ?? (await getSlackConfigAsync()).SLACK_BOT_TOKEN;

  const [bot, workspace] = await Promise.all([
    getBotInfo(resolvedToken),
    getWorkspaceInfo(resolvedToken),
  ]);

  return {
    bot,
    workspace,
    perMessageBranding: {
      username: "Cloudless",
      iconUrl: "https://cloudless.gr/icons/icon-512.png",
    },
    appLevelBrandingUrl: "https://api.slack.com/apps",
  };
}
