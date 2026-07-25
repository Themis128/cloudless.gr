import { NextRequest, NextResponse } from "next/server";
import {
  ListUsersCommand,
  AdminListGroupsForUserCommand,
  AdminEnableUserCommand,
  AdminDisableUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  type UserType,
} from "@/types/aws-sdk/client-cognito-identity-provider";
import { requireAdmin } from "@/lib/api-auth";

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID ?? "";
const REGION = process.env.AWS_REGION ?? "us-east-1";
const ADMIN_GROUP = process.env.COGNITO_ADMIN_GROUP ?? "admin";


function attr(user: UserType, name: string): string {
  return user.Attributes?.find((a) => a.Name === name)?.Value ?? "";
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!USER_POOL_ID) {
    return NextResponse.json({ error: "Cognito not configured" }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 60);
    const filterRaw = (searchParams.get("filter") ?? "").replace(/[^\w.@+-]/g, "").slice(0, 128);

    const listRes = await client.send(
      new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        Limit: limit,
        // Cognito filter syntax: prefix match on email
        ...(filterRaw ? { Filter: `email ^= \"${filterRaw}\"` } : {}),
      }),
    );

    const cognitoUsers = listRes.Users ?? [];

    const users = await Promise.all(
      cognitoUsers.map(async (u) => {
        const username = u.Username ?? "";
        let isAdmin = false;
        try {
          const groupsRes = await client.send(
            new AdminListGroupsForUserCommand({
              UserPoolId: USER_POOL_ID,
              Username: username,
            }),
          );
          isAdmin = (groupsRes.Groups ?? []).some((g) => g.GroupName === ADMIN_GROUP);
        } catch {
          /* default non-admin */
        }

        return {
          username,
          email: attr(u, "email"),
          name: attr(u, "name") || [attr(u, "given_name"), attr(u, "family_name")].filter(Boolean).join(" "),
          company: attr(u, "custom:company"),
          phone: attr(u, "phone_number"),
          emailVerified: attr(u, "email_verified") === "true",
          status: u.Enabled ? "active" : "disabled",
          userStatus: u.UserStatus ?? (u.Enabled ? "CONFIRMED" : "DISABLED"),
          role: isAdmin ? "admin" : "user",
          created: u.UserCreateDate ? new Date(u.UserCreateDate).toISOString() : undefined,
        };
      }),
    );

    return NextResponse.json({ users, count: users.length });
  } catch (err) {
    console.error("Failed to list Cognito users:", err);
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!USER_POOL_ID) {
    return NextResponse.json({ error: "Cognito not configured" }, { status: 503 });
  }

  try {
    const { action, username } = (await request.json()) as {
      action: string;
      username: string;
    };

    if (!action || !username) {
      return NextResponse.json({ error: "action and username required" }, { status: 400 });
    }

    switch (action) {
      case "disable":
        await client.send(
          new AdminDisableUserCommand({ UserPoolId: USER_POOL_ID, Username: username }),
        );
        return NextResponse.json({ success: true, message: "User disabled" });

      case "enable":
        await client.send(
          new AdminEnableUserCommand({ UserPoolId: USER_POOL_ID, Username: username }),
        );
        return NextResponse.json({ success: true, message: "User enabled" });

      case "promote":
        await client.send(
          new AdminAddUserToGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            GroupName: ADMIN_GROUP,
          }),
        );
        return NextResponse.json({ success: true, message: "User promoted to admin" });

      case "demote":
        await client.send(
          new AdminRemoveUserFromGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            GroupName: ADMIN_GROUP,
          }),
        );
        return NextResponse.json({ success: true, message: "User removed from admin group" });

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("Failed to modify Cognito user:", err);
    return NextResponse.json({ error: "Failed to modify user" }, { status: 500 });
  }
}
