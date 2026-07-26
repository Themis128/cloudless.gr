/** * Voice brief store utilities for managing voice briefs. * Compatibility wrapper for AWS SDK usage in Cloudflare Workers environment. */
export type VoiceBrief = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
};

export function readVoiceBrief(id: string): VoiceBrief | undefined {
  return undefined;
}

export function persistVoiceBrief(brief: VoiceBrief): void {
  // NOOP for type compatibility
}
