/**
 * Normalize Google SA credentials for JWT signing (ETL scripts).
 *
 * Online consensus (SO #74131595, Node OpenSSL 3 / GH Actions):
 * 1. Prefer base64(entire service-account JSON) — avoids PEM corruption in secrets.
 * 2. Unescape `\\n` → real newlines (`split(String.raw`\n`).join('\n')`).
 * 3. Repair headers glued after whitespace stripping (`BEGINRSAPRIVATEKEY`).
 * 4. Prefer PKCS#8 (`BEGIN PRIVATE KEY`); export PKCS#8 when PKCS#1 loads.
 */
import { createPrivateKey } from "node:crypto";

function unescapeNewlines(value) {
	return String(value ?? "")
		.split(String.raw`\n`)
		.join("\n")
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.trim();
}

function repairGluedPemHeaders(key) {
	let out = key.replace(/\s+/g, "");
	out = out
		.replace(/-----BEGIN((?:RSA)?PRIVATEKEY)-----/i, (_, kind) => {
			const label = /RSA/i.test(kind) ? "RSA PRIVATE KEY" : "PRIVATE KEY";
			return `-----BEGIN ${label}-----\n`;
		})
		.replace(/-----END((?:RSA)?PRIVATEKEY)-----/i, (_, kind) => {
			const label = /RSA/i.test(kind) ? "RSA PRIVATE KEY" : "PRIVATE KEY";
			return `\n-----END ${label}-----`;
		});
	// Re-wrap body to 64-char lines if we compacted it
	const begin = out.match(/-----BEGIN [^-]+-----/)?.[0];
	const end = out.match(/-----END [^-]+-----/)?.[0];
	if (!begin || !end) return key;
	const body = out
		.replace(begin, "")
		.replace(end, "")
		.replace(/\s+/g, "");
	const lines = body.match(/.{1,64}/g) ?? [body];
	return `${begin}\n${lines.join("\n")}\n${end}`;
}

/**
 * Resolve SA email + PEM from env.
 * Prefers GOOGLE_SERVICE_ACCOUNT_JSON_B64 (base64 of full SA JSON).
 */
export function resolveGoogleServiceAccountFromEnv(env = process.env) {
	const b64 =
		env.GOOGLE_SERVICE_ACCOUNT_JSON_B64?.trim() ||
		env.GOOGLE_SA_JSON_B64?.trim() ||
		"";
	if (b64) {
		const jsonText = Buffer.from(b64, "base64").toString("utf8").trim();
		const parsed = JSON.parse(jsonText);
		const email = String(parsed.client_email ?? "").trim();
		const privateKey = String(parsed.private_key ?? "").trim();
		if (!email || !privateKey) {
			throw new Error(
				"GOOGLE_SERVICE_ACCOUNT_JSON_B64 decoded but missing client_email/private_key"
			);
		}
		return { email, privateKeyRaw: privateKey };
	}

	const email = (env.GOOGLE_CLIENT_EMAIL || env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
	const privateKeyRaw = (env.GOOGLE_PRIVATE_KEY || "").trim();
	if (!email || !privateKeyRaw) {
		throw new Error(
			"Set GOOGLE_SERVICE_ACCOUNT_JSON_B64 (preferred) or GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY"
		);
	}
	return { email, privateKeyRaw };
}

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
				`GOOGLE_PRIVATE_KEY looks like JSON but is invalid: ${
					err instanceof Error ? err.message : String(err)
				}`
			);
		}
	}

	// Quotes from gh secret set / YAML pastes
	if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
		key = key.slice(1, -1).trim();
	}

	key = unescapeNewlines(key);

	// Secret sometimes stored as base64(PEM) or raw PKCS#8 DER base64 (no headers)
	if (!/-----BEGIN (RSA )?PRIVATE KEY-----/.test(key)) {
		const compact = key.replace(/\s+/g, "");
		if (/^[A-Za-z0-9+/=]+$/.test(compact) && compact.length > 80) {
			try {
				const decoded = Buffer.from(compact, "base64").toString("utf8").trim();
				if (/-----BEGIN (RSA )?PRIVATE KEY-----/.test(decoded)) {
					key = decoded
						.replace(/\\\\n/g, "\n")
						.replace(/\\n/g, "\n")
						.replace(/\r\n/g, "\n")
						.replace(/\r/g, "\n")
						.trim();
				} else {
					// Treat as DER → wrap as PKCS#8 PEM
					const lines = compact.match(/.{1,64}/g) ?? [compact];
					key = `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----`;
				}
			} catch {
				/* keep raw */
			}
		}
	}

	if (!/-----BEGIN (RSA )?PRIVATE KEY-----/.test(key)) {
		throw new Error(
			"GOOGLE_PRIVATE_KEY must be a PEM private key (-----BEGIN PRIVATE KEY----- or -----BEGIN RSA PRIVATE KEY-----). Prefer GOOGLE_SERVICE_ACCOUNT_JSON_B64=base64(entire SA JSON)."
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
		const keyObject = createPrivateKey({ key: pem, format: "pem" });
		// Normalize to PKCS#8 for OpenSSL 3 / jose consumers
		return createPrivateKey({
			key: keyObject.export({ type: "pkcs8", format: "pem" }),
			format: "pem",
		});
	} catch (err) {
		const header = pem.match(/-----BEGIN [^-]+-----/)?.[0] ?? "unknown-header";
		throw new Error(
			`GOOGLE_PRIVATE_KEY PEM rejected by Node (${header}): ${
				err instanceof Error ? err.message : String(err)
			}. Convert with: openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in key.pem -out key.pkcs8.pem`
		);
	}
}
