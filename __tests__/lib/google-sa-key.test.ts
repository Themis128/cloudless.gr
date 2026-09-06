import { describe, it, expect } from "vitest";
import { normalizeGooglePrivateKeyPem } from "@/lib/google-sa-key";

const MINIMAL_VALID_PEM = [
  "-----BEGIN PRIVATE KEY-----",
  "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7o4qne60TB3wo",
  "a".repeat(200),
  "-----END PRIVATE KEY-----",
].join("\n");

describe("normalizeGooglePrivateKeyPem", () => {
  it("throws for empty input", () => {
    expect(() => normalizeGooglePrivateKeyPem("")).toThrow("GOOGLE_PRIVATE_KEY is empty");
  });

  it("throws when PEM header is missing", () => {
    expect(() => normalizeGooglePrivateKeyPem("not-a-pem-key-value-here-just-some-text-without-header-dashes")).toThrow("PEM private key");
  });

  it("throws for invalid JSON input", () => {
    expect(() => normalizeGooglePrivateKeyPem("{invalid json")).toThrow();
  });

  it("throws for JSON without private_key", () => {
    expect(() => normalizeGooglePrivateKeyPem(JSON.stringify({ other_field: "value" }))).toThrow("JSON has no private_key");
  });

  it("converts escaped newlines in a PEM string", () => {
    const withEscapedNewlines = MINIMAL_VALID_PEM.replace(/\n/g, "\\n");
    const result = normalizeGooglePrivateKeyPem(withEscapedNewlines);
    expect(result).toContain("-----BEGIN PRIVATE KEY-----");
  });
});
