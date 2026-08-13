/**
 * Normalize Google SA private keys for JWT signing (ETL scripts).
 * Mirrors src/lib/google-sa-key.ts for plain .mjs consumers.
 */
import { createPrivateKey } from "node:crypto";

export function normalizeGooglePrivateKeyPem(raw) {
	let key = String(raw ?? "").trim();
	if (!key) {
		throw new Error("GOOGLE_PRIVATE_KEY is empty");
	}

	// Whole service-account JSON pasted into the secret
	if (key.startsWith("{")) {
		try {
			const parsed = JSON.parse(key);
			if (typeof parsed.private_key !== "string" || !parsed.private_key.trim()) {
				throw new Error("JSON has no private_key string");
			}
			key = parsed.private_key.trim();
		} catch (err) {
			throw new Error(
				`GOOGLE_PRIVATE_KEY looks like JSON but is invalid: ${err instanceof Error ? err.message : String(err)}`
			);
		}
	}

	// Quotes from gh secret set / YAML pastes
	if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
		key = key.slice(1, -1).trim();
	}

	// Double-escaped newlines from nested secret stores
	key = key
		.replace(/\\\\n/g, "\n")
		.replace(/\\n/g, "\n")
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.trim();

	// Secret sometimes stored as base64(PEM)
	if (!/-----BEGIN (RSA )?PRIVATE KEY-----/.test(key)) {
		try {
			const decoded = Buffer.from(key, "base64").toString("utf8").trim();
			if (/-----BEGIN (RSA )?PRIVATE KEY-----/.test(decoded)) {
				key = decoded
					.replace(/\\\\n/g, "\n")
					.replace(/\\n/g, "\n")
					.replace(/\r\n/g, "\n")
					.replace(/\r/g, "\n")
					.trim();
			}
		} catch {
			/* keep raw */
		}
	}

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

export function loadGooglePrivateKey(raw) {
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
