/**
 * POST /api/user/delete
 * GDPR Art.17 — Right to Erasure ("right to be forgotten").
 * Deletes the authenticated user from Cognito and their DynamoDB profile.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  CognitoIdentityProviderClient,
  AdminDeleteUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const { sub: userId, email } = auth.user;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const region = process.env.AWS_REGION || "us-east-1";
  const errors: string[] = [];

  // 1. Delete Cognito account
  if (userPoolId && email) {
    try {
      await new CognitoIdentityProviderClient({ region }).send(
        new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: email })
      );
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name !== "UserNotFoundException") {
        errors.push("cognito");
        console.error("[user/delete] Cognito delete failed:", e);
      }
    }
  }

  // 2. Delete DynamoDB profile
  const table = process.env.USER_PROFILE_TABLE;
  if (table && userId) {
    try {
      await new DynamoDBClient({ region }).send(
        new DeleteItemCommand({ TableName: table, Key: { userId: { S: userId } } })
      );
    } catch (e) {
      errors.push("profile");
      console.error("[user/delete] DynamoDB delete failed:", e);
    }
  }

  if (errors.length) {
    return NextResponse.json(
      { error: `Partial deletion failure: ${errors.join(", ")}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
