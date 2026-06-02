---
name: ses-email-setup
description: Set up AWS SES SMTP credentials and configure Keycloak email verification for cloudless.gr. Use when email verification is broken, new users don't receive verification emails, the provision-ses-smtp workflow is failing, keycloak-configure-email is failing, or the user asks to "enable email verification", "set up SES SMTP", "configure Keycloak email", or "fix email not sending". Covers both the automated (iam:CreateUser) and manual (dispatch inputs) credential paths. For the fastest cloud-session path, invoke the /ses-smtp command instead.
---

# SES SMTP + Keycloak Email Verification — cloudless.gr

Keycloak sends email verification messages to new registrations via **AWS SES SMTP**.
Two workflows handle the setup end-to-end:

| Workflow | Script | What it does |
|---|---|---|
| `provision-ses-smtp.yml` | `scripts/provision-ses-smtp.sh` | Creates SES SMTP credentials (IAM user OR manual bypass) and writes them to SSM |
| `keycloak-configure-email.yml` | `scripts/keycloak-configure-email.sh` | Reads creds from SSM and applies SMTP config + `verifyEmail` to the Keycloak realm via REST admin API |

## SSM parameters

All three must exist for email to work:

| Parameter | Type | Value |
|---|---|---|
| `/cloudless/production/SES_SMTP_USER` | String | IAM access key ID (looks like `AKIA…`) |
| `/cloudless/production/SES_SMTP_PASSWORD` | SecureString | Derived SES SMTP credential (NOT the raw IAM secret key) |
| `/cloudless/production/SES_FROM_EMAIL` | String | Verified sender address, e.g. `noreply@cloudless.gr` |

## Path A — Automated (requires `iam:CreateUser` on the deploy role)

Trigger by pushing a change to `provision-ses-smtp.yml` or `scripts/provision-ses-smtp.sh`.
The workflow uses the OIDC deploy role to create an IAM user `cloudless-ses-smtp`,
mint an access key, derive the SMTP password, and write all three SSM params.

**Currently blocked**: the OIDC role (`GitHubActionsOIDC`) lacks `iam:CreateUser`.
To unblock, add these permissions to the deploy role in IAM:
```
iam:GetUser, iam:CreateUser, iam:PutUserPolicy,
iam:ListAccessKeys, iam:CreateAccessKey, iam:DeleteAccessKey
```

## Path B — Manual bypass (no extra IAM permissions needed)

Use this path when the OIDC role lacks `iam:CreateUser` or when you already have
SES SMTP credentials from a previous setup.

**Step 1 — Create credentials in AWS Console:**
1. Go to **AWS Console → SES → SMTP Settings → Create SMTP credentials**
2. This creates an IAM user and shows the credentials **once** — save them immediately:
   - **SMTP username**: looks like `AKIA…` (this is the IAM access key ID)
   - **SMTP password**: a long base64 string (the SES-derived credential — NOT the raw secret key)

**Step 2 — Store in SSM via workflow dispatch:**
1. Go to **GitHub → Actions → "Provision SES SMTP credentials" → Run workflow**
2. Fill in the inputs:
   - `smtp_user`: the SMTP username from step 1
   - `smtp_password`: the SMTP password from step 1
   - `from_email`: (optional) `noreply@cloudless.gr`
3. Click **Run workflow**

The workflow writes the credentials directly to SSM (`ssm:PutParameter` only — no IAM operations).

## Step 3 — Apply to Keycloak realm

After SSM params are written, `keycloak-configure-email.yml` runs automatically
(it's path-triggered on the provision script). Or trigger manually by pushing a
touch to `scripts/keycloak-configure-email.sh`.

The script uses the **Keycloak REST admin API** (no kubectl required):
- Authenticates with `KEYCLOAK_ADMIN_PASSWORD` (from `ADMIN_BOOTSTRAP_PASSWORD` secret)
- `PUT /admin/realms/master` — sets `smtpServer` block + `verifyEmail: true`
- `PUT /admin/realms/master/authentication/required-actions/VERIFY_EMAIL` — enables + sets as default

**Works even when k3s API server is down** — only requires `auth.cloudless.gr` to return HTTP 200.

## Troubleshooting

### `(no log)` in the Keycloak email config result

The "Resolve SMTP credentials" step failed before the script ran. Causes:
1. SSM params don't exist → run `provision-ses-smtp.yml` first (Path B)
2. OIDC step failed → check AWS deploy role permissions

### `ADMIN_AUTH=failed` in the configure-email log

`KEYCLOAK_ADMIN_PASSWORD` is wrong or `auth.cloudless.gr` is unreachable.
- Check `ADMIN_BOOTSTRAP_PASSWORD` GitHub secret is set correctly
- Verify `auth.cloudless.gr` returns HTTP 200: `curl -o /dev/null -w "%{http_code}" https://auth.cloudless.gr/realms/master`

### `SMTP=failed (HTTP 401)`

Bad credentials — the SMTP password stored in SSM is wrong. Delete the SSM params
and re-run Path B with correct credentials:
```bash
aws ssm delete-parameter --name /cloudless/production/SES_SMTP_USER
aws ssm delete-parameter --name /cloudless/production/SES_SMTP_PASSWORD
```
Then trigger `provision-ses-smtp.yml` via dispatch with fresh credentials.

### `SMTP=failed (HTTP 400)`

The `smtpServer` JSON payload was rejected by Keycloak. Check that the SMTP host/port
(`email-smtp.us-east-1.amazonaws.com:587`) is correct and `FROM_EMAIL` is a verified
SES sender address.

### New users don't receive verification emails

After email config succeeds, verify the Keycloak realm settings:
```bash
# Quick check via REST (no kubectl needed)
curl -s https://auth.cloudless.gr/realms/master | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print('verifyEmail:', d.get('verifyEmail'))"
```
Should return `verifyEmail: True`. If False, re-trigger `keycloak-configure-email.yml`.

Also verify the `FROM_EMAIL` address is verified in SES (AWS Console → SES → Verified identities).

## Idempotency

Both `provision-ses-smtp.sh` and `keycloak-configure-email.sh` are idempotent:
- Provision: exits early with "Nothing to do" if SSM params already exist
- Configure: safe to re-run — just overwrites the existing realm SMTP config

## What email verification does

Once configured:
1. New users who register at `https://cloudless.gr/auth/register` receive a verification email
2. The email contains a one-time link — clicking it verifies the account
3. Until verified, users **cannot sign in** to the application
4. Existing users (created before email verification was enabled) are unaffected

To disable email verification: `pnpm keycloak:enable-signup` sets `verifyEmail=false`.
