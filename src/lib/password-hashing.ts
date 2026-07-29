/**
 * Shared password hashing for D1 auth (Workers-compatible Web Crypto PBKDF2).
 * Format: `${base64Salt}:${hexDerivedBits}` — also verifies legacy SHA-256 hashes.
 */

const ITERATIONS = 100_000;

function sessionPepper(): string {
  return process.env.SESSION_SECRET || "";
}

function encodeHex(uint8: Uint8Array): string {
  return Array.from(uint8, (b) => b.toString(16).padStart(2, "0")).join("");
}

function encodeBase64(uint8: Uint8Array): string {
  return btoa(Array.from(uint8, (b) => String.fromCharCode(b)).join(""));
}

function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return encodeBase64(bytes);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const encoder = new TextEncoder();
  const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password + sessionPepper()),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return `${salt}:${encodeHex(new Uint8Array(derivedBits))}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) {
    // Legacy SHA-256 (password + SESSION_SECRET) without salt
    const encoder = new TextEncoder();
    const data = encoder.encode(password + sessionPepper());
    const legacyHash = await crypto.subtle.digest("SHA-256", data);
    return encodeHex(new Uint8Array(legacyHash)) === storedHash;
  }

  const encoder = new TextEncoder();
  const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password + sessionPepper()),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  return `${salt}:${encodeHex(new Uint8Array(derivedBits))}` === storedHash;
}
