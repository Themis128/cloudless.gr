/**
 * POST /api/user/delete
 * GDPR Art.17 — Right to Erasure ("right to be forgotten").
 * Deletes the authenticated user from D1 (primary) or Cognito/DynamoDB (fallback).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import type { AuthDatabase } from "@/lib/auth-d1";

export const dynamic = "force-dynamic";

// D1 binding interface - provided by Worker context
interface Env {
  AUTH_DB: AuthDatabase;
}

function getAuthDb(): AuthDatabase | null {
  return (process.env as unknown as Env).AUTH_DB ?? null;
}

/**
 * Delete user from D1 (primary on Cloudflare Workers).
 * Cascades to related tables: session, user_token, user_role.
 */
async function deleteD1User(db: AuthDatabase, userId: string, email: string): Promise<void> {
  // Find user by id first (most reliable)
  const user = await db
    .prepare("SELECT id FROM user WHERE id = ?")
    .bind(userId)
    .first<{ id: string }>();

  if (!user) {
    // Fallback: find by email
    const userByEmail = await db
      .prepare("SELECT id FROM user WHERE email = ?")
      .bind(email)
      .first<{ id: string }>();
    if (!userByEmail) {
      throw new Error("User not found in D1");
    }
  }

  const id = user?.id ?? userId;

  // Delete in transaction order (child tables first, then parent)
  await db.prepare("DELETE FROM session WHERE user_id = ?").bind(id).run();
  await db.prepare("DELETE FROM user_token WHERE user_id = ?").bind(id).run();
  await db.prepare("DELETE FROM user_role WHERE user_id = ?").bind(id).run();
  await db.prepare("DELETE FROM user WHERE id = ?").bind(id).run();
}

/**
 * Delete user from Cognito (fallback on Lambda/legacy).
 */
async function deleteCognitoUser(userPoolId: string, region: string, email: string): Promise<void> {
  try {
    await new CognitoIdentityProviderClient({ region }).send(
      new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: email })
    );
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name !== "UserNotFoundException") {
      throw e;
    }
    // UserNotFoundException is acceptable — user already deleted
  }
}

/**
 * Delete user profile from DynamoDB (fallback on Lambda/legacy).
 */
async function deleteDynamoDBProfile(table: string, region: string, userId: string): Promise<void> {
  await new DynamoDBClient({ region }).send(
    new DeleteItemCommand({ TableName: table, Key: { userId: { S: userId } } })
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const { sub: userId, email } = auth.user;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const region = process.env.AWS_REGION || "us-east-1";
  const errors: string[] = [];

  // 1. Try D1 first (Cloudflare Workers)
  const db = getAuthDb();
  if (db && email) {
    try {
      await deleteD1User(db, userId, email);
      // D1 delete succeeded — still try Cognito cleanup in case user was created in both systems
      if (userPoolId) {
        try {
          await deleteCognitoUser(userPoolId, region, email);
        } catch (e) {
          console.error("[user/delete] Cognito cleanup after D1 delete failed:", e);
          // Don't fail the whole request — D1 is the source of truth on Workers
        }
      }
      return NextResponse.json({ ok: true, provider: "d1" });
    } catch (err) {
      console.error("[user/delete] D1 delete failed, falling back to Cognito:", err);
      // Fall through to Cognito/DynamoDB fallback
    }
  }

  // 2. Fallback to Cognito + DynamoDB (Lambda / legacy)
  if (userPoolId && email) {
    try {
      await deleteCognitoUser(userPoolId, region, email);
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name !== "UserNotFoundException") {
        errors.push("cognito");
        console.error("[user/delete] Cognito delete failed:", e);
      }
    }
  }

  const table = process.env.USER_PROFILE_TABLE;
  if (table && userId) {
    try {
      await deleteDynamoDBProfile(table, region, userId);
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

  return NextResponse.json({ ok: true, provider: "cognito" });
}
