/**
 * Input validators for the cloudless-infra MCP write tools.
 *
 * These guards run BEFORE any shell command is built, so a regression here
 * could exfiltrate a value into ps, push to a protected branch, or accept
 * a name GitHub would later reject. Lock the regexes here.
 */
import { describe, it, expect } from "vitest";
import {
  isValidSecretName,
  isPlainBase64,
  isClaudeBranch,
  resolveSsmName,
} from "../tools/ssh-mcp/src/validators";

describe("isValidSecretName", () => {
  it.each(["ANTHROPIC_API_KEY", "STRIPE_WEBHOOK_SECRET", "X1", "AI_GENERATE_SECRET", "A_B_C_D"])(
    "accepts %s",
    (name) => {
      expect(isValidSecretName(name)).toBe(true);
    }
  );

  it.each([
    "", // empty
    "lowercase", // not uppercase
    "1LEADING", // starts with digit
    "WITH SPACE", // space
    "WITH-DASH", // dash
    "WITH.DOT", // dot
    "_LEADING", // underscore lead
    "Mixed", // mixed case
  ])("rejects %s", (name) => {
    expect(isValidSecretName(name)).toBe(false);
  });
});

describe("isPlainBase64", () => {
  it("accepts a plain base64-encoded payload", () => {
    const b64 = Buffer.from("hello world").toString("base64");
    expect(isPlainBase64(b64)).toBe(true);
  });

  it("accepts padded base64", () => {
    expect(isPlainBase64("YWJjZA==")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isPlainBase64("")).toBe(false);
  });

  it.each([
    "abc def", // whitespace inside
    "abc\ndef", // newline (`base64` without -w0)
    "abc-def_ghi=", // URL-safe base64 (not what `base64 -d` expects)
    "abc#def", // bogus char
  ])("rejects malformed value %j", (val) => {
    expect(isPlainBase64(val)).toBe(false);
  });
});

describe("isClaudeBranch", () => {
  it.each([
    "claude/fix-newsletter-pipeline",
    "claude/infra-mcp-write-tools",
    "claude/feature_v2",
    "claude/x.y.z",
  ])("accepts %s", (name) => {
    expect(isClaudeBranch(name)).toBe(true);
  });

  it.each([
    "main", // protected
    "release/1.0", // non-claude prefix
    "claude", // bare prefix
    "claude/", // empty topic
    "claude/-leading-dash", // weird first char
    "claude/with space", // space in topic
    "feature/x", // wrong prefix
  ])("rejects %s", (name) => {
    expect(isClaudeBranch(name)).toBe(false);
  });
});

describe("resolveSsmName", () => {
  it("prefixes short names with /cloudless/production/", () => {
    expect(resolveSsmName("AI_GENERATE_SECRET")).toBe("/cloudless/production/AI_GENERATE_SECRET");
  });

  it("leaves absolute paths untouched", () => {
    expect(resolveSsmName("/cloudless/staging/X")).toBe("/cloudless/staging/X");
  });
});
