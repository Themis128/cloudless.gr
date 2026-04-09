import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminListGroupsForUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const USER_POOL_ID =
  process.env.COGNITO_USER_POOL_ID ??
  process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ??
  "";

function getClient() {
  return new CognitoIdentityProviderClient({ region: REGION });
}

function getAttr(
  attrs: { Name?: string; Value?: string }[] | undefined,
  name: string,
): string {
  return attrs?.find((a) => a.Name === name)?.Value ?? "";
}

export async function GET(request: NextRequest) {
  // Verify admin authentication
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    if (!USER_POOL_ID) {
      return NextResponse.json(
        { error: "Cognito User Pool not configured" },
        { status: 503 },
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 60);
    const filter = searchParams.get("filter") ?? undefined;

    const client = getClient();

    // List users from Cognito
    const listRes = await client.send(
      new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        Limit: limit,
        ...(filter ? { Filter: `email ^= "${filter}"` } : {}),
      }),
    );

    const users = await Promise.all(
      (listRes.Users ?? []).map(async (u) => {
        // Check if user is in admin group
        let isAdmin = false;
        try {
          const groupsRes = await client.send(
            new AdminListGroupsForUserCommand({
              UserPoolId: USER_POOL_ID,
              Username: u.Username!,
            }),
          );
          isAdmin =
            groupsRes.Groups?.some((g) => g.GroupName === "admin") ?? false;
        } catch {
          // If group lookup fails, default to non-admin
        }

        return {
          username: u.Username,
          email: getAttr(u.Attributes, "email"),
          name: getAttr(u.Attributes, "name"),
          status: u.UserStatus,
          created: u.UserCreateDate?.toISOString(),
          updated: u.UserLastModifiedDate?.toISOString(),
          isAdmin,
        };
      }),
    );

    return NextResponse.json({ users, count: users.length });
  } catch (err) {
    console.error("Failed to list users:", err);
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Verify admin authentication
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    if (!USER_POOL_ID) {
      return NextResponse.json(
        { error: "Cognito User Pool not configured" },
        { status: 503 },
      );
    }

    const { action, username, groupName } = await request.json();

    if (!action || !username) {
      return NextResponse.json(
        { error: "action and username required" },
        { status: 400 },
      );
    }

    const client = getClient();

    if (action === "disable") {
      await client.send(
        new AdminDisableUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: username,
        }),
      );
      return NextResponse.json({ success: true, message: "User disabled" });
    }

    if (action === "enable") {
      await client.send(
        new AdminEnableUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: username,
        }),
      );
      return NextResponse.json({ success: true, message: "User enabled" });
    }

    if (action === "promote" && groupName === "admin") {
      await client.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: username,
          GroupName: groupName,
        }),
      );
      return NextResponse.json({ success: true, message: "User promoted to admin" });
    }

    if (action === "demote" && groupName === "admin") {
      await client.send(
        new AdminRemoveUserFromGroupCommand({
          UserPoolId: USER_POOL_ID,
          Username: username,
          GroupName: groupName,
        }),
      );
      return NextResponse.json({ success: true, message: "User removed from admin group" });
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 },
    );
  } catch (err) {
    console.error("Failed to modify user:", err);
    return NextResponse.json({ error: "Failed to modify user" }, { status: 500 });
  }
}
