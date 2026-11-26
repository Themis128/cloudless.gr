import { describe, it, expect } from "vitest";
import { resolveCallToken, CONSULT_ROOM_TOKEN, TALK_CALL_BASE } from "@/app/[locale]/call/shared";

describe("resolveCallToken", () => {
  it("maps the consult alias to the consult room", () => {
    expect(resolveCallToken("consult")).toBe(CONSULT_ROOM_TOKEN);
  });

  it("maps the video alias to the consult room", () => {
    expect(resolveCallToken("video")).toBe(CONSULT_ROOM_TOKEN);
  });

  it("passes real Talk room tokens through", () => {
    expect(resolveCallToken("zsykkx97")).toBe("zsykkx97");
    expect(resolveCallToken("3294636523")).toBe("3294636523");
  });

  it("treats prototype-property names as plain tokens, not inherited keys", () => {
    // Object.hasOwn guard: these hit TOKEN_RE passthrough (Talk 404s unknown
    // rooms), never an inherited member of the alias map.
    expect(resolveCallToken("toString")).toBe("toString");
    expect(resolveCallToken("constructor")).toBe("constructor");
    expect(resolveCallToken("hasOwnProperty")).toBe("hasOwnProperty");
  });

  it("rejects invalid tokens", () => {
    expect(resolveCallToken("BAD!!token")).toBeNull();
    expect(resolveCallToken("")).toBeNull();
    expect(resolveCallToken("abc")).toBeNull();
    expect(resolveCallToken("a".repeat(31))).toBeNull();
  });

  it("does not alias a token that merely starts with a slug", () => {
    expect(resolveCallToken("consultx")).toBe("consultx");
  });

  it("keeps the Talk base URL stable", () => {
    expect(TALK_CALL_BASE).toBe("https://cloud.cloudless.gr/call");
  });
});
