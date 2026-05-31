#!/usr/bin/env tsx
/**
 * keycloak-apply — idempotently assert the Keycloak config the cloudless.gr app
 * depends on, so the app-side auth model (see skills/keycloak-app-auth.skill)
 * is correctly applied:
 *
 *   1. realm `admin` group exists
 *   2. `cloudless-app` client is a public PKCE-S256 client
 *   3. its redirectUris include the next-auth callback(s)
 *   4. a group-membership protocol mapper ("groups") exists on the client
 *      (without it the `groups` claim is absent and every admin check 403s)
 *
 * Read-only validation lives in `tools/keycloak-cli/keycloak.sh doctor`; this
 * script is the *fixer*. It is idempotent — re-running makes no changes once
 * everything matches.
 *
 * Usage:
 *   pnpm keycloak:apply --dry-run     # show drift, change nothing
 *   pnpm keycloak:apply               # apply the config
 *
 * Auth (admin token via resource-owner password grant on admin-cli):
 *   KEYCLOAK_ADMIN_USER, KEYCLOAK_ADMIN_PASSWORD   (required)
 *   KEYCLOAK_ISSUER   default https://auth.cloudless.gr/realms/master
 *   APP_CLIENT_ID     default cloudless-app
 *   APP_CALLBACKS     comma-separated; default the prod + localhost callbacks
 *
 * On Lambda/Pi these admin creds come from SSM; locally export them first, e.g.
 *   export KEYCLOAK_ADMIN_PASSWORD=$(aws ssm get-parameter \
 *     --name /cloudless/production/KEYCLOAK_ADMIN_PASSWORD --with-decryption \
 *     --query Parameter.Value --output text)
 */

const ISSUER = (process.env.KEYCLOAK_ISSUER ?? "https://auth.cloudless.gr/realms/master").replace(
  /\/+$/,
  "",
);
const REALM = ISSUER.split("/realms/")[1] ?? "master";
const BASE = ISSUER.replace(`/realms/${REALM}`, "");
const ADMIN_API = `${BASE}/admin/realms/${REALM}`;
const APP_CLIENT_ID = process.env.APP_CLIENT_ID ?? "cloudless-app";
const CALLBACKS = (
  process.env.APP_CALLBACKS ??
  "https://cloudless.gr/api/auth/callback/keycloak,https://www.cloudless.gr/api/auth/callback/keycloak,http://localhost:4000/api/auth/callback/keycloak"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const DRY = process.argv.includes("--dry-run");

let changes = 0;
const log = (mark: string, msg: string) => console.log(`  ${mark} ${msg}`);
const ok = (m: string) => log("=", m);
const did = (m: string) => {
  log(DRY ? "[dry-run] would" : "✓", m);
  changes++;
};

async function getAdminToken(): Promise<string> {
  const user = process.env.KEYCLOAK_ADMIN_USER;
  const pass = process.env.KEYCLOAK_ADMIN_PASSWORD;
  if (!user || !pass) {
    throw new Error("KEYCLOAK_ADMIN_USER and KEYCLOAK_ADMIN_PASSWORD must be set");
  }
  const res = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "admin-cli",
      username: user,
      password: pass,
    }).toString(),
  });
  if (!res.ok) throw new Error(`admin token failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

function kc(token: string, path: string, init?: RequestInit) {
  return fetch(`${ADMIN_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

async function ensureAdminGroup(token: string): Promise<void> {
  const res = await kc(token, "/groups?search=admin");
  const groups = (await res.json()) as Array<{ id: string; name: string }>;
  if (groups.some((g) => g.name === "admin")) {
    ok("admin group exists");
    return;
  }
  if (!DRY) {
    const c = await kc(token, "/groups", { method: "POST", body: JSON.stringify({ name: "admin" }) });
    if (!c.ok && c.status !== 409) throw new Error(`create admin group: ${c.status}`);
  }
  did("create admin group");
}

interface KcClient {
  id: string;
  clientId: string;
  publicClient?: boolean;
  redirectUris?: string[];
  attributes?: Record<string, string>;
}

async function getClient(token: string): Promise<KcClient> {
  const res = await kc(token, `/clients?clientId=${encodeURIComponent(APP_CLIENT_ID)}`);
  const arr = (await res.json()) as KcClient[];
  if (!arr.length) throw new Error(`client '${APP_CLIENT_ID}' not found — create it in Keycloak first`);
  return arr[0];
}

async function ensureClientConfig(token: string, client: KcClient): Promise<void> {
  const attrs = { ...(client.attributes ?? {}) };
  const uris = new Set(client.redirectUris ?? []);
  const patch: Partial<KcClient> = {};
  let dirty = false;

  if (client.publicClient !== true) {
    patch.publicClient = true;
    dirty = true;
    did(`set ${APP_CLIENT_ID} publicClient=true`);
  } else ok(`${APP_CLIENT_ID} is public`);

  if (attrs["pkce.code.challenge.method"] !== "S256") {
    attrs["pkce.code.challenge.method"] = "S256";
    patch.attributes = attrs;
    dirty = true;
    did("set PKCE method=S256");
  } else ok("PKCE method=S256");

  const missing = CALLBACKS.filter((u) => !uris.has(u));
  if (missing.length) {
    missing.forEach((u) => uris.add(u));
    patch.redirectUris = [...uris];
    dirty = true;
    did(`add redirectUris: ${missing.join(", ")}`);
  } else ok("redirectUris already include all app callbacks");

  if (dirty && !DRY) {
    const res = await kc(token, `/clients/${client.id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`update client: ${res.status}`);
  }
}

async function ensureGroupsMapper(token: string, client: KcClient): Promise<void> {
  const res = await kc(token, `/clients/${client.id}/protocol-mappers/models`);
  const mappers = (await res.json()) as Array<{ name: string; protocolMapper: string }>;
  const exists = mappers.some(
    (m) => m.name === "groups" || m.protocolMapper === "oidc-group-membership-mapper",
  );
  if (exists) {
    ok("group-membership mapper present");
    return;
  }
  if (!DRY) {
    const c = await kc(token, `/clients/${client.id}/protocol-mappers/models`, {
      method: "POST",
      body: JSON.stringify({
        name: "groups",
        protocol: "openid-connect",
        protocolMapper: "oidc-group-membership-mapper",
        config: {
          "full.path": "false",
          "id.token.claim": "true",
          "access.token.claim": "true",
          "userinfo.token.claim": "true",
          "claim.name": "groups",
        },
      }),
    });
    if (!c.ok && c.status !== 409) throw new Error(`create groups mapper: ${c.status}`);
  }
  did("create group-membership mapper (claim: groups)");
}

async function main() {
  console.log(`Asserting Keycloak app config — realm "${REALM}", client "${APP_CLIENT_ID}"${DRY ? " (dry-run)" : ""}`);
  const token = await getAdminToken();
  await ensureAdminGroup(token);
  const client = await getClient(token);
  await ensureClientConfig(token, client);
  await ensureGroupsMapper(token, client);

  console.log();
  if (DRY) {
    console.log(changes === 0 ? "In sync — no changes needed." : `${changes} change(s) would be applied. Re-run without --dry-run.`);
  } else {
    console.log(changes === 0 ? "In sync — nothing to do." : `Applied ${changes} change(s).`);
    console.log("Verify with: pnpm keycloak:doctor");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
