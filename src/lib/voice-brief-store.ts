import { SSMClient, PutParameterCommand } from "@aws-sdk/client-ssm";

/**
 * Single source of truth for where the weekly voice brief is persisted.
 *
 * History: the original implementation used "/cloudless/VOICE_BRIEF_LATEST"
 * with a default region of eu-central-1 — but production SSM lives in
 * us-east-1 under the /cloudless/production/ prefix. Both writer (cron) and
 * reader (admin route) silently disagreed with the environment, so the
 * persisted parameter was never visible to the reader. The constants here
 * keep them aligned forever.
 */
export const VOICE_BRIEF_SSM_NAME = "/cloudless/production/VOICE_BRIEF_LATEST";

export interface VoiceBriefRecord {
  text: string;
  generatedAt: string;
  week: string;
}

export async function persistVoiceBrief(brief: VoiceBriefRecord): Promise<void> {
  const region = process.env.AWS_REGION || "us-east-1";
  const client = new SSMClient({ region });
  await client.send(
    new PutParameterCommand({
      Name: VOICE_BRIEF_SSM_NAME,
      Value: JSON.stringify(brief),
      Type: "String",
      Overwrite: true,
    })
  );
}
