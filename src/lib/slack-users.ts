/**
 * Slack user management via Web API.
 *
 * Docs:
 *   https://api.slack.com/methods/users.lookupByEmail
 *   https://api.slack.com/methods/users.list
 *   https://api.slack.com/methods/users.info
 *
 * Required bot token scopes:
 *   users:read           (users.list, users.info)
 *   users:read.email     (users.lookupByEmail)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  is_bot: boolean;
  is_app_user: boolean;
  deleted: boolean;
  profile: {
    display_name: string;
    real_name: string;
    email?: string;
    image_192?: string;
    image_512?: string;
  };
}

interface UserApiResponse {
  ok: boolean;
  error?: string;
  user?: SlackUser;
  members?: SlackUser[];
  response_metadata?: { next_cursor?: string };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const BASE = "https://slack.com/api";

async function slackGet(
  method: string,
  params: Record<string, string>,
  token: string,
): Promise<UserApiResponse> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/${method}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`[SlackUsers] HTTP ${res.status} on ${method}`);
  return res.json() as Promise<UserApiResponse>;
}

// users.lookupByEmail requires form-encoded POST, not JSON
async function slackFormPost(
  method: string,
  body: Record<string, string>,
  token: string,
): Promise<UserApiResponse> {
  const res = await fetch(`${BASE}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${token}`,
    },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new Error(`[SlackUsers] HTTP ${res.status} on ${method}`);
  return res.json() as Promise<UserApiResponse>;
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Look up a workspace member by email address.
 * Requires users:read.email scope.
 * Returns null if no user is found (instead of throwing).
 *
 * Docs: https://api.slack.com/methods/users.lookupByEmail
 */
export async function lookupUserByEmail(
  email: string,
  token: string,
): Promise<SlackUser | null> {
  const res = await slackFormPost("users.lookupByEmail", { email }, token);
  if (!res.ok) {
    if (res.error === "users_not_found") return null;
    throw new Error(`[SlackUsers] users.lookupByEmail: ${res.error}`);
  }
  return res.user ?? null;
}

/**
 * Fetch full profile for a single user by Slack user ID.
 * Requires users:read scope.
 *
 * Docs: https://api.slack.com/methods/users.info
 */
export async function getUserInfo(
  userId: string,
  token: string,
): Promise<SlackUser> {
  const res = await slackGet("users.info", { user: userId }, token);
  if (!res.ok || !res.user)
    throw new Error(`[SlackUsers] users.info: ${res.error}`);
  return res.user;
}

/**
 * List all non-deleted workspace members. Handles cursor pagination.
 * Requires users:read scope.
 *
 * Docs: https://api.slack.com/methods/users.list
 */
export async function listUsers(token: string): Promise<SlackUser[]> {
  const all: SlackUser[] = [];
  let cursor = "";

  do {
    const res = await slackGet(
      "users.list",
      { limit: "200", ...(cursor ? { cursor } : {}) },
      token,
    );
    if (!res.ok) throw new Error(`[SlackUsers] users.list: ${res.error}`);
    all.push(...(res.members ?? []).filter((u) => !u.deleted));
    cursor = res.response_metadata?.next_cursor ?? "";
  } while (cursor);

  return all;
}

/**
 * Convenience: resolve an email to a Slack user ID.
 * Returns null if the user is not found or the email scope is missing.
 */
export async function resolveEmailToUserId(
  email: string,
  token: string,
): Promise<string | null> {
  const user = await lookupUserByEmail(email, token);
  return user?.id ?? null;
}
