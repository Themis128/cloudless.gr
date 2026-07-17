/**
 * /api/admin/users/[id] — Individual user management.
 *
 * GET: Get user details
 * PUT: Update user details
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID ?? "";
const REGION = process.env.AWS_REGION ?? "us-east-1";

const client = new CognitoIdentityProviderClient({ region: REGION });

function attr(user: UserType, name: string): string | undefined {
  return user.Attributes?.find((a) => a.Name === name)?.Value;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!USER_POOL_ID) {
    return NextResponse.json({ error: "Cognito not configured" }, { status: 503 });
  }

  const { id: username } = await params;

  try {
    const userRes = await client.send(
      new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
      })
    );

    const user = {
      username,
      email: attr(userRes, "email"),
      name: attr(userRes, "name") || [attr(userRes, "given_name"), attr(userRes, "family_name")]
        .filter(Boolean)
        .join(" "),
      company: attr(userRes, "custom:company"),
      phone: attr(userRes, "phone_number"),
      emailVerified: attr(userRes, "email_verified") === "true",
      status: userRes.Enabled ? "active" : "disabled",
      userStatus: userRes.UserStatus ?? (userRes.Enabled ? "CONFIRMED" : "DISABLED"),
      created: userRes.UserCreateDate ? new Date(userRes.UserCreateDate).toISOString() : undefined,
    };

    return NextResponse.json({ user });
  } catch (err: unknown) {
    const error = err as { name?: string; message?: string };
    if (error.name === "UserNotFoundException") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.error("Failed to get user:", err);
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!USER_POOL_ID) {
    return NextResponse.json({ error: "Cognito not configured" }, { status: 503 });
  }

  const { id: username } = await params;
  const body = (await request.json()) as {
    name?: string;
    company?: string;
    phone?: string;
  };

  try {
    const attributes: { Name: string; Value: string }[] = [];

    if (body.name !== undefined) {
      attributes.push(
        { Name: "name", Value: body.name },
        { Name: "given_name", Value: body.name.split(" ")[0] ?? "" },
        { Name: "family_name", Value: body.name.split(" ").slice(1).join(" ") },
      );
    }

    if (body.company !== undefined) {
      attributes.push({ Name: "custom:company", Value: body.company });
    }

    if (body.phone !== undefined) {
      attributes.push({ Name: "phone_number", Value: body.phone });
    }

    if (attributes.length === 0) {
      return NextResponse.json({ error: "No attributes to update" }, { status: 400 });
    }

    await client.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: USER_POOL_ID,
        Username: username,
        UserAttributes: attributes,
      })
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as { name?: string };
    if (error.name === "UserNotFoundException") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.error("Failed to update user:", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}