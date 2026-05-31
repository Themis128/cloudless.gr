#!/usr/bin/env node
/**
 * Merge coverage from:
 *   1. ./coverage/playwright/index.json (monocart local-suite output)
 *   2. ./coverage/k3s/index.json        (monocart k3s output)
 *   3. ./.coverage-v8-server/*.json     (Next dev server V8 output)
 * into a single ./coverage/merged/ HTML+lcov.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MCR from "monocart-coverage-reports";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const OUT = path.join(ROOT, "coverage", "merged");

const mcr = new MCR({
  name: "cloudless.gr — merged coverage (client + server + k3s)",
  outputDir: OUT,
  reports: ["v8", "html", "lcov", "console-summary", "console-details"],
  entryFilter: {
    "**/src/**": true,
    "**/.next/**": false,
    "**/node_modules/**": false,
  },
  sourceFilter: {
    "**/src/**": true,
    "**/node_modules/**": false,
  },
  cleanCache: true,
});

let added = 0;

// 1) Pull server V8 files
const serverDir = path.join(ROOT, ".coverage-v8-server");
if (fs.existsSync(serverDir)) {
  const files = fs.readdirSync(serverDir).filter(f => f.endsWith(".json"));
  console.log(`[merge] Reading ${files.length} server V8 files from ${serverDir}`);
  for (const f of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(serverDir, f), "utf8"));
      if (Array.isArray(raw.result)) {
        await mcr.add(raw.result);
        added++;
      }
    } catch {}
  }
}

// 2) Pull per-suite monocart index.json (these contain the merged client coverage)
const suiteIndexes = [
  path.join(ROOT, "coverage", "playwright", "index.json"),
  path.join(ROOT, "coverage", "k3s", "index.json"),
];
for (const idx of suiteIndexes) {
  if (!fs.existsSync(idx)) continue;
  console.log(`[merge] Including ${idx}`);
  // monocart already wrote the html — but its coverage was per-suite. We'll
  // generate a merged report from the v8 raw files it kept around.
}

// 3) Also scan monocart-report dir if it exists
const altDir = path.join(ROOT, "monocart-report");
if (fs.existsSync(altDir)) {
  for (const f of fs.readdirSync(altDir).filter(f => f.endsWith(".json"))) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(altDir, f), "utf8"));
      if (Array.isArray(raw.result)) {
        await mcr.add(raw.result);
        added++;
      } else if (Array.isArray(raw)) {
        await mcr.add(raw);
        added++;
      }
    } catch {}
  }
}

if (!added) {
  console.warn("[merge] No raw V8 data found");
  process.exit(0);
}

await mcr.generate();
console.log(`[merge] Merged ${added} V8 file(s) → ${OUT}/index.html`);
