import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";
const EXTENSIONS = new Set([".tsx", ".ts"]);
const FORBIDDEN = [/\bRead more\b/i, /\bLearn more\b/i, /\bClick here\b/i, />\s*here\s*</i];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) out.push(...walk(abs));
    else if (EXTENSIONS.has(abs.slice(abs.lastIndexOf(".")))) out.push(abs);
  }
  return out;
}

const offenders = [];
for (const file of walk(ROOT)) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const pattern of FORBIDDEN) {
      if (pattern.test(line)) {
        offenders.push(`${file}:${i + 1}: ${line.trim()}`);
        break;
      }
    }
  });
}

if (offenders.length > 0) {
  console.error("Found generic/non-descriptive link text:");
  for (const o of offenders) console.error(`- ${o}`);
  process.exit(1);
}

console.log("No generic link text found.");
