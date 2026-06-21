import fs from "fs";
import path from "path";
import MCR from "monocart-coverage-reports";

const ROOT = "/home/tbaltzakis/code/cloudless.gr";
const ATT = path.join(ROOT, "monocart-report", "attachments");
const OUT = path.join(ROOT, "coverage", "final");

const mcr = new MCR({
  name: "cloudless.gr — full coverage",
  outputDir: OUT,
  reports: ["v8", "html", "lcov", "console-summary", "console-details"],
  entryFilter: { "**/src/**": true, "**/.next/**": false, "**/node_modules/**": false },
  sourceFilter: { "**/src/**": true, "**/node_modules/**": false },
  cleanCache: true,
});

const files = fs.readdirSync(ATT).filter(f => f.endsWith(".json"));
console.log(`Adding ${files.length} attachment files`);

let ok = 0, empty = 0, bad = 0;
for (const f of files) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(ATT, f), "utf8"));
    if (Array.isArray(raw) && raw.length > 0) {
      await mcr.add(raw);
      ok++;
    } else if (Array.isArray(raw.result) && raw.result.length > 0) {
      await mcr.add(raw.result);
      ok++;
    } else {
      empty++;
    }
  } catch (_) { bad++; }
}
console.log(`Added: ${ok}, empty: ${empty}, bad: ${bad}`);
await mcr.generate();
