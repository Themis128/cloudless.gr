/**
 * Pending clients — clients who have signed up + selected a plan but
 * are waiting for an admin to review and provision their portal.
 *
 * WHY DynamoDB instead of SSM (fix for audit #3):
 *   SSM's PutParameter has no conditional-write or compare-and-swap — two
 *   concurrent requests both read the full array, append/update, and write
 *   back. The second write silently overwrites the first's changes.
 *
 *   DynamoDB's ConditionExpression on email (hash key) prevents this:
 *   - Insert: condition = attribute_not_exists(email) — only succeeds the
 *     first time.
 *   - Update: condition = attribute_exists(email) — atomic update of the
 *     status/portalToken/plan fields without reading the full record.
 *
 * The table name is CLIENT_PORTALS_TABLE (same table used by the portal
 * module), keyed by email (S). Items have a `type` attribute of "pending"
 * vs "portal" so the same table can hold both pending requests and
 * approved portal tokens.
 */

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { PLAN_LABELS } from "./plans";
export { PLAN_LABELS };

const TABLE_NAME = process.env.CLIENT_PORTALS_TABLE ?? "cloudless-client-portals";
const REGION = process.env.AWS_REGION || "eu-central-1";

const dynamoClient = new DynamoDBClient({ region: REGION });

export type PendingStatus = "waiting" | "approved" | "declined";

export interface PendingClient {
  /** Email (primary key, hash key) */
  email: string;
  /** Distinguishes pending from portal records in the same table */
  type: "pending";
  name?: string;
  /** Plan selected on the services page (e.g. "bundle", "cloud", "serverless") */
  plan: string;
  /** Optional human-readable plan label, e.g. "Full-Stack Growth Engine" */
  planLabel?: string;
  submittedAt: string;
  status: PendingStatus;
  /** Set when admin approves and creates a portal */
  portalToken?: string;
  approvedAt?: string;
  /** Free-form notes set by the client (e.g. project context) */
  notes?: string;
  /** Optimistic-lock token for write-after-read safety on admin operations */
  version?: number;
}

function toDynamoItem(p: PendingClient): Record<string, unknown> {
  return { ...p };
}

/**
 * Upsert a pending client by email using DynamoDB conditional write.
 *
 * INSERT (first time):
 *   Condition: attribute_not_exists(email) — only succeeds if no record
 *   exists. Guarantees the first write wins, no races.
 *
 * UPDATE (existing, not yet approved):
 *   Condition: attribute_exists(email) AND #status <> "approved" — atomic
 *   update of plan/name/notes fields without read-modify-write.
 *
 * If already approved, returns the existing record unchanged.
 */
export async function upsertPendingClient(
  input: Pick<PendingClient, "email" | "plan"> & Partial<PendingClient>
): Promise<PendingClient> {
  const email = input.email.toLowerCase();

  // Try insert first (conditional on non-existence)
  const created: PendingClient = {
    email,
    type: "pending",
    name: input.name,
    plan: input.plan,
    planLabel: input.planLabel ?? PLAN_LABELS[input.plan] ?? input.plan,
    submittedAt: new Date().toISOString(),
    status: "waiting",
    notes: input.notes,
    version: 1,
  };

  try {
    await dynamoClient.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall(toDynamoItem(created), { removeUndefinedValues: true }),
        ConditionExpression: "attribute_not_exists(email)",
      })
    );
    return created;
  } catch (err: unknown) {
    // ConditionalCheckFailedException means the record already exists —
    // proceed to update path.
    if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
      // Attempt update on existing (non-approved) record
      const updateResult = await dynamoClient.send(
        new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: marshall({ email }),
          UpdateExpression:
            "SET #plan = :plan, #planLabel = :planLabel, #type = :type " +
            "#name = if_not_exists(#name, :name), " +
            "#notes = if_not_exists(#notes, :notes), " +
            "#version = if_not_exists(#version, :zero) + :one " +
            "REMOVE #portalToken, #approvedAt",
          ExpressionAttributeNames: {
            "#plan": "plan",
            "#planLabel": "planLabel",
            "#type": "type",
            "#name": "name",
            "#notes": "notes",
            "#version": "version",
            "#status": "status",
            "#portalToken": "portalToken",
            "#approvedAt": "approvedAt",
          },
          ExpressionAttributeValues: marshall(
            {
              ":plan": input.plan,
              ":planLabel": input.planLabel ?? PLAN_LABELS[input.plan] ?? input.plan,
              ":type": "pending" as const,
              ":name": input.name,
              ":notes": input.notes,
              ":one": 1,
              ":zero": 0,
            },
            { removeUndefinedValues: true }
          ),
          ConditionExpression:
            "attribute_exists(email) AND (#status <> :approved OR attribute_not_exists(#status))",
          ReturnValues: "ALL_NEW",
        })
      );

      const attrs = updateResult.Attributes ? unmarshall(updateResult.Attributes) : {};
      return {
        email,
        type: "pending",
        name: attrs.name as string | undefined,
        plan: (attrs.plan as string) ?? input.plan,
        planLabel: (attrs.planLabel as string) ?? input.planLabel ?? input.plan,
        submittedAt: (attrs.submittedAt as string) ?? created.submittedAt,
        status: (attrs.status as PendingStatus) ?? "waiting",
        notes: attrs.notes as string | undefined,
        portalToken: attrs.portalToken as string | undefined,
        approvedAt: attrs.approvedAt as string | undefined,
        version: (attrs.version as number) ?? 1,
      };
    }
    throw err;
  }
}

