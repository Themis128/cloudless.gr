import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminListGroupsForUserCommand,
  AdminEnableUserCommand,
  AdminDisableUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { requireAdmin } from "@/lib/api-auth";

// ---------------------------------------------------------------------------
// Shared user shape (Cognito user shape)
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

  const cognitoIssuer = process.env.COGNITO_ISSUER ?? "";

  try {
    if (cognitoIssuer) {
      const users = await listCognitoUsers(cognitoIssuer, limit, filter || undefined);
      return NextResponse.json({ users, count: users.length, provider: "cognito" });
    }

    return NextResponse.json({ error: "Cognito not configured" }, { status: 503 });
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
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
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

    return NextResponse.json({ error: "Cognito not configured" }, { status: 503 });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    console.error("Failed to modify user:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: status < 500 && err instanceof Error ? err.message : "Failed to modify user" },
      { status }
    );
  }
}
