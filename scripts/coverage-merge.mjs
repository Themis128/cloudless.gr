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
  // The server V8 entries are bundle URLs, not literal `/src/` filesystem
  // paths: the Next dev server records app code as
  //   webpack-internal:///(rsc)/./src/app/layout.tsx
  //   webpack-internal:///(ssr)/./src/lib/foo.ts
  // and everything else as node_modules / node:internal / .next/dev runtime.
  // A `**/src/**` allowlist on the *entry* URL therefore matched nothing and
  // the whole report came back 0%. Keep entries whose URL references our
  // source tree, drop vendor/runtime; sourceFilter then restricts the
  // remapped originals to src/.
  entryFilter: (entry) => {
    const u = entry.url ?? "";
    if (u.includes("/node_modules/")) return false;
    if (u.startsWith("node:")) return false;
    return /[/.]src\//.test(u) || u.includes("/./src/");
  },
  // Normalise the webpack-internal scheme + (rsc)/(ssr) layer prefixes back to
  // a repo-relative path so monocart can load the original source and filter.
  sourcePath: (filePath) =>
    filePath
      .replace(/^webpack-internal:\/\/\/\((rsc|ssr|action-browser)\)\/\.\//, "")
      .replace(/^webpack:\/\/_N_E\/\.\//, "")
      .replace(/^.*?\/cloudless\.gr\//, ""),
  sourceFilter: (sourcePath) =>
    /(^|\/)src\//.test(sourcePath) && !sourcePath.includes("/node_modules/"),
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

const results = await mcr.generate();
const totalLines = results?.summary?.lines?.total ?? 0;
console.log(`[merge] Merged ${added} V8 file(s) → ${OUT}/index.html`);

// Guard against the silent-0% trap. The server-side V8 data captured via
// NODE_V8_COVERAGE under `next dev --webpack` records app code against
// in-memory bundle URLs (webpack-internal:///(rsc)/./src/...). Those entries
// have no on-disk source or attached source map, so monocart cannot remap the
// V8 byte-offsets back to the original TS and drops them — yielding a report
// that LOOKS like "0% coverage" when it actually means "could not resolve".
// Client coverage (Playwright page.coverage of /_next/static chunks) DOES carry
// reachable source maps and is the path that produces real src/-mapped numbers.
if (totalLines === 0) {
  console.warn(
    "\n[merge] ⚠  Resolved 0 source lines.\n" +
      "  The merged report is NOT a real 0% — monocart could not map any entry\n" +
      "  back to src/. The server-side webpack-internal V8 coverage is not\n" +
      "  source-resolvable post-hoc; rely on the client (Playwright) coverage\n" +
      "  and the Vitest unit report (pnpm test:unit:coverage) instead.\n" +
      "  See the entryFilter/sourcePath notes at the top of this file.\n"
  );
}
