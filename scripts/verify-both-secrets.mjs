/**
 * Verify the production D1 password hash for tbaltzakis@cloudless.gr
 * against both candidate SESSION_SECRETs to find which one matches.
 */
const PROD_HASH = "zcWuXICZJNoaMdyEO/+JvA==:79d99f782b4175cb3787f54797f3c8e498cde03e2b385e1106d286c21d10f442";
const PASSWORD = "TH!123789th!";

const candidates = {
  "local (.env.local)": "139b7afa639999732c20f5a28e64a3885f8f65e65df3e4d71845434c3c2d96e0",
  "env (.env)": "IhwMRaxLqrJUlzsPVl6+Yz7+w6FCiTiWmL+x7nlLC48=",
};

function encodeHex(uint8) {
  return Buffer.from(uint8).toString("hex");
}

async function verifyPassword(password, storedHash, SESSION_SECRET) {
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

for (const [name, secret] of Object.entries(candidates)) {
  const valid = await verifyPassword(PASSWORD, PROD_HASH, secret);
  console.log(`${name} matches production hash:`, valid ? "✅ YES" : "❌ NO");
}