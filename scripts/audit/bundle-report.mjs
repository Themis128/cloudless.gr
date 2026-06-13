#!/usr/bin/env node
/**
 * Bundle size report.
 *
 * Walks .next/static and reports total JS+CSS, top-10 biggest chunks, and
 * per-route page sizes (from .next/build-manifest.json + Next 16 route
 * group analysis).
 *
 * Outputs JSON + Markdown. Consumed by audits-aggregator.yml.
 */

import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const args = process.argv.slice(2);
let outJson = null;
let outMd = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--out") outJson = args[++i];
  else if (args[i] === "--md") outMd = args[++i];
}

const NEXT_DIR = ".next";
const STATIC_DIR = `${NEXT_DIR}/static`;

async function walk(dir, files = []) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, files);
    } else {
      try {
        const st = await stat(full);
        files.push({ path: full, size: st.size });
      } catch {
        /* race during build */
      }
    }
  }
  return files;
}

const all = await walk(STATIC_DIR);
const jsFiles = all.filter((f) => f.path.endsWith(".js"));
const cssFiles = all.filter((f) => f.path.endsWith(".css"));

function total(list) {
  return list.reduce((acc, f) => acc + f.size, 0);
}

const summary = {
  generatedAt: new Date().toISOString(),
  totals: {
    jsBytes: total(jsFiles),
    cssBytes: total(cssFiles),
    totalBytes: total(jsFiles) + total(cssFiles),
    fileCount: jsFiles.length + cssFiles.length,
  },
  topChunks: [...jsFiles, ...cssFiles].sort((a, b) => b.size - a.size).slice(0, 10).map((f) => ({
    path: f.path,
    bytes: f.size,
    kb: Math.round(f.size / 1024),
  })),
};

// Pull build-manifest.json for per-route page sizes
try {
  const manifest = JSON.parse(await readFile(`${NEXT_DIR}/build-manifest.json`, "utf8"));
  const pages = manifest.pages ?? {};
  const perRoute = [];
  for (const [route, chunks] of Object.entries(pages)) {
    let bytes = 0;
    for (const c of chunks) {
      const match = all.find((f) => f.path.endsWith(c));
      if (match) bytes += match.size;
    }
    perRoute.push({ route, bytes, kb: Math.round(bytes / 1024) });
  }
  summary.perRoute = perRoute.sort((a, b) => b.bytes - a.bytes).slice(0, 30);
} catch {
  summary.perRoute = [];
}

function kb(n) {
  return `${Math.round(n / 1024)}KB`;
}

if (outJson) {
  await writeFile(outJson, JSON.stringify(summary, null, 2));
  console.log(`JSON → ${outJson}`);
}

if (outMd) {
  const lines = [];
  lines.push("## 📦 Bundle Size Report");
  lines.push("");
  lines.push(
    `Total: **${kb(summary.totals.totalBytes)}**  (JS: ${kb(summary.totals.jsBytes)}, CSS: ${kb(summary.totals.cssBytes)}) across ${summary.totals.fileCount} files`,
  );
  lines.push("");
  lines.push("### Top 10 chunks");
  lines.push("");
  lines.push("| Chunk | Size |");
  lines.push("|-------|------|");
  for (const c of summary.topChunks) {
    lines.push(`| \`${c.path.replace(/^\.next\/static\//, "")}\` | ${c.kb}KB |`);
  }
  if (summary.perRoute && summary.perRoute.length > 0) {
    lines.push("");
    lines.push("### Top 15 routes by size");
    lines.push("");
    lines.push("| Route | Size |");
    lines.push("|-------|------|");
    for (const r of summary.perRoute.slice(0, 15)) {
      lines.push(`| \`${r.route}\` | ${r.kb}KB |`);
    }
  }
  await writeFile(outMd, lines.join("\n") + "\n");
  console.log(`Markdown → ${outMd}`);
}
