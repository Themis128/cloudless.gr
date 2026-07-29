#!/usr/bin/env node
/**
 * Strip @vercel/og Geist `*.ttf.bin` assets from OpenNext output before SST
 * bundles the Worker.
 *
 * History:
 * - Leaving the files → SST/esbuild: "No loader is configured for .bin files"
 * - Deleting the files only → SST: "Could not resolve …Geist-Regular.ttf.bin"
 *
 * Fix: rewrite JS that references `*.bin` to use an empty Uint8Array, then
 * delete the binary files so neither error path triggers. OG image fonts may
 * fall back to defaults; the rest of the site deploys.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".open-next");
if (!fs.existsSync(root)) {
  console.log("[strip-opennext-bin-fonts] no .open-next — skip");
  process.exit(0);
}

/** @type {string[]} */
const bins = [];
/** @type {string[]} */
const codeFiles = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(full);
      continue;
    }
    if (ent.name.endsWith(".bin")) bins.push(full);
    else if (/\.(m?js|cjs)$/.test(ent.name)) codeFiles.push(full);
  }
}

walk(root);

let rewritten = 0;
for (const file of codeFiles) {
  const orig = fs.readFileSync(file, "utf8");
  if (!orig.includes(".bin")) continue;
  let next = orig;
  // CommonJS require("…Geist-Regular.ttf.bin")
  next = next.replace(/require\(\s*(['"`])([^'"`]*\.bin)\1\s*\)/g, "new Uint8Array()");
  // ESM import x from "….bin" / import "….bin"
  next = next.replace(
    /import\s+(?:[\w*{}\s,$]+\s+from\s+)?(['"`])([^'"`]*\.bin)\1\s*;?/g,
    "/* stripped .bin font */ const __binStub = new Uint8Array();",
  );
  // Bare string path leftovers in arrays / maps (less common)
  next = next.replace(/(['"`])([^'"`]*\/[^'"`]*\.bin)\1/g, "$1data:application/octet-stream;base64,$1");
  if (next !== orig) {
    fs.writeFileSync(file, next);
    rewritten += 1;
  }
}

for (const bin of bins) {
  try {
    fs.unlinkSync(bin);
  } catch {
    // ignore
  }
}

console.log(
  `[strip-opennext-bin-fonts] rewritten=${rewritten} code files; deleted=${bins.length} .bin assets`,
);
