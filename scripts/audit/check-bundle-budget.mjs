import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = ".next/static/chunks";
const MAX_KB = Number(process.env.BUNDLE_MAX_KB || "1700");

function size(dir) {
  let total = 0;
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const stat = statSync(abs);
    total += stat.isDirectory() ? size(abs) : stat.size;
  }
  return total;
}

const totalKb = Math.round(size(ROOT) / 1024);
console.log(`Static chunks size: ${totalKb}KB (budget ${MAX_KB}KB)`);
if (totalKb > MAX_KB) {
  console.error(`Bundle budget exceeded by ${totalKb - MAX_KB}KB`);
  process.exit(1);
}
