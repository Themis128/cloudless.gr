/**
 * Tests for src/lib/langgraph-client.ts
 *
 * langgraph-client.ts is a stub that always throws because
 * @langchain/langgraph-sdk is not installed. Every exported function
 * should throw when called.
 */
import { describe, it, expect } from "vitest";
import {
  getCloudlessAssistant,
  listAssistants,
  createLangGraphThread,
  getLangGraphThread,
  patchLangGraphThread,
  getLangGraphThreadState,
  updateLangGraphThreadState,
  deleteLangGraphThread,
  searchLangGraphThreads,
  getLangGraphThreadHistory,
  streamLangGraphRun,
  createBackgroundRun,
  joinRunStream,
} from "@/lib/langgraph-client";

const ERR = "@langchain/langgraph-sdk is not installed";

describe("langgraph-client stub", () => {
  it("getCloudlessAssistant throws", async () => {
    await expect(getCloudlessAssistant()).rejects.toThrow(ERR);
  });

  it("listAssistants throws", async () => {
    await expect(listAssistants()).rejects.toThrow(ERR);
  });

  it("createLangGraphThread throws", async () => {
    await expect(createLangGraphThread()).rejects.toThrow(ERR);
  });

  it("getLangGraphThread throws", async () => {
    await expect(getLangGraphThread()).rejects.toThrow(ERR);
  });

  it("patchLangGraphThread throws", async () => {
    await expect(patchLangGraphThread()).rejects.toThrow(ERR);
  });

  it("getLangGraphThreadState throws", async () => {
    await expect(getLangGraphThreadState()).rejects.toThrow(ERR);
  });

  it("updateLangGraphThreadState throws", async () => {
    await expect(updateLangGraphThreadState()).rejects.toThrow(ERR);
  });

  it("deleteLangGraphThread throws", async () => {
    await expect(deleteLangGraphThread()).rejects.toThrow(ERR);
  });

  it("searchLangGraphThreads throws", async () => {
    await expect(searchLangGraphThreads()).rejects.toThrow(ERR);
  });

  it("getLangGraphThreadHistory throws", async () => {
    await expect(getLangGraphThreadHistory()).rejects.toThrow(ERR);
  });

  it("streamLangGraphRun throws", async () => {
    await expect(streamLangGraphRun()).rejects.toThrow(ERR);
  });

  it("createBackgroundRun throws", async () => {
    await expect(createBackgroundRun()).rejects.toThrow(ERR);
  });

  it("joinRunStream throws", async () => {
    await expect(joinRunStream()).rejects.toThrow(ERR);
  });
});
