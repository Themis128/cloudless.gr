/**
 * Validate soft medallion schema contracts for lake parquet objects.
 * Soft-fail (exit 0 with warnings) when objects are missing; hard-fail when
 * present objects lack required columns.
 */
import { ParquetReader } from "@dsnp/parquetjs";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
	BUCKET,
	LAKE_SCHEMA_CONTRACTS,
	r2Get,
	r2Head,
	r2Put,
} from "./_r2-config.mjs";

async function sampleColumns(key) {
	const buf = await r2Get(key);
	const dir = mkdtempSync(join(tmpdir(), "lake-contract-"));
	const tmp = join(dir, "data.parquet");
	writeFileSync(tmp, buf);
	try {
		const reader = await ParquetReader.openFile(tmp);
		const cursor = reader.getCursor();
		const row = await cursor.next();
		await reader.close();
		if (!row) return [];
		return Object.keys(row);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

async function main() {
	console.log(`Validating lake contracts on R2://${BUCKET}`);
	const freshness = {};
	let hardFails = 0;
	let softMissing = 0;

	for (const [key, required] of Object.entries(LAKE_SCHEMA_CONTRACTS)) {
		const head = await r2Head(key).catch((e) => {
			console.warn(`  HEAD ${key}: ${e.message}`);
			return { exists: false, lastModified: null, size: null };
		});
		freshness[key] = {
			exists: head.exists,
			last_modified: head.lastModified,
			size: head.size,
		};
		if (!head.exists) {
			console.warn(`  MISSING ${key}`);
			softMissing += 1;
			continue;
		}
		const cols = await sampleColumns(key);
		const missingCols = required.filter((c) => !cols.includes(c));
		if (missingCols.length) {
			console.error(`  FAIL ${key} missing columns: ${missingCols.join(", ")}`);
			hardFails += 1;
		} else {
			console.log(`  ok ${key} (${cols.length} cols, modified ${head.lastModified})`);
		}
	}

	await r2Put(
		"lake/snapshots/freshness.json",
		Buffer.from(
			JSON.stringify(
				{
					generated_at: new Date().toISOString(),
					sources: freshness,
				},
				null,
				2
			),
			"utf8"
		),
		{ contentType: "application/json" }
	);
	console.log("  wrote lake/snapshots/freshness.json");

	console.log(
		`Done. hardFails=${hardFails} softMissing=${softMissing} contracts=${Object.keys(LAKE_SCHEMA_CONTRACTS).length}`
	);
	if (hardFails > 0) process.exit(1);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
