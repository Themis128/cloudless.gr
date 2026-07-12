/**
 * ETL: Stripe → R2 Data Lake (Parquet)
 *
 * Migrated version using R2 S3-compatible endpoint.
 * Same logic as stripe-to-lake.mjs - only client configuration differs.
 */

import Stripe from "stripe";
import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFileSync, unlinkSync } from "fs";
import { getS3Client } from "./_r2-config.mjs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
// R2 S3-compatible client (uses shared config helper)
const s3 = getS3Client();
const BUCKET = process.env.ANALYTICS_BUCKET || "cloudless-analytics-data";
const OUTPUT_KEY = "lake/transactions/transactions.parquet";
const TMP_FILE = "/tmp/transactions.parquet";

const schema = new ParquetSchema({
	transaction_id: { type: "UTF8" },
	email: { type: "UTF8", optional: true },
	user_id: { type: "UTF8", optional: true },
	type: { type: "UTF8" },
	status: { type: "UTF8" },
	amount_cents: { type: "INT64" },
	currency: { type: "UTF8" },
	product_id: { type: "UTF8", optional: true },
	product_name: { type: "UTF8", optional: true },
	plan: { type: "UTF8", optional: true },
	interval_unit: { type: "UTF8", optional: true },
	stripe_id: { type: "UTF8" },
	created_at: { type: "UTF8" },
	paid_at: { type: "UTF8", optional: true },
});

async function fetchAllCheckoutSessions() {
	const rows = [];
	for await (const session of stripe.checkout.sessions.list({ limit: 100, expand: ["data.line_items"] })) {
		const li = session.line_items?.data?.[0];
		rows.push({
			transaction_id: session.id,
			email: session.customer_details?.email || null,
			user_id: session.metadata?.user_id || null,
			type: "checkout",
			status: session.payment_status === "paid" ? "paid" : session.status || "unknown",
			amount_cents: BigInt(session.amount_total || 0),
			currency: (session.currency || "eur").toUpperCase(),
			product_id: li?.price?.product || null,
			product_name: li?.description || null,
			plan: session.metadata?.plan || null,
			interval_unit: li?.price?.recurring?.interval || null,
			stripe_id: session.id,
			created_at: new Date(session.created * 1000).toISOString(),
			paid_at: session.payment_status === "paid" ? new Date(session.created * 1000).toISOString() : null,
		});
	}
	return rows;
}

async function fetchAllInvoices() {
	const rows = [];
	for await (const inv of stripe.invoices.list({ limit: 100 })) {
		rows.push({
			transaction_id: inv.id,
			email: inv.customer_email || null,
			user_id: inv.metadata?.user_id || null,
			type: "invoice",
			status: inv.status === "paid" ? "paid" : inv.status || "unknown",
			amount_cents: BigInt(inv.amount_paid || inv.amount_due || 0),
			currency: (inv.currency || "eur").toUpperCase(),
			product_id: inv.lines?.data?.[0]?.price?.product || null,
			product_name: inv.lines?.data?.[0]?.description || null,
			plan: inv.metadata?.plan || null,
			interval_unit: inv.lines?.data?.[0]?.price?.recurring?.interval || null,
			stripe_id: inv.id,
			created_at: new Date(inv.created * 1000).toISOString(),
			paid_at: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000).toISOString() : null,
		});
	}
	return rows;
}

async function fetchAllSubscriptions() {
	const rows = [];
	for await (const sub of stripe.subscriptions.list({ limit: 100 })) {
		const item = sub.items?.data?.[0];
		rows.push({
			transaction_id: sub.id,
			email: null,
			user_id: sub.metadata?.user_id || null,
			type: "subscription",
			status: sub.status,
			amount_cents: BigInt(item?.price?.unit_amount || 0),
			currency: (item?.price?.currency || "eur").toUpperCase(),
			product_id: item?.price?.product || null,
			product_name: item?.price?.nickname || null,
			plan: sub.metadata?.plan || null,
			interval_unit: item?.price?.recurring?.interval || null,
			stripe_id: sub.id,
			created_at: new Date(sub.created * 1000).toISOString(),
			paid_at: sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
		});
	}
	return rows;
}

async function main() {
	console.log("Fetching Stripe data...");
	const [sessions, invoices, subs] = await Promise.all([
		fetchAllCheckoutSessions(),
		fetchAllInvoices(),
		fetchAllSubscriptions(),
	]);
	const all = [...sessions, ...invoices, ...subs];
	console.log(`Total rows: ${all.length} (${sessions.length} sessions, ${invoices.length} invoices, ${subs.length} subs)`);

	if (all.length === 0) {
		console.log("No transactions — writing empty marker.");
	}

	const writer = await ParquetWriter.openFile(schema, TMP_FILE);
	for (const row of all) await writer.appendRow(row);
	await writer.close();

	const body = readFileSync(TMP_FILE);
	await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: OUTPUT_KEY, Body: body, ContentType: "application/octet-stream" }));
	unlinkSync(TMP_FILE);
	console.log(`✅ Uploaded ${all.length} rows → R2://${BUCKET}/${OUTPUT_KEY}`);
}

main().catch((e) => { console.error(e); process.exit(1); });