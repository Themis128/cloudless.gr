import { readJsonConfig, writeJsonConfig } from "@/lib/app-config-json";

/**
 * Weekly voice brief persistence — D1 app_config (Cloudflare-first).
 * Key kept as VOICE_BRIEF_LATEST for continuity with prior SSM name suffix.
 */
export const VOICE_BRIEF_CONFIG_KEY = "VOICE_BRIEF_LATEST";
/** @deprecated alias kept for callers/tests that still import the old name */
export const VOICE_BRIEF_SSM_NAME = VOICE_BRIEF_CONFIG_KEY;

export interface VoiceBriefRecord {
  text: string;
  generatedAt: string;
  week: string;
}

export async function persistVoiceBrief(brief: VoiceBriefRecord): Promise<void> {
  await writeJsonConfig(VOICE_BRIEF_CONFIG_KEY, brief, "Weekly voice brief");
}

export async function readVoiceBrief(): Promise<VoiceBriefRecord | null> {
  const brief = await readJsonConfig<VoiceBriefRecord | null>(VOICE_BRIEF_CONFIG_KEY, null);
  if (!brief || typeof brief !== "object" || !("text" in brief)) return null;
  return brief;
}
