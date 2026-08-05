/**
 * Verify tbaltzakis@cloudless.gr can log in with the stored password hash.
 * Replicates the verifyPassword logic from src/lib/auth-d1.ts.
 */
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { readdirSync } from "node:fs";

const D1_DIR = join(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const files = readdirSync(D1_DIR).filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
const dbPath = join(D1_DIR, files[0]);
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA busy_timeout = 5000;");

const SESSION_SECRET = "139b7afa639999732c20f5a28e64a3885f8f65e65df3e4d71845434c3c2d96e0";
const EMAIL = "tbaltzakis@cloudless.gr";
const PASSWORD = "TH!123789th!";

function encodeHex(uint8) {
  return Buffer.from(uint8).toString("hex");
}

async function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) {
    // Legacy SHA-256
    const data = new TextEncoder().encode(password + SESSION_SECRET);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return encodeHex(new Uint8Array(digest)) === storedHash;
  }
  const saltBytes = Uint8Array.from(Buffer.from(salt, "base64"));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password + SESSION_SECRET),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return `${salt}:${encodeHex(new Uint8Array(derivedBits))}` === storedHash;
}

const user = db.prepare("SELECT * FROM user WHERE email = ?").get(EMAIL);
if (!user) {
  console.error("User NOT FOUND:", EMAIL);
  process.exit(1);
}

console.log("User found:", user.email);
console.log("User ID:", user.id);

const valid = await verifyPassword(PASSWORD, user.password_hash);
console.log("Password verification:", valid ? "✅ PASS" : "❌ FAIL");

const roles = db.prepare("SELECT role FROM user_role WHERE user_id = ?").all(user.id);
console.log("Roles:", roles.map((r) => r.role));
console.log("Is admin:", roles.some((r) => r.role === "admin") ? "✅ YES" : "❌ NO");

db.close();

if (!valid || !roles.some((r) => r.role === "admin")) {
  process.exit(1);
}
console.log("\n✅ tbaltzakis@cloudless.gr is an admin with a working password.");