/**
 * Verify the production D1 password hash for tbaltzakis@cloudless.gr
 * against the requested password using the local SESSION_SECRET.
 */
const SESSION_SECRET = "139b7afa639999732c20f5a28e64a3885f8f65e65df3e4d71845434c3c2d96e0";
const PASSWORD = "TH!123789th!";
const PROD_HASH = "zcWuXICZJNoaMdyEO/+JvA==:79d99f782b4175cb3787f54797f3c8e498cde03e2b385e1106d286c21d10f442";

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

const valid = await verifyPassword(PASSWORD, PROD_HASH);
console.log("Production hash matches TH!123789th! with local SESSION_SECRET:", valid ? "✅ YES" : "❌ NO");