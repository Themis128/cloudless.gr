import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
  type AttributeValue,
} from "@aws-sdk/client-dynamodb";
import { resolveDynamoEndpoint } from "@/lib/stripe-transactions";

/**
 * Provider-agnostic user-profile store on DynamoDB.
 *
 * The dashboard Profile/Settings form needs to persist name / company / phone /
 * preferences. These used to live in the IdP account store, which ties the
 * profile to a specific IdP and is unavailable under Cognito (its custom
 * attributes can't be added to an existing pool without replacing it). Storing
 * the profile in DynamoDB keyed by the user's `sub` decouples it from the IdP,
 * so it works identically for any OIDC provider.
 *
 * Table (sst.config.ts → "UserProfile"): hashKey `userId` = the OIDC `sub`.
 * Access is granted to the site Lambda via SST resource linking.
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
 * `name` is a DynamoDB reserved word, so all attributes go through expression
 * attribute names.
 */
export async function putUserProfile(userId: string, fields: UserProfile): Promise<void> {
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
