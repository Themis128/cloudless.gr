# SES SMTP — fleet wire-up

Single source of truth for sending transactional email from every
self-hosted app via AWS SES SMTP. All apps read from a per-namespace
`smtp-credentials` Secret with the same shape.

## Apps wired (5)

| App         | Namespace   | Why email                              | Patch file                                  |
| ----------- | ----------- | -------------------------------------- | ------------------------------------------- |
| GoTrue (AppFlowy auth) | appflowy   | Magic-link login                              | `infrastructure/appflowy/k8s/gotrue-smtp-patch.yaml`     |
| EspoCRM     | espocrm    | Outbound notifications + IMAP replies         | `infrastructure/espocrm/k8s/espocrm-smtp-patch.yaml`     |
| Postiz      | postiz     | Password reset, invites                       | `infrastructure/postiz/k8s/postiz-smtp-patch.yaml`       |
| n8n         | n8n        | Password reset, workflow-failure alerts       | `infrastructure/n8n/k8s/n8n-smtp-patch.yaml`             |
| Grafana     | monitoring | Alert emails                                  | `infrastructure/monitoring/grafana-smtp-patch.yaml`      |

**Uptime Kuma** is wired separately — it uses its own UI-driven notification
channels (Email/Slack/Telegram/etc.) per provider. Add the same SMTP creds
manually in the Settings > Notifications panel on first login.

**Mosquitto / ntfy** don't need email.

## SSM keys (source of truth)

```
/cloudless/production/SES_SMTP_USER       (String)
/cloudless/production/SES_SMTP_PASSWORD   (SecureString)
/cloudless/production/SES_FROM_EMAIL      (String, default noreply@cloudless.gr)
/cloudless/production/SES_SMTP_HOST       (String, default email-smtp.us-east-1.amazonaws.com)
```

## First-time provisioning (operator-side)

`cloudless-pi-standby` (the IAM user mounted as `aws-creds` Secret in the
cluster) does NOT have `iam:CreateUser`. SES SMTP credential creation needs
admin AWS creds — run this once from your laptop:

```bash
# 1. Provision the IAM user + access key + derive SMTP password +
#    write SES_SMTP_USER / SES_SMTP_PASSWORD to SSM.
#    Uses the documented SigV4 algorithm; idempotent.
pnpm ses:provision

# 2. Sync the new Secrets to every app namespace + roll deployments.
#    Runs on the omv Pi runner.
gh workflow run sync-smtp-secrets.yml
```

After step 2 finishes (~30 s), every app starts using SES SMTP automatically.

## Rotation (every ~90 days as a habit)

```bash
# Delete the existing SMTP password param so provision-ses-smtp.ts
# treats it as missing and re-creates.
aws ssm delete-parameter --name /cloudless/production/SES_SMTP_PASSWORD
pnpm ses:provision                          # writes new password
gh workflow run sync-smtp-secrets.yml       # propagates everywhere
```

## Verify each app sends mail

| App      | Verify command (or UI flow)                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| GoTrue   | Visit https://appflowy.cloudless.gr → enter `tbaltzakis@cloudless.gr` → "Send magic link". Expect email within ~10 s. |
| EspoCRM  | Admin → Outbound Emails → "Send Test Email" with `tbaltzakis@cloudless.gr` as recipient.                              |
| Postiz   | Sign-up flow with a real email → confirmation email arrives.                                                          |
| n8n     | Owner Settings → Edit account → "Send a verification email".                                                          |
| Grafana  | Alerting → Contact points → SMTP → "Test".                                                                            |

## See also

- `scripts/provision-ses-smtp.ts` — the SigV4 derivation + IAM bootstrap.
- `scripts/sync-smtp-to-namespaces.sh` — the per-namespace propagation.
- `docs/EMAIL-SES.md` — the original `cloudless.gr` app integration (this
  same SES identity, same `noreply@cloudless.gr` sender).
- AWS SES docs:
  - [Obtaining Amazon SES SMTP credentials](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html)
  - [Convert IAM secret to SES SMTP password (Lisenet)](https://www.lisenet.com/2014/convert-iam-secret-access-key-to-ses-smtp-password-in-bash/)
