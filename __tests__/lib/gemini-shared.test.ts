/**
 * Tests for src/lib/gemini-shared.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GEMINI_MODEL_ID,
  getGeminiApiKey,
  isGeminiConfigured,
  generateGeminiResponse,
  extractFunctionCalls,
} from "@/lib/gemini-shared";

type MockFetch = ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  delete process.env.GEMINI_API_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GEMINI_API_KEY;
});

function makeApiResponse(text: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(text),
    json: () =>
      Promise.resolve({
        candidates: [{ content: { parts: [{ text }] } }],
      }),
  };
}

describe("GEMINI_MODEL_ID", () => {
  it("is a non-empty string", () => {
    expect(typeof GEMINI_MODEL_ID).toBe("string");
    expect(GEMINI_MODEL_ID.length).toBeGreaterThan(0);
  });
});

describe("getGeminiApiKey", () => {
  it("returns undefined when env var is not set", () => {
    expect(getGeminiApiKey()).toBeUndefined();
  });

  it("returns the API key from env", () => {
    process.env.GEMINI_API_KEY = "my-api-key";
    expect(getGeminiApiKey()).toBe("my-api-key");
  });
});

describe("isGeminiConfigured", () => {
  it("returns false when GEMINI_API_KEY is not set", () => {
    expect(isGeminiConfigured()).toBe(false);
  });

  it("returns true when GEMINI_API_KEY is set", () => {
    process.env.GEMINI_API_KEY = "key-123";
    expect(isGeminiConfigured()).toBe(true);
  });
});

describe("generateGeminiResponse", () => {
  it("throws when GEMINI_API_KEY is not configured", async () => {
    await expect(
      generateGeminiResponse([{ role: "user", content: "Hello" }])
    ).rejects.toThrow("GEMINI_API_KEY not configured");
  });

  it("returns response text on success", async () => {
    process.env.GEMINI_API_KEY = "key-abc";
    (globalThis.fetch as MockFetch).mockResolvedValue(makeApiResponse("Hello there!"));
    const result = await generateGeminiResponse([{ role: "user", content: "Hi" }]);
    expect(result).toBe("Hello there!");
  });

  it("throws on non-ok response", async () => {
    process.env.GEMINI_API_KEY = "key-abc";
    (globalThis.fetch as MockFetch).mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("Rate limited"),
      json: () => Promise.resolve({}),
    });
    await expect(generateGeminiResponse([{ role: "user", content: "Hi" }])).rejects.toThrow(
      "Gemini API error"
    );
  });

  it("includes system instruction in request body when provided", async () => {
    process.env.GEMINI_API_KEY = "key-abc";
    (globalThis.fetch as MockFetch).mockResolvedValue(makeApiResponse("ok"));
    await generateGeminiResponse([{ role: "user", content: "Q" }], 100, undefined, "Be concise");
    const body = JSON.parse((globalThis.fetch as MockFetch).mock.calls[0][1].body as string);
    expect(body.systemInstruction).toBe("Be concise");
  });

  it("includes tools in request body when provided", async () => {
    process.env.GEMINI_API_KEY = "key-abc";
    (globalThis.fetch as MockFetch).mockResolvedValue(makeApiResponse("ok"));
    const tools = [{ name: "myTool", description: "does stuff", parameters: {} }];
    await generateGeminiResponse([{ role: "user", content: "Q" }], 100, tools);
    const body = JSON.parse((globalThis.fetch as MockFetch).mock.calls[0][1].body as string);
    expect(body.tools).toBeDefined();
    expect(body.tools[0].functionDeclarations[0].name).toBe("myTool");
  });

  it("omits tools field when tools array is empty", async () => {
    process.env.GEMINI_API_KEY = "key-abc";
    (globalThis.fetch as MockFetch).mockResolvedValue(makeApiResponse("ok"));
    await generateGeminiResponse([{ role: "user", content: "Q" }], 100, []);
    const body = JSON.parse((globalThis.fetch as MockFetch).mock.calls[0][1].body as string);
    expect(body.tools).toBeUndefined();
  });

  it("returns empty string when no text in response", async () => {
    process.env.GEMINI_API_KEY = "key-abc";
    (globalThis.fetch as MockFetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ candidates: [] }),
    });
    const result = await generateGeminiResponse([{ role: "user", content: "Hi" }]);
    expect(result).toBe("");
  });

  it("converts model role correctly in request contents", async () => {
    process.env.GEMINI_API_KEY = "key-abc";
    (globalThis.fetch as MockFetch).mockResolvedValue(makeApiResponse("ok"));
    await generateGeminiResponse([
      { role: "user", content: "Q1" },
      { role: "model", content: "A1" },
    ]);
    const body = JSON.parse((globalThis.fetch as MockFetch).mock.calls[0][1].body as string);
    expect(body.contents[0].role).toBe("user");
    expect(body.contents[1].role).toBe("model");
  });
});

describe("extractFunctionCalls", () => {
  it("returns empty array when data has no candidates", () => {
    expect(extractFunctionCalls({})).toEqual([]);
    expect(extractFunctionCalls(null)).toEqual([]);
    expect(extractFunctionCalls({ candidates: [] })).toEqual([]);
  });

  it("extracts function calls from candidates", () => {
    const data = {
      candidates: [
        {
          content: {
            parts: [
              { functionCall: { name: "myFn", args: { x: 1 } } },
            ],
          },
        },
      ],
    };
    const calls = extractFunctionCalls(data);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("myFn");
    expect(calls[0].args).toEqual({ x: 1 });
  });

  it("skips parts without functionCall", () => {
    const data = {
      candidates: [
        {
          content: {
            parts: [{ text: "some text" }, { functionCall: { name: "fn2", args: {} } }],
          },
        },
      ],
    };
    const calls = extractFunctionCalls(data);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("fn2");
  });

  it("skips candidates with no content.parts", () => {
    const data = { candidates: [{ content: {} }, { other: "field" }] };
    expect(extractFunctionCalls(data)).toEqual([]);
  });
});
