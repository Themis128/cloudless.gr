# /ses-smtp — provision SES SMTP credentials and configure Keycloak email

Sets up AWS SES SMTP so Keycloak can send email verification messages to new
registrations. Works from a cloud session with no direct cluster or AWS access.

## What this command does

1. Checks whether SSM already has SMTP credentials (idempotency guard).
2. Asks the user for their SES SMTP username + password if not already stored.
3. Dispatches `provision-ses-smtp.yml` via `mcp__github__actions_run_trigger`
   with the credentials as inputs — no GitHub Secrets needed.
4. Monitors the result via issue #382.

## Steps

### Step 1 — Check current SSM state

Call `mcp__github__actions_run_trigger` to dispatch `provision-ses-smtp.yml`
in **report-only mode** (leave `smtp_user` and `smtp_password` blank, leave
`from_email` blank). The workflow will print whether SSM params already exist.

Check issue #382 for the result (latest comment).

If SSM already has the credentials and email works, stop here.

### Step 2 — Get SES SMTP credentials (if not already in SSM)

The user must get credentials from AWS Console **one time**. Ask them:

> "Please go to **AWS Console → SES → SMTP Settings → Create SMTP credentials**.
> This opens a dialog that creates an IAM user and shows the credentials once:
> - **SMTP username** (looks like `AKIA…`)
> - **SMTP password** (long base64 string — NOT the IAM secret key)
> Copy both now — the password cannot be retrieved later."

Wait for the user to provide both values.

### Step 3 — Dispatch the provision workflow

Once you have both values, call `mcp__github__actions_run_trigger` with:

```json
{
  "owner": "themis128",
  "repo": "cloudless.gr",
  "workflow_id": "provision-ses-smtp.yml",
  "ref": "main",
  "inputs": {
    "smtp_user": "<SMTP username from user>",
    "smtp_password": "<SMTP password from user>",
    "from_email": "noreply@cloudless.gr"
  }
}
```

The workflow:
- Masks both credentials immediately (they will NOT appear in logs)
- Writes them to SSM `/cloudless/production/SES_SMTP_USER` and `SES_SMTP_PASSWORD`
- Reads them back and applies SMTP config to the Keycloak master realm via REST admin API
- Posts the result to issue #382

### Step 4 — Verify

Check issue #382 for the latest comment. Look for:
- `SMTP_WRITE=done` — credentials stored in SSM
- `SMTP=ok (HTTP 204)` — Keycloak realm updated

If `ADMIN_AUTH=failed`: the `ADMIN_BOOTSTRAP_PASSWORD` GitHub Secret is wrong or stale.
If `SMTP=failed (HTTP 401)`: the credentials were copied incorrectly — re-run step 2.

## Key SSM parameters

| Parameter | Type | Expected value |
|---|---|---|
| `/cloudless/production/SES_SMTP_USER` | String | IAM access key ID (`AKIA…`) |
| `/cloudless/production/SES_SMTP_PASSWORD` | SecureString | SES-derived SMTP credential |
| `/cloudless/production/SES_FROM_EMAIL` | String | `noreply@cloudless.gr` |

## Notes

- From email (`noreply@cloudless.gr`) must be a verified SES sender identity.
  Check: AWS Console → SES → Verified identities.
- The `provision-ses-smtp.yml` workflow is idempotent — re-running it with the
  same credentials is safe.
- The `ses-smtp-from-secret.yml` workflow is the alternative path that reads
  from GitHub Secrets instead of dispatch inputs.
- For full troubleshooting, invoke the `ses-email-setup` skill.
