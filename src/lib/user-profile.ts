import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
  type AttributeValue,
} from "@aws-sdk/client-dynamodb";
import { resolveDynamoEndpoint } from "@/lib/stripe-transactions";
import {
  getAuthDbFromEnv,
  getUserById,
  patchUserProfile as patchD1Profile,
} from "@/lib/auth-d1";

/**
 * Provider-agnostic user-profile store.
 *
 * Cloudflare-first: D1 `user` row when AUTH_DB is bound.
 * Legacy fallback: DynamoDB UserProfile table (USER_PROFILE_TABLE).
 */

const REGION = process.env.AWS_REGION || "us-east-1";

let dynamoClient: DynamoDBClient | null = null;
function getDynamoClient(): DynamoDBClient {
  dynamoClient ??= new DynamoDBClient({ region: REGION, endpoint: resolveDynamoEndpoint() });
  return dynamoClient;
}

function getTableName(): string {
  const name = process.env.USER_PROFILE_TABLE?.trim();
  if (!name) throw new Error("USER_PROFILE_TABLE is not configured");
  return name;
}

export interface UserProfile {
  name?: string;
  company?: string;
  phone?: string;
  preferences?: unknown;
}

/** Read a user's stored profile. Returns {} when no record exists yet. */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  const db = getAuthDbFromEnv();
  if (db) {
    const user = await getUserById(db, userId);
    if (!user) return {};
    let preferences: unknown;
    if (user.preferences_json) {
      try {
        preferences = JSON.parse(user.preferences_json);
      } catch {
        // ignore malformed
      }
    }
    return {
      name: user.name ?? undefined,
      company: user.company ?? undefined,
      phone: user.phone ?? undefined,
      preferences,
    };
  }

  const res = await getDynamoClient().send(
    new GetItemCommand({
      TableName: getTableName(),
      Key: { userId: { S: userId } },
    })
  );
  const item = res.Item;
  if (!item) return {};

  let preferences: unknown;
  const rawPrefs = item.preferences?.S;
  if (rawPrefs) {
    try {
      preferences = JSON.parse(rawPrefs);
    } catch {
      // Ignore malformed stored preferences — fall back to client defaults.
    }
  }

  return {
    name: item.name?.S,
    company: item.company?.S,
    phone: item.phone?.S,
    preferences,
  };
}

/**
 * Upsert the provided profile fields, keyed by userId.
 *
 * Partial update: only the keys present in `fields` are written. A string set
 * to "" clears (REMOVEs) that attribute; `undefined` leaves it untouched.
 */
export async function putUserProfile(userId: string, fields: UserProfile): Promise<void> {
  const db = getAuthDbFromEnv();
  if (db) {
    const ok = await patchD1Profile(db, userId, fields);
    if (!ok) throw new Error("User not found");
    return;
  }

  const setParts: string[] = [];
  const removeParts: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, AttributeValue> = {};

  const handleString = (attr: string, value: string | undefined): void => {
    if (value === undefined) return;
    names[`#${attr}`] = attr;
    if (value === "") {
      removeParts.push(`#${attr}`);
      return;
    }
    setParts.push(`#${attr} = :${attr}`);
    values[`:${attr}`] = { S: value };
  };

  handleString("name", fields.name);
  handleString("company", fields.company);
  handleString("phone", fields.phone);
  if (fields.preferences !== undefined) {
    names["#preferences"] = "preferences";
    setParts.push("#preferences = :preferences");
    values[":preferences"] = { S: JSON.stringify(fields.preferences) };
  }

  if (setParts.length === 0 && removeParts.length === 0) return; // nothing to write

  const clauses: string[] = [];
  if (setParts.length) clauses.push(`SET ${setParts.join(", ")}`);
  if (removeParts.length) clauses.push(`REMOVE ${removeParts.join(", ")}`);

  await getDynamoClient().send(
    new UpdateItemCommand({
      TableName: getTableName(),
      Key: { userId: { S: userId } },
      UpdateExpression: clauses.join(" "),
      ExpressionAttributeNames: names,
      ...(Object.keys(values).length ? { ExpressionAttributeValues: values } : {}),
    })
  );
}
