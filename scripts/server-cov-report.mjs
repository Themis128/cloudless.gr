import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import MCR from "monocart-coverage-reports";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, ".coverage-v8-server");
const OUT = path.join(ROOT, "coverage", "server");

const mcr = new MCR({
  name: "cloudless.gr server (webpack)",
  outputDir: OUT,
  reports: ["v8", "html", "lcov", "console-summary"],
  entryFilter: { "**/src/**": true, "**/.next/**": false, "**/node_modules/**": false },
  sourceFilter: { "**/src/**": true, "**/node_modules/**": false },
  cleanCache: true,
});

const files = fs.readdirSync(SRC).filter(f => f.endsWith(".json"));
console.log(`Reading ${files.length} files`);

let ok = 0;
for (const f of files) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8"));
    if (Array.isArray(raw.result) && raw.result.length > 0) {
      await mcr.add(raw.result);
      ok++;
    }
  } catch {}
}
console.log(`Added: ${ok}`);
await mcr.generate();
