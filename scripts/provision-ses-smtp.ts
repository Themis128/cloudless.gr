/**
 * Provision SES SMTP credentials for SES transactional email — AWS SDK v3
 * version of scripts/provision-ses-smtp.sh (no AWS CLI needed, just node creds).
 *
 *   pnpm ses:provision        # uses your ambient AWS creds (env / SSO / profile)
 *
 * Does exactly the "SES → SMTP Settings → Create SMTP credentials" Console flow:
 *   1. ensures a minimal send-only IAM user (cloudless-ses-smtp),
 *   2. creates an access key + derives the region-specific SES SMTP password
 *      (AWS's documented SigV4 algorithm),
 *   3. writes SES_SMTP_USER / SES_SMTP_PASSWORD (SecureString) / SES_FROM_EMAIL
 *      to /cloudless/production/* in SSM.
 *
 * Idempotent: exits early if the SMTP params already exist in SSM. Fails with a
 * clear message (exit 1) if the caller's IAM identity lacks iam:CreateUser.
 *
 * Requires the running identity to allow: iam:GetUser, iam:CreateUser,
 * iam:PutUserPolicy, iam:ListAccessKeys, iam:CreateAccessKey,
 * iam:DeleteAccessKey, ssm:GetParameter, ssm:PutParameter (+ kms:Decrypt for
 * the SecureString read-back).
 */
import { createHmac } from "node:crypto";
import {
  IAMClient,
  GetUserCommand,
  CreateUserCommand,
  PutUserPolicyCommand,
  ListAccessKeysCommand,
  CreateAccessKeyCommand,
  DeleteAccessKeyCommand,
} from "@aws-sdk/client-iam";
import { SSMClient, GetParameterCommand, PutParameterCommand } from "@aws-sdk/client-ssm";

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const IAM_USER = process.env.SES_SMTP_IAM_USER ?? "cloudless-ses-smtp";
const FROM_DEFAULT = process.env.SES_FROM_DEFAULT ?? "noreply@cloudless.gr";
const P_USER = "/cloudless/production/SES_SMTP_USER";
const P_PASS = "/cloudless/production/SES_SMTP_PASSWORD";
const P_FROM = "/cloudless/production/SES_FROM_EMAIL";

const iam = new IAMClient({ region: REGION });
const ssm = new SSMClient({ region: REGION });

/** AWS's documented derivation of the SES SMTP password from an IAM secret key. */
function deriveSmtpPassword(secretKey: string, region: string): string {
  const sign = (key: Buffer | string, msg: string) =>
    createHmac("sha256", key).update(msg, "utf8").digest();
  let sig: Buffer = sign(`AWS4${secretKey}`, "11111111");
  for (const part of [region, "ses", "aws4_request", "SendRawEmail"]) sig = sign(sig, part);
  return Buffer.concat([Buffer.from([0x04]), sig]).toString("base64");
}

async function ssmGet(name: string, decrypt = false): Promise<string> {
  try {
    const r = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: decrypt }));
    return r.Parameter?.Value ?? "";
  } catch {
    return "";
  }
}

function errName(e: unknown): string {
  return (e as { name?: string })?.name ?? "Error";
}

async function main(): Promise<void> {
  // 1) Idempotency.
  const [existingUser, existingPass] = await Promise.all([ssmGet(P_USER), ssmGet(P_PASS, true)]);
  if (existingUser && existingPass) {
    console.log(`✓ SES SMTP credentials already in SSM (user=${existingUser}). Nothing to do.`);
    return;
  }
  console.log(`→ Provisioning SES SMTP creds via IAM user '${IAM_USER}' (region ${REGION})`);

  // 2) Ensure IAM user.
  try {
    await iam.send(new GetUserCommand({ UserName: IAM_USER }));
    console.log(`  • IAM user ${IAM_USER} already exists`);
  } catch (e) {
    if (errName(e) !== "NoSuchEntityException") throw e;
    try {
      await iam.send(
        new CreateUserCommand({
          UserName: IAM_USER,
          Tags: [
            { Key: "managed-by", Value: "provision-ses-smtp" },
            { Key: "purpose", Value: "ses-smtp" },
          ],
        })
      );
      console.log(`  • created IAM user ${IAM_USER}`);
    } catch (ce) {
      if (errName(ce) === "AccessDenied" || errName(ce) === "AccessDeniedException") {
        console.error(
          `✗ Denied iam:CreateUser. Grant iam:CreateUser/CreateAccessKey/PutUserPolicy +\n` +
            `  ssm:PutParameter to the running identity, or create the SES SMTP credential\n` +
            `  in AWS Console → SES → SMTP Settings.`
        );
        process.exit(1);
      }
      throw ce;
    }
  }

  // 3) Minimal send-only policy.
  await iam.send(
    new PutUserPolicyCommand({
      UserName: IAM_USER,
      PolicyName: "ses-send",
      PolicyDocument: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{ Effect: "Allow", Action: ["ses:SendRawEmail", "ses:SendEmail"], Resource: "*" }],
      }),
    })
  );

  // 4) Create an access key (prune oldest if at the 2-key limit).
  const keys = await iam.send(new ListAccessKeysCommand({ UserName: IAM_USER }));
  const meta = keys.AccessKeyMetadata ?? [];
  if (meta.length >= 2) {
    const oldest = [...meta].sort(
      (a, b) => (a.CreateDate?.getTime() ?? 0) - (b.CreateDate?.getTime() ?? 0)
    )[0];
    if (oldest?.AccessKeyId) {
      console.log(`  • pruning oldest access key ${oldest.AccessKeyId} (2-key limit)`);
      await iam.send(
        new DeleteAccessKeyCommand({ UserName: IAM_USER, AccessKeyId: oldest.AccessKeyId })
      );
    }
  }
  const created = await iam.send(new CreateAccessKeyCommand({ UserName: IAM_USER }));
  const akId = created.AccessKey?.AccessKeyId;
  const akSecret = created.AccessKey?.SecretAccessKey;
  if (!akId || !akSecret) throw new Error("CreateAccessKey returned no credentials");
  console.log(`  • created access key ${akId}`);

  // 5) Derive the SMTP password.
  const smtpPassword = deriveSmtpPassword(akSecret, REGION);

  // 6) Write SSM params.
  await ssm.send(
    new PutParameterCommand({
      Name: P_USER,
      Type: "String",
      Overwrite: true,
      Value: akId,
      Description: "SES SMTP username (IAM access key id) for SES SMTP — provision-ses-smtp",
    })
  );
  await ssm.send(
    new PutParameterCommand({
      Name: P_PASS,
      Type: "SecureString",
      Overwrite: true,
      Value: smtpPassword,
      Description: "SES SMTP password (derived) for SES SMTP — provision-ses-smtp",
    })
  );
  if (!(await ssmGet(P_FROM))) {
    await ssm.send(
      new PutParameterCommand({
        Name: P_FROM,
        Type: "String",
        Overwrite: true,
        Value: FROM_DEFAULT,
        Description: "SES verified From address for transactional emails",
      })
    );
    console.log(`  • set ${P_FROM}=${FROM_DEFAULT}`);
  }

  console.log(
    `✓ SES SMTP credentials provisioned to SSM (user=${akId}).\n` +
      `  Next: wire to SMTP-using workloads as needed.`
  );
}

main().catch((e) => {
  console.error(`✗ provision-ses-smtp failed: ${errName(e)}: ${(e as Error)?.message ?? e}`);
  process.exit(1);
});
