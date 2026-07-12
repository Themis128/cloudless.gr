/**
 * ETL: n8n → R2 Data Lake (Parquet)
 *
 * Migrated version using R2 S3-compatible endpoint.
 * Same logic as n8n-to-lake.mjs - only client configuration differs.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync } from "fs";
import { getS3Client, BUCKET } from "./_r2-config.mjs";
const BASE = (process.env.N8N_API_URL || "").replace(/\/$/, "");
const KEY = process.env.N8N_API_KEY;
const EXEC_LIMIT = Math.max(1, Math.min(Number(process.env.N8N_EXEC_LIMIT) || 250, 250));

if (!BASE || !KEY) {
	console.error("N8N_API_URL and N8N_API_KEY are required");
	process.exit(1);
}

// R2 S3-compatible client (uses shared config helper)
const s3 = getS3Client();

async function n8nFetch(path) {
	const res = await fetch(`${BASE}/api/v1${path}`, {
		headers: { "X-N8N-API-KEY": KEY, Accept: "application/json" },
		signal: AbortSignal.timeout(15_000),
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`n8n ${path} returned ${res.status}: ${body.slice(0, 200)}`);
	}
	return res.json();
}

const workflowSchema = new ParquetSchema({
	workflow_id: { type: "UTF8" },
	name: { type: "UTF8", optional: true },
	active: { type: "BOOLEAN", optional: true },
	tag_count: { type: "INT32", optional: true },
	tags_json: { type: "UTF8", optional: true },
	created_at: { type: "UTF8", optional: true },
	updated_at: { type: "UTF8", optional: true },
});

const executionSchema = new ParquetSchema({
	execution_id: { type: "UTF8" },
	workflow_id: { type: "UTF8", optional: true },
	mode: { type: "UTF8", optional: true },
	status: { type: "UTF8", optional: true },
	finished: { type: "BOOLEAN", optional: true },
	started_at: { type: "UTF8", optional: true },
	stopped_at: { type: "UTF8", optional: true },
	duration_ms: { type: "INT64", optional: true },
});

async function writeParquet(rows, schema, localPath) {
	const writer = await ParquetWriter.openFile(schema, localPath);
	for (const row of rows) await writer.appendRow(row);
	await writer.close();
	return readFileSync(localPath);
}

async function uploadToR2(key, body) {
	await s3.send(
		new PutObjectCommand({
			Bucket: BUCKET,
			Key: key,
			Body: body,
			ContentType: "application/octet-stream",
		})
	);
	console.log(`✓ uploaded R2://${BUCKET}/${key} (${body.length} bytes)`);
}

async function syncWorkflows() {
	const data = await n8nFetch("/workflows?limit=250");
	const rows = (data.data || []).map((w) => ({
		workflow_id: String(w.id ?? ""),
		name: String(w.name ?? ""),
		active: Boolean(w.active),
		tag_count: Array.isArray(w.tags) ? w.tags.length : 0,
		tags_json: JSON.stringify(w.tags ?? []),
		created_at: String(w.createdAt ?? ""),
		updated_at: String(w.updatedAt ?? ""),
	}));
	const local = "/tmp/n8n-workflows.parquet";
	const body = await writeParquet(rows, workflowSchema, local);
	await uploadToR2("lake/n8n-workflows/workflows.parquet", body);
	unlinkSync(local);
	console.log(`workflows: ${rows.length}`);
}

async function syncExecutions() {
	const data = await n8nFetch(`/executions?limit=${EXEC_LIMIT}&includeData=false`);
	const rows = (data.data || []).map((e) => {
		const startedAt = e.startedAt ? Date.parse(e.startedAt) : 0;
		const stoppedAt = e.stoppedAt ? Date.parse(e.stoppedAt) : 0;
		return {
			execution_id: String(e.id ?? ""),
			workflow_id: String(e.workflowId ?? ""),
			mode: String(e.mode ?? ""),
			status: String(e.status ?? ""),
			finished: Boolean(e.finished),
			started_at: String(e.startedAt ?? ""),
			stopped_at: String(e.stoppedAt ?? ""),
			duration_ms: startedAt && stoppedAt ? stoppedAt - startedAt : 0,
		};
	});
	const local = "/tmp/n8n-executions.parquet";
	const body = await writeParquet(rows, executionSchema, local);
	await uploadToR2("lake/n8n-executions/executions.parquet", body);
	unlinkSync(local);
	console.log(`executions: ${rows.length}`);
}

await syncWorkflows();
await syncExecutions();
console.log("✓ n8n → R2 sync complete");