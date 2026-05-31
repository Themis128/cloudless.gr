/**
 * After all Playwright tests finish, read NODE_V8_COVERAGE output from the
 * dev server and feed it to monocart-coverage-reports. The result merges
 * with the per-test client coverage that monocart-reporter already wrote.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SERVER_COV_DIR = path.join(ROOT, ".coverage-v8-server");
const REPORT_DIR = path.join(ROOT, "coverage", "playwright");

export default async function globalTeardown() {
  if (process.env.COVERAGE !== "1") return;
  if (!fs.existsSync(SERVER_COV_DIR)) {
    console.log("[coverage] No server V8 dir found at", SERVER_COV_DIR);
    return;
  }

  // Lazy-load to avoid touching it when coverage is off
  const { default: MCR } = await import("monocart-coverage-reports");

  const files = fs
    .readdirSync(SERVER_COV_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(SERVER_COV_DIR, f));

  if (!files.length) {
    console.log("[coverage] Server V8 dir is empty:", SERVER_COV_DIR);
    return;
  }

  console.log(`[coverage] Merging ${files.length} server V8 file(s) into report`);

  const mcr = new MCR({
    name: "cloudless.gr server",
    outputDir: REPORT_DIR,
    reports: ["v8", "html", "lcov", "console-summary"],
    entryFilter: {
      "**/src/**": true,
      "**/.next/**": false,
      "**/node_modules/**": false,
    },
    sourceFilter: {
      "**/src/**": true,
      "**/node_modules/**": false,
    },
    cleanCache: false, // keep the client coverage already on disk
  });

  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      // Node's NODE_V8_COVERAGE output is { result: [{ scriptId, url, functions }, ...] }
      if (raw.result) {
        await mcr.add(raw.result);
      }
    } catch (err) {
      console.warn(`[coverage] Failed to read ${file}:`, (err as Error).message);
    }
  }

  await mcr.generate();
  console.log(`[coverage] Server coverage merged into ${REPORT_DIR}`);
}
