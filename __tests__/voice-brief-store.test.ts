import { describe, it, expect, beforeEach } from "vitest";
import { resetJsonConfigMemory } from "@/lib/app-config-json";

describe("voice-brief-store", () => {
  beforeEach(() => {
    resetJsonConfigMemory();
  });

  it("VOICE_BRIEF_SSM_NAME is alias of VOICE_BRIEF_CONFIG_KEY", async () => {
    const mod = await import("@/lib/voice-brief-store");
    expect(mod.VOICE_BRIEF_CONFIG_KEY).toBe("VOICE_BRIEF_LATEST");
    expect(mod.VOICE_BRIEF_SSM_NAME).toBe(mod.VOICE_BRIEF_CONFIG_KEY);
  });

  it("persistVoiceBrief writes JSON to app_config memory", async () => {
    const { persistVoiceBrief, readVoiceBrief } = await import("@/lib/voice-brief-store");
    await persistVoiceBrief({
      text: "weekly highlights",
      generatedAt: "2026-06-12T21:00:00Z",
      week: "2026-W24",
    });
    const stored = await readVoiceBrief();
    expect(stored).toEqual({
      text: "weekly highlights",
      generatedAt: "2026-06-12T21:00:00Z",
      week: "2026-W24",
    });
  });

  it("readVoiceBrief returns null when nothing is stored", async () => {
    const { readVoiceBrief } = await import("@/lib/voice-brief-store");
    await expect(readVoiceBrief()).resolves.toBeNull();
  });

  it("persistVoiceBrief overwrites an existing brief", async () => {
    const { persistVoiceBrief, readVoiceBrief } = await import("@/lib/voice-brief-store");
    await persistVoiceBrief({
      text: "first",
      generatedAt: "2026-06-12T21:00:00Z",
      week: "2026-W24",
    });
    await persistVoiceBrief({
      text: "updated",
      generatedAt: "2026-06-13T21:00:00Z",
      week: "2026-W25",
    });
    const stored = await readVoiceBrief();
    expect(stored?.text).toBe("updated");
    expect(stored?.week).toBe("2026-W25");
  });
});
