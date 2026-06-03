import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getConfig } from "@/lib/ssm-config";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminListGroupsForUserCommand,
  AdminEnableUserCommand,
  AdminDisableUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";

// ---------------------------------------------------------------------------
// Shared user shape (compatible with both Cognito and Keycloak)
// ---------------------------------------------------------------------------

interface AdminUser {
  username: string;
  email: string;
  name: string;
  company: string;
  phone: string;
  status: "active" | "disabled";
  emailVerified: boolean;
  userStatus: string;
  role: "admin" | "user";
  created?: string;
  lastModified?: string;
}

// ---------------------------------------------------------------------------
// Cognito helpers
// ---------------------------------------------------------------------------

function getUserPoolId(issuer: string): string {
  // issuer format: https://cognito-idp.{region}.amazonaws.com/{userPoolId}
  return issuer.split("/").at(-1) ?? "";
}

function cognitoClient(issuer: string): CognitoIdentityProviderClient {
  const region = issuer.match(/cognito-idp\.([^.]+)\.amazonaws\.com/)?.[1] ?? "us-east-1";
  return new CognitoIdentityProviderClient({ region });
}

function cognitoAttr(attrs: Array<{ Name?: string; Value?: string }>, name: string): string {
  return attrs.find((a) => a.Name === name)?.Value ?? "";
}

async function listCognitoUsers(
  issuer: string,
  limit: number,
  filter?: string
): Promise<AdminUser[]> {
  const client = cognitoClient(issuer);
  const userPoolId = getUserPoolId(issuer);

  const cmd = new ListUsersCommand({
    UserPoolId: userPoolId,
    Limit: limit,
    ...(filter ? { Filter: `email ^= "${filter}"` } : {}),
  });
  const res = await client.send(cmd);
  const rawUsers = res.Users ?? [];

  return Promise.all(
    rawUsers.map(async (u) => {
      const attrs = u.Attributes ?? [];
      let isAdmin = false;
      try {
        const grRes = await client.send(
          new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: u.Username ?? "" })
        );
        isAdmin = (grRes.Groups ?? []).some((g) => g.GroupName === "admin");
      } catch {
        /* default non-admin */
      }

      return {
        username: u.Username ?? "",
        email: cognitoAttr(attrs, "email"),
        name:
          [cognitoAttr(attrs, "given_name"), cognitoAttr(attrs, "family_name")]
            .filter(Boolean)
            .join(" ") || cognitoAttr(attrs, "name"),
        company: cognitoAttr(attrs, "custom:company"),
        phone: cognitoAttr(attrs, "phone_number"),
        emailVerified: cognitoAttr(attrs, "email_verified") === "true",
        status: u.Enabled ? "active" : "disabled",
        userStatus: u.UserStatus ?? "UNKNOWN",
        role: isAdmin ? "admin" : "user",
        created: u.UserCreateDate?.toISOString(),
        lastModified: u.UserLastModifiedDate?.toISOString(),
      } satisfies AdminUser;
    })
  );
}

async function mutateCognitoUser(
  issuer: string,
  username: string,
  action: string
): Promise<{ success: boolean; message: string }> {
  const client = cognitoClient(issuer);
  const userPoolId = getUserPoolId(issuer);

  switch (action) {
    case "disable":
      await client.send(
        new AdminDisableUserCommand({ UserPoolId: userPoolId, Username: username })
      );
      return { success: true, message: "User disabled" };
    case "enable":
      await client.send(new AdminEnableUserCommand({ UserPoolId: userPoolId, Username: username }));
      return { success: true, message: "User enabled" };
    case "promote":
      await client.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: userPoolId,
          Username: username,
          GroupName: "admin",
        })
      );
      return { success: true, message: "User promoted to admin" };
    case "demote":
      await client.send(
        new AdminRemoveUserFromGroupCommand({
          UserPoolId: userPoolId,
          Username: username,
          GroupName: "admin",
        })
      );
      return { success: true, message: "User removed from admin group" };
    default:
      // 400 (client error), consistent with the Keycloak path's unknown-action.
      throw Object.assign(new Error(`Unknown action: ${action}`), { status: 400 });
  }
}

// ---------------------------------------------------------------------------
// Keycloak helpers (legacy fallback)
// ---------------------------------------------------------------------------

const KC_BASE = process.env.KEYCLOAK_ISSUER ?? process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ?? "";
const KC_REALM = KC_BASE ? (KC_BASE.split("/realms/")[1] ?? "master") : "master";
const KC_ADMIN = KC_BASE ? KC_BASE.replace(`/realms/${KC_REALM}`, "") : "";
const ADMIN_URL = `${KC_ADMIN}/admin/realms/${KC_REALM}`;

async function getKeycloakAdminToken(): Promise<string> {
  const cfg = await getConfig().catch(() => null);
  const clientId =
    cfg?.KEYCLOAK_ADMIN_CLIENT_ID || process.env.KEYCLOAK_ADMIN_CLIENT_ID || "admin-cli";
  const clientSecret =
    cfg?.KEYCLOAK_ADMIN_CLIENT_SECRET || process.env.KEYCLOAK_ADMIN_CLIENT_SECRET || "";
  const adminUser = cfg?.KEYCLOAK_ADMIN_USER || process.env.KEYCLOAK_ADMIN_USER || "";
  const adminPass = cfg?.KEYCLOAK_ADMIN_PASSWORD || process.env.KEYCLOAK_ADMIN_PASSWORD || "";

  const body = clientSecret
    ? new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      })
    : new URLSearchParams({
        grant_type: "password",
        client_id: clientId,
        username: adminUser,
        password: adminPass,
      });

  const res = await globalThis.fetch(`${KC_BASE}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Keycloak admin token failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

function kcFetch(path: string, token: string, init?: RequestInit) {
  return globalThis.fetch(`${ADMIN_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
    signal: AbortSignal.timeout(10_000),
  });
}

