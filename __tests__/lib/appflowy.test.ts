import { describe, it, expect, vi } from "vitest";

const { mockGetCfg } = vi.hoisted(() => ({ mockGetCfg: vi.fn() }));
vi.mock("@/lib/ssm-config", () => ({ getConfig: mockGetCfg }));

import {
  AppFlowyNotConfiguredError,
  AppFlowyApiError,
  isAppFlowyConfigured,
  extractDocText,
  markdownToHtml,
} from "@/lib/appflowy";

mockGetCfg.mockResolvedValue({ APPFLOWY_API_URL: "", APPFLOWY_JWT_SECRET: "" });

describe("AppFlowyNotConfiguredError", () => {
  it("is an Error with the correct name", () => {
    const err = new AppFlowyNotConfiguredError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AppFlowyNotConfiguredError");
  });
});

describe("AppFlowyApiError", () => {
  it("is an Error with status and body", () => {
    const err = new AppFlowyApiError(404, "not found response body");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AppFlowyApiError");
    expect(err.status).toBe(404);
    expect(err.message).toContain("404");
  });
});

describe("isAppFlowyConfigured", () => {
  it("returns false when APPFLOWY_API_URL is not set", async () => {
    const result = await isAppFlowyConfigured();
    expect(result).toBe(false);
  });
});

describe("extractDocText", () => {
  it("returns direct text field when present", async () => {
    const doc = { text: "Hello world" };
    expect(await extractDocText(doc)).toBe("Hello world");
  });

  it("joins content array strings", async () => {
    const doc = { content: ["Line one", "Line two"] };
    expect(await extractDocText(doc)).toBe("Line one\nLine two");
  });

  it("extracts text from content array objects", async () => {
    const doc = { content: [{ text: "Block text" }, "plain"] };
    expect(await extractDocText(doc)).toBe("Block text\nplain");
  });

  it("returns empty string for null/undefined doc", async () => {
    expect(await extractDocText(null)).toBe("");
    expect(await extractDocText(undefined)).toBe("");
  });

  it("returns empty string for empty content array", async () => {
    expect(await extractDocText({ content: [] })).toBe("");
  });
});

describe("markdownToHtml", () => {
  it("converts h1 headings", async () => {
    expect(await markdownToHtml("# Title")).toContain("<h1>Title</h1>");
  });

  it("converts bold text", async () => {
    expect(await markdownToHtml("**bold**")).toContain("<strong>bold</strong>");
  });

  it("converts inline code", async () => {
    expect(await markdownToHtml("`code`")).toContain("<code>code</code>");
  });
});
