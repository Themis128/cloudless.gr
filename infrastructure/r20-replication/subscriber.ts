/**
 * R20: Postgres logical-replication subscriber (Lambda / Node handler).
 *
 * Accepts a change batch from the in-cluster relay and writes each row
 * into DynamoDB. Uses existing AWS services only — no EC2/RDS subscriber.
 *
 * Expected event shape:
 *   {
 *     changes: Array<{
 *       kind: "insert" | "update" | "delete";
 *       schema?: string;
 *       table: string;
 *       columns?: Array<{ name: string; value: unknown }>;
 *       identity?: Array<{ name: string; value: unknown }>;
 *     }>
 *   }
 */

import { DynamoDBClient, PutItemCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

const ddb = new DynamoDBClient({});
const TABLE = process.env.R20_DDB_TABLE || "cloudless-ReplicationMirror-production";

export interface ReplicationColumn {
  name: string;
  value: unknown;
}

export interface ReplicationChange {
  kind: "insert" | "update" | "delete";
  schema?: string;
  table: string;
  columns?: ReplicationColumn[];
  identity?: ReplicationColumn[];
}

export interface ReplicationEvent {
  changes?: ReplicationChange[];
  source?: string;
  receivedAt?: string;
}

function colsToRecord(cols: ReplicationColumn[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of cols ?? []) {
    out[c.name] = c.value;
  }
  return out;
}

function primaryKey(change: ReplicationChange): Record<string, unknown> {
  const fromIdentity = colsToRecord(change.identity);
  if (Object.keys(fromIdentity).length > 0) return fromIdentity;
  const fromCols = colsToRecord(change.columns);
  if (fromCols.id !== undefined) return { id: fromCols.id };
  return { id: `${change.table}:${Date.now()}` };
}

export async function handleReplicationEvent(event: ReplicationEvent): Promise<{
  written: number;
  deleted: number;
  skipped: number;
}> {
  const changes = event.changes ?? [];
  let written = 0;
  let deleted = 0;
  let skipped = 0;

  for (const change of changes) {
    if (!change.table || !change.kind) {
      skipped += 1;
      continue;
    }

    const pk = primaryKey(change);
    const itemKey = {
      pk: `${change.schema ?? "public"}#${change.table}`,
      sk: String(pk.id ?? JSON.stringify(pk)),
    };

    if (change.kind === "delete") {
      await ddb.send(
        new DeleteItemCommand({
          TableName: TABLE,
          Key: marshall(itemKey),
        })
      );
      deleted += 1;
      continue;
    }

    const payload = {
      ...itemKey,
      kind: change.kind,
      table: change.table,
      schema: change.schema ?? "public",
      row: colsToRecord(change.columns),
      source: event.source ?? "appflowy",
      updatedAt: event.receivedAt ?? new Date().toISOString(),
    };

    await ddb.send(
      new PutItemCommand({
        TableName: TABLE,
        Item: marshall(payload, { removeUndefinedValues: true }),
      })
    );
    written += 1;
  }

  return { written, deleted, skipped };
}

/** AWS Lambda entrypoint */
export async function handler(event: ReplicationEvent | { body?: string }) {
  const body: ReplicationEvent =
    typeof (event as { body?: string }).body === "string"
      ? (JSON.parse((event as { body: string }).body) as ReplicationEvent)
      : (event as ReplicationEvent);

  const result = await handleReplicationEvent(body);
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ok: true, ...result }),
  };
}
