# SES SMTP — least-privilege IAM for `pnpm ses:provision`

`pnpm ses:provision` (`scripts/provision-ses-smtp.ts`) needs to do exactly
five AWS things, all idempotent:

1. Look up an IAM user named `cloudless-ses-smtp` (or create it).
2. Attach a send-only inline policy.
3. Create an access key for that user.
4. Optionally delete any older access key on the same user (rotation).
5. Write `SES_SMTP_USER` + `SES_SMTP_PASSWORD` + `SES_FROM_EMAIL` to
   `/cloudless/production/*` in SSM.

The `cloudless-pi-standby` IAM user mounted as `monitoring/aws-creds` in
the cluster has none of those IAM permissions on purpose (it's a runtime
SSM reader, not a provisioning identity). So `ses:provision` runs from
the operator's laptop, where the operator's IAM identity has admin or
PowerUser. This is the right separation.

If you want to give a non-admin teammate the ability to run
`pnpm ses:provision` without giving them broad IAM, use this minimal
policy. It scopes IAM actions to the single `cloudless-ses-smtp` user
and SSM actions to the three keys the script writes.

## Least-privilege policy

Save as `infrastructure/iam/policies/ses-provisioner.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ManageOneSesSmtpUser",
      "Effect": "Allow",
      "Action": [
        "iam:GetUser",
        "iam:CreateUser",
        "iam:PutUserPolicy",
        "iam:ListAccessKeys",
        "iam:CreateAccessKey",
        "iam:DeleteAccessKey"
      ],
      "Resource": "arn:aws:iam::*:user/cloudless-ses-smtp"
    },
    {
      "Sid": "WriteSesSmtpParams",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:PutParameter"
      ],
      "Resource": [
        "arn:aws:ssm:*:*:parameter/cloudless/production/SES_SMTP_USER",
        "arn:aws:ssm:*:*:parameter/cloudless/production/SES_SMTP_PASSWORD",
        "arn:aws:ssm:*:*:parameter/cloudless/production/SES_FROM_EMAIL"
      ]
    },
    {
      "Sid": "DecryptSecureStringParam",
      "Effect": "Allow",
      "Action": ["kms:Decrypt"],
      "Resource": "*",
      "Condition": {
        "StringLike": {
          "kms:EncryptionContext:PARAMETER_ARN": "arn:aws:ssm:*:*:parameter/cloudless/production/SES_SMTP_PASSWORD"
        }
      }
    }
  ]
}
```

## Attach to a user

```bash
aws iam put-user-policy \
  --user-name <teammate-username> \
  --policy-name SesProvisioner \
  --policy-document file://infrastructure/iam/policies/ses-provisioner.json
```

## Or attach to a role (better for SSO/Identity Center setups)

```bash
aws iam put-role-policy \
  --role-name <role-with-ses-provisioning-rights> \
  --policy-name SesProvisioner \
  --policy-document file://infrastructure/iam/policies/ses-provisioner.json
```

## Verify the policy is sufficient

```bash
# As the teammate (after SSO login), dry-run the provisioner:
SES_SMTP_DRYRUN=1 pnpm ses:provision    # if the script supports it; otherwise just run it

# Should complete without "AccessDenied" or "not authorized to perform"
# in stderr. If it errors, paste the missing action into the policy.
```

## Why not just AdministratorAccess?

- A typo in `pnpm ses:provision` shouldn't be able to delete other IAM users.
- Rotated SMTP creds get written to SSM as `SecureString` — the
  least-priv policy lets the script decrypt **only** that one parameter
  via the KMS encryption-context condition.
- The IAM `Resource: "arn:...user/cloudless-ses-smtp"` constraint means
  no surprises like creating `cloudless-debug-elevated` or
  `mallory-backdoor`.

## Rotation cadence

AWS doesn't enforce a rotation policy for IAM access keys — set yours
to ~90 days. Run from the laptop:

```bash
aws ssm delete-parameter --name /cloudless/production/SES_SMTP_PASSWORD
pnpm ses:provision                         # generates a fresh access key
gh workflow run sync-smtp-secrets.yml      # propagates to all 5 namespaces
```

The script auto-deletes the old access key on the IAM user (step 4 in
the intro list above) — no manual cleanup needed.

## Sources

- [AWS — Obtaining Amazon SES SMTP credentials (SigV4 derivation)](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html)
- [AWS — IAM JSON policy elements: Condition operators](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html)
- [AWS — Restricting access using condition keys (KMS encryption context)](https://docs.aws.amazon.com/kms/latest/developerguide/policy-conditions.html)
- `scripts/provision-ses-smtp.ts` — the script this policy gates.