/**
 * Read a single pending client record by email.
 */
export async function findPendingByEmail(email: string): Promise<PendingClient | null> {
  try {
    const res = await dynamoClient.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ email: email.toLowerCase() }),
      })
    );
    if (!res.Item) return null;
    const item = unmarshall(res.Item) as PendingClient;
    if (item.type !== "pending") return null;
    return item;
  } catch {
    return null;
  }
}

/**
 * List all pending clients (type = "pending"). For admin review panel.
 */
export async function readPendingClients(): Promise<PendingClient[]> {
  try {
    const res = await dynamoClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "type-index",
        KeyConditionExpression: "#type = :type",
        ExpressionAttributeNames: { "#type": "type" },
        ExpressionAttributeValues: marshall({ ":type": "pending" }),
      })
    );
    return (res.Items ?? []).map((item) => unmarshall(item) as PendingClient);
  } catch {
    // Fallback if GSI doesn't exist: scan (slow, only for dev)
    try {
      const { ScanCommand } = await import("@aws-sdk/client-dynamodb");
      const scanRes = await dynamoClient.send(
        new ScanCommand({
          TableName: TABLE_NAME,
          FilterExpression: "#type = :type",
          ExpressionAttributeNames: { "#type": "type" },
          ExpressionAttributeValues: marshall({ ":type": "pending" }),
        })
      );
      return (scanRes.Items ?? []).map((item) => unmarshall(item) as PendingClient);
    } catch {
      return [];
    }
  }
}

/**
 * Write a specific set of pending clients. Used for admin operations that
 * replace the full set atomically (rare — admin approval/decline should
 * use approvePendingClient instead).
 */
export async function writePendingClients(clients: PendingClient[]): Promise<void> {
  // Batched writes for the migration/backfill path
  for (const client of clients) {
    try {
      await dynamoClient.send(
        new PutItemCommand({
          TableName: TABLE_NAME,
          Item: marshall(toDynamoItem(client), { removeUndefinedValues: true }),
          ConditionExpression: "attribute_not_exists(email)",
        })
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
        // Exists — update
        await dynamoClient.send(
          new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: marshall({ email: client.email }),
            UpdateExpression:
              "SET #plan = :plan, #planLabel = :planLabel, #status = :status, #submittedAt = :submittedAt, #type = :type",
            ExpressionAttributeNames: {
              "#plan": "plan",
              "#planLabel": "planLabel",
              "#status": "status",
              "#submittedAt": "submittedAt",
              "#type": "type",
            },
            ExpressionAttributeValues: marshall({
              ":plan": client.plan,
              ":planLabel": client.planLabel ?? PLAN_LABELS[client.plan] ?? client.plan,
              ":status": client.status,
              ":submittedAt": client.submittedAt,
              ":type": "pending",
            }),
          })
        );
      }
    }
  }
}

/**
 * Approve a pending client — atomically sets status=approved and links the
 * portal token. Only succeeds if the record exists and is currently waiting.
 * Returns the updated record, or null if not found / already approved.
 */
export async function approvePendingClient(
  email: string,
  portalToken: string
): Promise<PendingClient | null> {
  try {
    const res = await dynamoClient.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ email: email.toLowerCase() }),
        UpdateExpression:
          "SET #status = :approved, #portalToken = :token, #approvedAt = :now, #version = #version + :one",
        ExpressionAttributeNames: {
          "#status": "status",
          "#portalToken": "portalToken",
          "#approvedAt": "approvedAt",
          "#version": "version",
        },
        ExpressionAttributeValues: marshall({
          ":approved": "approved",
          ":token": portalToken,
          ":now": new Date().toISOString(),
          ":one": 1,
        }),
        ConditionExpression: "attribute_exists(email) AND #status = :waiting",
        ReturnValues: "ALL_NEW",
      })
    );
    const attrs = res.Attributes ? unmarshall(res.Attributes) : {};
    return {
      email: email.toLowerCase(),
      type: "pending",
      name: attrs.name as string | undefined,
      plan: (attrs.plan as string) ?? "",
      planLabel: attrs.planLabel as string | undefined,
      submittedAt: (attrs.submittedAt as string) ?? new Date().toISOString(),
      status: "approved",
      portalToken,
      approvedAt: attrs.approvedAt as string | undefined,
      notes: attrs.notes as string | undefined,
      version: (attrs.version as number) ?? 1,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "ConditionalCheckFailedException") return null;
    throw err;
  }
}
