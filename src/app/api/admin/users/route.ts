import { NextResponse } from "next/server";
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

export async function GET(request: Request) {
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
          username: u.Username ?? "",
          email: getAttr(u.Attributes, "email"),
          name: getAttr(u.Attributes, "name"),
          company: getAttr(u.Attributes, "custom:company"),
          phone: getAttr(u.Attributes, "phone_number"),
          status: u.Enabled ? "active" : "disabled",
          emailVerified: getAttr(u.Attributes, "email_verified") === "true",
          userStatus: u.UserStatus ?? "UNKNOWN",
          role: isAdmin ? "admin" : "user",
          created: u.UserCreateDate?.toISOString() ?? "",
          lastModified: u.UserLastModifiedDate?.toISOString() ?? "",
        };
      }),
    );

    return NextResponse.json({
      users,
      total: users.length,
    });
  } catch (err) {
    console.error("[Admin Users] Error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch users",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!USER_POOL_ID) {
      return NextResponse.json(
        { error: "Cognito User Pool not configured" },
        { status: 503 },
      );
    }

    const body = await request.json();
    const { action, username } = body as {
      action: string;
      username: string;
    };

    if (!action || !username) {
      return NextResponse.json(
        { error: "Missing action or username" },
        { status: 400 },
      );
    }

    const client = getClient();

    switch (action) {
      case "disable":
        await client.send(
          new AdminDisableUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
          }),
        );
        return NextResponse.json({ success: true, message: "User disabled" });

      case "enable":
        await client.send(
          new AdminEnableUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
          }),
        );
        return NextResponse.json({ success: true, message: "User enabled" });

      case "promote":
        await client.send(
          new AdminAddUserToGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            GroupName: "admin",
          }),
        );
        return NextResponse.json({
          success: true,
          message: "User promoted to admin",
        });

      case "demote":
        await client.send(
          new AdminRemoveUserFromGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: username,
            GroupName: "admin",
          }),
        );
        return NextResponse.json({
          success: true,
          message: "User removed from admin group",
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (err) {
    console.error("[Admin Users] Action error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Action failed",
      },
      { status: 500 },
    );
  }
}
