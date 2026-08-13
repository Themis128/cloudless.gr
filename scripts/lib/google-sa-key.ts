/**
 * Normalize Google service-account private keys for JWT signing.
 *
 * GH Actions / k8s secrets often store PEMs with escaped newlines, wrapping
 * quotes, PKCS#1 (`BEGIN RSA PRIVATE KEY`), or the whole SA JSON. jose's
 * `importPKCS8` only accepts PKCS#8 — Node `createPrivateKey` accepts both.
 */
import { createPrivateKey, type KeyObject } from "node:crypto";

export function normalizeGooglePrivateKeyPem(raw: string): string {
  let key = raw.trim();
  if (!key) {
    throw new Error("GOOGLE_PRIVATE_KEY is empty");
  }

  // Whole service-account JSON pasted into the secret
  if (key.startsWith("{")) {
    try {
      const parsed = JSON.parse(key) as { private_key?: unknown };
      if (typeof parsed.private_key !== "string" || !parsed.private_key.trim()) {
        throw new Error("JSON has no private_key string");
      }
      key = parsed.private_key.trim();
    } catch (err) {
      throw new Error(
        `GOOGLE_PRIVATE_KEY looks like JSON but is invalid: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  // Quotes from gh secret set / YAML pastes
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }

  key = key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  if (!/-----BEGIN (RSA )?PRIVATE KEY-----/.test(key)) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY must be a PEM private key (-----BEGIN PRIVATE KEY----- or -----BEGIN RSA PRIVATE KEY-----)"
    );
  }
  if (key.length < 200) {
    throw new Error(
      `GOOGLE_PRIVATE_KEY looks truncated (length=${key.length}; need a full PEM ≥200 chars)`
    );
  }
  return key;
}

/** Load a signing key for Google SA JWTs (PKCS#8 or PKCS#1 PEM). */
export function loadGooglePrivateKey(raw: string): KeyObject {
  const pem = normalizeGooglePrivateKeyPem(raw);
  try {
    return createPrivateKey({ key: pem, format: "pem" });
  } catch (err) {
    const header = pem.match(/-----BEGIN [^-]+-----/)?.[0] ?? "unknown-header";
    throw new Error(
      `GOOGLE_PRIVATE_KEY PEM rejected by Node (${header}): ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}
