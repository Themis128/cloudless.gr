import { describe, it, expect } from "vitest";

import {
  BEDROCK_REGION,
  BEDROCK_MODEL_ID,
  buildBedrockToolConfig,
  pickToolUseBlocks,
  joinAssistantText,
  runBedrockTurn,
  getBedrockClient,
  type AnyBlock,
} from "@/lib/bedrock-shared";

describe("bedrock-shared (fail-closed stubs + pure helpers)", () => {
  describe("env-driven constants", () => {
    it("BEDROCK_REGION resolves to a non-empty string", () => {
      expect(typeof BEDROCK_REGION).toBe("string");
      expect(BEDROCK_REGION.length).toBeGreaterThan(0);
    });

    it("BEDROCK_MODEL_ID resolves to a non-empty string", () => {
      expect(typeof BEDROCK_MODEL_ID).toBe("string");
      expect(BEDROCK_MODEL_ID.length).toBeGreaterThan(0);
    });
  });

  describe("getBedrockClient", () => {
    it("throws fail-closed — never constructs a Bedrock client", () => {
      expect(() => getBedrockClient()).toThrow(/Bedrock is disabled/i);
    });
  });

  describe("buildBedrockToolConfig", () => {
    it("maps Anthropic-shaped tools to a tool configuration", () => {
      const cfg = buildBedrockToolConfig([
        {
          name: "book_slot",
          description: "Book a 30-min consult slot",
          input_schema: { type: "object", properties: { start: { type: "string" } } },
        },
        {
          name: "search",
          description: "Search docs",
          input_schema: { type: "object" },
        },
      ]);
      expect(cfg.tools).toHaveLength(2);
      const first = cfg.tools?.[0] as { toolSpec: { name: string; description: string } };
      expect(first.toolSpec.name).toBe("book_slot");
      expect(first.toolSpec.description).toBe("Book a 30-min consult slot");
    });

    it("preserves arbitrary input_schema shape under inputSchema.json", () => {
      const schema = { type: "object", required: ["x"], properties: { x: { type: "number" } } };
      const cfg = buildBedrockToolConfig([{ name: "t", description: "d", input_schema: schema }]);
      const first = cfg.tools?.[0] as { toolSpec: { inputSchema: { json: unknown } } };
      expect(first.toolSpec.inputSchema.json).toBe(schema);
    });

    it("returns an empty tools list when given no tools", () => {
      const cfg = buildBedrockToolConfig([]);
      expect(cfg.tools).toEqual([]);
    });
  });

  describe("pickToolUseBlocks", () => {
    it("returns only blocks with a valid toolUse shape", () => {
      const blocks: AnyBlock[] = [
        { text: "hi" } as AnyBlock,
        { toolUse: { toolUseId: "id-1", name: "x", input: {} } } as AnyBlock,
        { toolUse: { toolUseId: "id-2", name: "y", input: { a: 1 } } } as AnyBlock,
        { text: "trailing" } as AnyBlock,
      ];
      const out = pickToolUseBlocks(blocks);
      expect(out).toHaveLength(2);
      expect(out[0].toolUse.toolUseId).toBe("id-1");
    });

    it("returns [] when there are no tool-use blocks", () => {
      expect(pickToolUseBlocks([{ text: "hi" } as AnyBlock])).toEqual([]);
    });

    it("ignores tool-use blocks without a string toolUseId", () => {
      const blocks = [
        // @ts-expect-error — intentionally malformed
        { toolUse: { name: "n", input: {} } } as AnyBlock,
      ];
      expect(pickToolUseBlocks(blocks)).toEqual([]);
    });
  });

  describe("joinAssistantText", () => {
    it("joins and trims text fragments", () => {
      const blocks: AnyBlock[] = [
        { text: "  hello" } as AnyBlock,
        { toolUse: { toolUseId: "id", name: "n", input: {} } } as AnyBlock,
        { text: "world  " } as AnyBlock,
      ];
      expect(joinAssistantText(blocks)).toBe("hello world");
    });

    it("returns empty string when no text blocks present", () => {
      expect(
        joinAssistantText([{ toolUse: { toolUseId: "id", name: "n", input: {} } } as AnyBlock])
      ).toBe("");
    });
  });

  describe("runBedrockTurn", () => {
    it("throws fail-closed — never calls Bedrock", async () => {
      await expect(
        runBedrockTurn({
          system: "be helpful",
          messages: [{ role: "user", content: [{ text: "hi" }] }],
          maxTokens: 100,
        })
      ).rejects.toThrow(/Bedrock is disabled/i);
    });
  });
});
