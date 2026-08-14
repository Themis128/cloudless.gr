import { describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import {
  loadGooglePrivateKey,
  normalizeGooglePrivateKeyPem,
} from "@/lib/google-sa-key";

function samplePkcs8Pem(): string {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

function samplePkcs1Pem(): string {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return privateKey.export({ type: "pkcs1", format: "pem" }).toString();
}

describe("normalizeGooglePrivateKeyPem", () => {
  it("unescapes literal \\n sequences", () => {
    const pem = samplePkcs8Pem();
    const escaped = pem.replace(/\n/g, "\\n");
    const out = normalizeGooglePrivateKeyPem(escaped);
    expect(out).toContain("-----BEGIN PRIVATE KEY-----");
    expect(out).toContain("\n");
    expect(out).not.toContain("\\n");
  });

  it("strips wrapping double quotes", () => {
    const pem = samplePkcs8Pem();
    const quoted = `"${pem.replace(/\n/g, "\\n")}"`;
    expect(normalizeGooglePrivateKeyPem(quoted)).toContain("BEGIN PRIVATE KEY");
  });

  it("extracts private_key from service-account JSON", () => {
    const pem = samplePkcs8Pem();
    const json = JSON.stringify({
      type: "service_account",
      private_key: pem,
      client_email: "bot@example.iam.gserviceaccount.com",
    });
    expect(normalizeGooglePrivateKeyPem(json)).toBe(pem.trim());
  });

  it("decodes a base64-encoded PEM blob", () => {
    const pem = samplePkcs8Pem();
    const b64 = Buffer.from(pem, "utf8").toString("base64");
    expect(normalizeGooglePrivateKeyPem(b64)).toBe(pem.trim());
  });

  it("rejects truncated keys", () => {
    expect(() =>
      normalizeGooglePrivateKeyPem("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----")
    ).toThrow(/truncated/);
  });
});

describe("loadGooglePrivateKey", () => {
  it("loads PKCS#8 PEM", () => {
    const key = loadGooglePrivateKey(samplePkcs8Pem());
    expect(key.asymmetricKeyType).toBe("rsa");
  });

  it("loads PKCS#1 RSA PEM (jose importPKCS8 would reject this)", () => {
    const key = loadGooglePrivateKey(samplePkcs1Pem());
    expect(key.asymmetricKeyType).toBe("rsa");
  });

  it("loads escaped PKCS#1 from GH-secret style env", () => {
    const escaped = samplePkcs1Pem().replace(/\n/g, "\\n");
    const key = loadGooglePrivateKey(escaped);
    expect(key.type).toBe("private");
  });
});
