import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import type { AuthDatabase } from "@/lib/auth-d1";
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
// Shared user shape
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
// D1 helpers (primary on Workers)
// ---------------------------------------------------------------------------

interface Env {
  AUTH_DB: AuthDatabase;
}

function getAuthDb(): AuthDatabase | null {
  return (process.env as unknown as Env).AUTH_DB ?? null;
}

interface D1UserRow {
  id: string;
  username: string;
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  status: string;
  email_verified: number | null;
  created_at: number;
  updated_at: number;
  role: string | null;
}

async function listD1Users(db: AuthDatabase, limit: number, filter?: string): Promise<AdminUser[]> {
  let sql = "SELECT u.id, u.username, u.email, u.name, u.company, u.phone, u.status, u.email_verified, u.created_at, u.updated_at, r.role FROM user u LEFT JOIN user_role r ON u.id = r.user_id LIMIT ?";
  const params: (number | string)[] = [limit];
  if (filter) {
    sql = "SELECT u.id, u.username, u.email, u.name, u.company, u.phone, u.status, u.email_verified, u.created_at, u.updated_at, r.role FROM user u LEFT JOIN user_role r ON u.id = r.user_id WHERE u.email LIKE ? OR u.username LIKE ? LIMIT ?";
    params.unshift(`%${filter}%`, `%${filter}%`);
  }

  const result = await db.prepare(sql).bind(...params).all<D1UserRow>();
  const rows = result.results ?? [];

  return rows.map((u) => ({
    username: u.username,
    email: u.email,
    name: u.name ?? "",
    company: u.company ?? "",
    phone: u.phone ?? "",
    status: (u.status === "disabled" ? "disabled" : "active") as "active" | "disabled",
    emailVerified: Boolean(u.email_verified),
    userStatus: "CONFIRMED",
    role: (u.role === "admin" ? "admin" : "user") as "admin" | "user",
    created: new Date(u.created_at * 1000).toISOString(),
    lastModified: new Date(u.updated_at * 1000).toISOString(),
  }));
}

async function mutateD1User(
  db: AuthDatabase,
  username: string,
  action: string
): Promise<{ success: boolean; message: string }> {
  const user = await db.prepare("SELECT id FROM user WHERE username = ?").bind(username).first<{ id: string }>();
  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

  switch (action) {
    case "disable":
      await db.prepare("UPDATE user SET status = 'disabled' WHERE id = ?").bind(user.id).run();
      return { success: true, message: "User disabled" };
    case "enable":
      await db.prepare("UPDATE user SET status = 'active' WHERE id = ?").bind(user.id).run();
      return { success: true, message: "User enabled" };
    case "promote": {
      await db
        .prepare("INSERT INTO user_role (user_id, role) VALUES (?, 'admin') ON CONFLICT(user_id, role) DO NOTHING")
        .bind(user.id, "admin")
        .run();
      return { success: true, message: "User promoted to admin" };
    }
    case "demote": {
      await db.prepare("DELETE FROM user_role WHERE user_id = ? AND role = 'admin'").bind(user.id).run();
      return { success: true, message: "User removed from admin group" };
    }
    default:
      throw Object.assign(new Error(`Unknown action: ${action}`), { status: 400 });
  }
}

// ---------------------------------------------------------------------------
// Cognito helpers (fallback on Lambda)
// ---------------------------------------------------------------------------

function getUserPoolId(issuer: string): string {
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
      throw Object.assign(new Error(`Unknown action: ${action}`), { status: 400 });
  }
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

  // 1. Try D1 first (Cloudflare Workers)
  const db = getAuthDb();
  if (db) {
    try {
      const users = await listD1Users(db, limit, filter || undefined);
      return NextResponse.json({ users, count: users.length, provider: "d1" });
    } catch (err) {
      console.error("[admin-users] D1 list failed, falling back to Cognito:", err instanceof Error ? err.message : String(err));
      // Fall through to Cognito
    }
  }

  // 2. Fallback to Cognito (Lambda / legacy)
  const cognitoIssuer = process.env.COGNITO_ISSUER ?? "";
  try {
    if (cognitoIssuer) {
      const users = await listCognitoUsers(cognitoIssuer, limit, filter || undefined);
      return NextResponse.json({ users, count: users.length, provider: "cognito" });
    }
    return NextResponse.json({ error: "User provider not configured" }, { status: 503 });
  } catch (err) {
    console.error("Failed to list users:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { action, username } = (((await request.json()) as any)) as { action: string; username: string };
  if (!action || !username) {
    return NextResponse.json({ error: "action and username required" }, { status: 400 });
  }

  const ALLOWED_ACTIONS = new Set(["enable", "disable", "promote", "demote"]);
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  // Validate username format
  if (!/^[\w.@+\-]{1,128}$/.test(username)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  // 1. Try D1 first (Cloudflare Workers)
  const db = getAuthDb();
  if (db) {
    try {
      const result = await mutateD1User(db, username, action);
      return NextResponse.json(result);
    } catch (err) {
      const status = (err as { status?: number }).status ?? 500;
      console.error(
        "[admin-users] D1 mutate failed, falling back to Cognito:",
        err instanceof Error ? err.message : String(err)
      );
      if (status !== 500) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Failed to modify user" },
          { status }
        );
      }
      // Fall through to Cognito for 500 errors
    }
  }

  // 2. Fallback to Cognito (Lambda / legacy)
  const cognitoIssuer = process.env.COGNITO_ISSUER ?? "";
  try {
    if (cognitoIssuer) {
      const result = await mutateCognitoUser(cognitoIssuer, username, action);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "User provider not configured" }, { status: 503 });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    console.error("Failed to modify user:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: status < 500 && err instanceof Error ? err.message : "Failed to modify user" },
      { status }
    );
  }
}
