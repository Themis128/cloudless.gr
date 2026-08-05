/**
 * Ensure tbaltzakis@cloudless.gr has the admin role in local D1.
 * The user already exists (created by a prior run); this adds the role.
 */
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { readdirSync } from "node:fs";

const D1_DIR = join(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const files = readdirSync(D1_DIR).filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
if (files.length === 0) {
  console.error("No local D1 sqlite found");
  process.exit(1);
}
const dbPath = join(D1_DIR, files[0]);
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA busy_timeout = 5000;");
// The local schema has a broken FK: user_role.user_id -> user_old (a table
// that no longer exists after a migration rename). Disable FK enforcement so
// role inserts work.
db.exec("PRAGMA foreign_keys = OFF;");

const EMAIL = "tbaltzakis@cloudless.gr";

const user = db.prepare("SELECT id FROM user WHERE email = ?").get(EMAIL);
if (!user) {
  console.error("User not found:", EMAIL);
  process.exit(1);
}

// Add both 'user' and 'admin' roles
try {
  db.prepare("INSERT OR IGNORE INTO user_role (user_id, role) VALUES (?, 'user')").run(user.id);
  db.prepare("INSERT OR IGNORE INTO user_role (user_id, role) VALUES (?, 'admin')").run(user.id);
  console.log("Roles added for", EMAIL);
} catch (e) {
  console.error("Error adding roles:", e.message);
  process.exit(1);
}

// Verify
const roles = db.prepare("SELECT role FROM user_role WHERE user_id = ?").all(user.id);
console.log("Roles:", roles.map((r) => r.role));
db.close();