async function listKeycloakUsers(limit: number, filter?: string): Promise<AdminUser[]> {
  const token = await getKeycloakAdminToken();
  const qs = new URLSearchParams({ max: String(limit) });
  if (filter) qs.set("search", filter);
  const res = await kcFetch(`/users?${qs}`, token);
  if (!res.ok) throw new Error(`Keycloak list users: ${res.status}`);

  interface KcUser {
    id: string;
    username: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    emailVerified?: boolean;
    enabled?: boolean;
    createdTimestamp?: number;
    attributes?: Record<string, string[]>;
  }
  const kcUsers = (await res.json()) as KcUser[];

  return Promise.all(
    kcUsers.map(async (u) => {
      let isAdmin = false;
      try {
        const gr = await kcFetch(`/users/${u.id}/groups`, token);
        if (gr.ok) {
          const groups = (await gr.json()) as Array<{ name: string }>;
          isAdmin = groups.some((g) => g.name === "admin");
        }
      } catch {
        /* default non-admin */
      }

      const attrs = u.attributes ?? {};
      return {
        username: u.id,
        email: u.email ?? "",
        name: [u.firstName, u.lastName].filter(Boolean).join(" "),
        company: attrs["company"]?.[0] ?? "",
        phone: attrs["phone"]?.[0] ?? "",
        emailVerified: u.emailVerified ?? false,
        status: u.enabled ? "active" : "disabled",
        userStatus: u.enabled ? "CONFIRMED" : "DISABLED",
        role: isAdmin ? "admin" : "user",
        created: u.createdTimestamp ? new Date(u.createdTimestamp).toISOString() : undefined,
      } satisfies AdminUser;
    })
  );
}

async function mutateKeycloakUser(
  userId: string,
  action: string
): Promise<{ success: boolean; message: string }> {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(userId)) throw Object.assign(new Error("Invalid user id"), { status: 400 });

  const token = await getKeycloakAdminToken();

  if (action === "disable") {
    await kcFetch(`/users/${userId}`, token, {
      method: "PUT",
      body: JSON.stringify({ enabled: false }),
    });
    return { success: true, message: "User disabled" };
  }
  if (action === "enable") {
    await kcFetch(`/users/${userId}`, token, {
      method: "PUT",
      body: JSON.stringify({ enabled: true }),
    });
    return { success: true, message: "User enabled" };
  }
  const grRes = await kcFetch(`/groups?search=admin`, token);
  if (!grRes.ok) throw new Error("Could not fetch groups");
  const groups = (await grRes.json()) as Array<{ id: string; name: string }>;
  const adminGroup = groups.find((g) => g.name === "admin");
  if (!adminGroup) throw new Error("admin group not found");

  if (action === "promote") {
    await kcFetch(`/users/${userId}/groups/${adminGroup.id}`, token, { method: "PUT" });
    return { success: true, message: "User promoted to admin" };
  }
  if (action === "demote") {
    await kcFetch(`/users/${userId}/groups/${adminGroup.id}`, token, { method: "DELETE" });
    return { success: true, message: "User removed from admin group" };
  }
  throw Object.assign(new Error(`Unknown action: ${action}`), { status: 400 });
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 60);
  const filter = (searchParams.get("filter") ?? "").replace(/[^\w.@+-]/g, "").slice(0, 128);

  const cognitoIssuer = process.env.COGNITO_ISSUER ?? "";

  try {
    if (cognitoIssuer) {
      const users = await listCognitoUsers(cognitoIssuer, limit, filter || undefined);
      return NextResponse.json({ users, count: users.length, provider: "cognito" });
    }

    if (KC_BASE) {
      const users = await listKeycloakUsers(limit, filter || undefined);
      return NextResponse.json({ users, count: users.length, provider: "keycloak" });
    }

    return NextResponse.json({ error: "Auth provider not configured" }, { status: 503 });
  } catch (err) {
    console.error("Failed to list users:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { action, username } = (await request.json()) as { action: string; username: string };
  if (!action || !username) {
    return NextResponse.json({ error: "action and username required" }, { status: 400 });
  }

  const ALLOWED_ACTIONS = new Set(["enable", "disable", "promote", "demote"]);
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const cognitoIssuer = process.env.COGNITO_ISSUER ?? "";

  // Cognito usernames: alphanumeric, hyphens, dots, +, @, underscore; max 128 chars.
  if (cognitoIssuer && !/^[\w.@+\-]{1,128}$/.test(username)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  try {
    if (cognitoIssuer) {
      const result = await mutateCognitoUser(cognitoIssuer, username, action);
      return NextResponse.json(result);
    }

    if (KC_BASE) {
      const result = await mutateKeycloakUser(username, action);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Auth provider not configured" }, { status: 503 });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    console.error("Failed to modify user:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: status < 500 && err instanceof Error ? err.message : "Failed to modify user" },
      { status }
    );
  }
}
