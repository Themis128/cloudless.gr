#!/usr/bin/env node
/**
 * Keep Cloudflare Workers Free (3 MiB gzip) by removing @vercel/og WASM /
 * edge chunks from OpenNext output after build.
 *
 * Dynamic ImageResponse at the edge is disabled; pre-rendered opengraph-image
 * assets under .open-next/assets still serve. Community approach:
 * https://github.com/vercel/next.js/discussions/93157
 * https://hoangtaiki.com/blog/optimizing-nextjs-bundle-performance-cloudflare
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".open-next");
if (!fs.existsSync(root)) {
  console.log("[strip-opennext-vercel-og] no .open-next — skip");
  process.exit(0);
}

/** @type {string[]} */
const targets = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(full);
      continue;
    }
    const lower = ent.name.toLowerCase();
    if (
      lower.endsWith(".wasm") ||
      lower.includes("resvg") ||
      lower.includes("yoga") ||
      /geist.*\.ttf(\.bin)?$/i.test(lower) ||
      lower === "index.edge.js"
    ) {
      // Only touch OG-related paths
      if (
        full.includes(`${path.sep}@vercel${path.sep}og`) ||
        full.includes(`${path.sep}compiled${path.sep}@vercel${path.sep}og`) ||
        lower.endsWith(".wasm") ||
        lower.endsWith(".ttf.bin") ||
        lower.endsWith(".ttf")
      ) {
        targets.push(full);
      }
    }
  }
}

walk(root);

let deleted = 0;
for (const file of targets) {
  try {
    fs.unlinkSync(file);
    deleted += 1;
  } catch {
    // ignore
  }
}

/** Rewrite handler / worker to skip edge OG redirects (Discussion #93157). */
const patches = [
  {
    name: "node→edge OG redirect → empty",
    from: 'id==="next/dist/compiled/@vercel/og/index.node.js"?raw=await import("next/dist/compiled/@vercel/og/index.edge.js"):raw=await import(id)',
    to: 'id==="next/dist/compiled/@vercel/og/index.node.js"?raw={}:raw=await import(id)',
  },
  {
    name: "quoted edge OG import → empty object",
    from: 'await import("next/dist/compiled/@vercel/og/index.edge.js")',
    to: "await Promise.resolve({})",
  },
];

/** @type {string[]} */
const codeFiles = [];
function walkCode(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkCode(full);
      continue;
    }
    if (/\.(m?js|cjs)$/.test(ent.name)) codeFiles.push(full);
  }
}
walkCode(root);

let patchedFiles = 0;
let patchHits = 0;
for (const file of codeFiles) {
  let content = fs.readFileSync(file, "utf8");
  if (!content.includes("@vercel/og") && !content.includes("vercel/og")) continue;
  const before = content;
  for (const patch of patches) {
    if (content.includes(patch.from)) {
      content = content.split(patch.from).join(patch.to);
      patchHits += 1;
      console.log(`[strip-opennext-vercel-og] ${patch.name} → ${path.relative(process.cwd(), file)}`);
    }
  }
  // Drop side-effect imports of compiled OG edge entry
  content = content.replace(
    /import\s+['"]next\/dist\/compiled\/@vercel\/og\/[^'"]+['"];?/g,
    "/* stripped @vercel/og import */",
  );
  if (content !== before) {
    fs.writeFileSync(file, content);
    patchedFiles += 1;
  }
}

console.log(
  `[strip-opennext-vercel-og] deleted=${deleted} assets; patchedFiles=${patchedFiles}; patchHits=${patchHits}`,
);
