import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import MCR from "monocart-coverage-reports";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SERVER = path.join(ROOT, ".coverage-v8-server");
const OUT = path.join(ROOT, "coverage", "server-only");

const mcr = new MCR({
  name: "cloudless.gr server coverage",
  outputDir: OUT,
  reports: ["v8", "html", "lcov", "console-summary"],
  entryFilter: { "**/src/**": true, "**/.next/**": false, "**/node_modules/**": false },
  sourceFilter: { "**/src/**": true, "**/node_modules/**": false },
  cleanCache: true,
});

const files = fs.readdirSync(SERVER).filter(f => f.endsWith(".json"));
console.log(`Reading ${files.length} server V8 files`);

let ok = 0, bad = 0, empty = 0;
for (const f of files) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(SERVER, f), "utf8"));
    if (Array.isArray(raw.result) && raw.result.length > 0) {
      await mcr.add(raw.result);
      ok++;
    } else {
      empty++;
    }
  } catch (_) {
    bad++;
  }
}
console.log(`Added: ${ok}, empty: ${empty}, bad: ${bad}`);
await mcr.generate();
