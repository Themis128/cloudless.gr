import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockReadJson, mockWriteJson } = vi.hoisted(() => ({
  mockReadJson: vi.fn(),
  mockWriteJson: vi.fn(),
}));

vi.mock("@/lib/app-config-json", () => ({
  readJsonConfig: mockReadJson,
  writeJsonConfig: mockWriteJson,
}));

import {
  VOICE_BRIEF_CONFIG_KEY,
  VOICE_BRIEF_SSM_NAME,
  persistVoiceBrief,
  readVoiceBrief,
  type VoiceBriefRecord,
} from "@/lib/voice-brief-store";

beforeEach(() => {
  mockReadJson.mockReset();
  mockWriteJson.mockReset();
});

describe("constants", () => {
  it("VOICE_BRIEF_CONFIG_KEY is a non-empty string", () => {
    expect(typeof VOICE_BRIEF_CONFIG_KEY).toBe("string");
    expect(VOICE_BRIEF_CONFIG_KEY.length).toBeGreaterThan(0);
  });

  it("VOICE_BRIEF_SSM_NAME is an alias for VOICE_BRIEF_CONFIG_KEY", () => {
    expect(VOICE_BRIEF_SSM_NAME).toBe(VOICE_BRIEF_CONFIG_KEY);
  });
});

describe("persistVoiceBrief", () => {
  it("calls writeJsonConfig with the correct key and data", async () => {
    const record: VoiceBriefRecord = {
      text: "This week in cloud...",
      generatedAt: new Date().toISOString(),
      week: "2026-W36",
    };
    mockWriteJson.mockResolvedValue(undefined);
    await persistVoiceBrief(record);
    expect(mockWriteJson).toHaveBeenCalledWith(VOICE_BRIEF_CONFIG_KEY, record, expect.any(String));
  });
});

describe("readVoiceBrief", () => {
  it("returns null when stored value is null", async () => {
    mockReadJson.mockResolvedValue(null);
    const result = await readVoiceBrief();
    expect(result).toBeNull();
  });

  it("returns null when stored value has no text field", async () => {
    mockReadJson.mockResolvedValue({ generatedAt: "now", week: "2026-W36" });
    const result = await readVoiceBrief();
    expect(result).toBeNull();
  });

  it("returns the brief when valid", async () => {
    const stored: VoiceBriefRecord = {
      text: "Hello from voice brief",
      generatedAt: "2026-09-06T10:00:00Z",
      week: "2026-W36",
    };
    mockReadJson.mockResolvedValue(stored);
    const result = await readVoiceBrief();
    expect(result?.text).toBe("Hello from voice brief");
    expect(result?.week).toBe("2026-W36");
  });
});
