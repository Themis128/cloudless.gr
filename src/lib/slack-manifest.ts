/**
 * Slack App Manifest management via Web API.
 *
 * Reads the versioned manifest from slack-app.manifest.json and can apply
 * it to the live Slack app via the manifests API.
 *
 * Docs:
 *   https://api.slack.com/methods/apps.manifest.validate
 *   https://api.slack.com/methods/apps.manifest.update
 *   https://api.slack.com/reference/manifests
 *
 * Token requirements:
 *   - validate: app-level token (xapp-…) with authorizations:read
 *     OR a user OAuth token with apps:write
 *   - update:   user OAuth token with apps:write
 *
 * NOTE: A bot token (xoxb-…) cannot update the app manifest.
 * Obtain an app-level token at api.slack.com/apps → your app →
 * Basic Information → App-Level Tokens → Generate Token.
 */

import { readFileSync } from "fs";
import { join } from "path";

const BASE = "https://slack.com/api";
const MANIFEST_PATH = join(process.cwd(), "slack-app.manifest.json");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ManifestApiResponse {
  ok: boolean;
  error?: string;
  errors?: Array<{ message: string; pointer: string }>;
  app_id?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadManifest(): Record<string, unknown> {
  const raw = readFileSync(MANIFEST_PATH, "utf8");
  // Strip the _comment / _docs / _apply meta-fields before sending to Slack
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  delete parsed["_comment"];
  delete parsed["_docs"];
  delete parsed["_apply"];
  return parsed;
}

async function slackPost(
  method: string,
  body: Record<string, unknown>,
  token: string,
): Promise<ManifestApiResponse> {
  const res = await fetch(`${BASE}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body), // codeql[js/file-data-network-request] -- manifest JSON is sent intentionally to Slack API; loaded from a versioned local config file, not user input
  });
  if (!res.ok)
    throw new Error(`[SlackManifest] HTTP ${res.status} on ${method}`);
  return res.json() as Promise<ManifestApiResponse>;
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Validate the local manifest against the Slack API without applying it.
 * Returns a list of validation errors (empty = valid).
 *
 * Requires an app-level token (xapp-…) or user token with apps:write.
 * Docs: https://api.slack.com/methods/apps.manifest.validate
 */
export async function validateManifest(
  token: string,
): Promise<{ valid: boolean; errors: string[] }> {
  const manifest = loadManifest();
  const res = await slackPost(
    "apps.manifest.validate",
    { manifest: JSON.stringify(manifest) },
    token,
  );

  if (res.ok) return { valid: true, errors: [] };

  const errors = res.errors?.map((e) => `${e.pointer}: ${e.message}`) ?? [
    res.error ?? "Unknown validation error",
  ];
  return { valid: false, errors };
}

/**
 * Apply the local manifest to the live Slack app.
 * Overwrites all app configuration: slash commands, scopes, event
 * subscriptions, interactivity settings, and display information.
 *
 * Requires a user OAuth token with apps:write scope.
 * Docs: https://api.slack.com/methods/apps.manifest.update
 *
 * @param appId   The Slack App ID (e.g. "A08XXXXXXX"), found in Basic Information.
 * @param token   User OAuth token with apps:write scope.
 */
export async function applyManifest(
  appId: string,
  token: string,
): Promise<{ ok: boolean; appId: string }> {
  const manifest = loadManifest();
  const res = await slackPost(
    "apps.manifest.update",
    { app_id: appId, manifest: JSON.stringify(manifest) },
    token,
  );

  if (!res.ok)
    throw new Error(`[SlackManifest] apps.manifest.update: ${res.error}`);

  return { ok: true, appId: res.app_id ?? appId };
}

/**
 * Return the local manifest object (strip meta-fields).
 * Useful for diffing or displaying current desired state.
 */
export function readLocalManifest(): Record<string, unknown> {
  return loadManifest();
}
