import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { readdirSync } from "node:fs";

const D1_DIR = join(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const files = readdirSync(D1_DIR).filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
const dbPath = join(D1_DIR, files[0]);
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA busy_timeout = 5000;");

console.log("=== ALL triggers ===");
const trig = db.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger'").all();
for (const t of trig) {
  console.log(`\n--- ${t.name} (on ${t.tbl_name}) ---`);
  console.log(t.sql);
}

console.log("\n=== ALL views ===");
const views = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='view'").all();
for (const v of views) {
  console.log(`\n--- ${v.name} ---`);
  console.log(v.sql);
}

console.log("\n=== user_role foreign keys ===");
try {
  const fks = db.prepare("PRAGMA foreign_key_list(user_role)").all();
  console.log(fks);
} catch (e) {
  console.log("Error:", e.message);
}

console.log("\n=== user foreign keys ===");
try {
  const fks = db.prepare("PRAGMA foreign_key_list(user)").all();
  console.log(fks);
} catch (e) {
  console.log("Error:", e.message);
}

db.close();