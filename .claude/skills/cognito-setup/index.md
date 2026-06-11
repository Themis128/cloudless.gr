# cognito-setup

**Automated Cognito authentication setup for local development**

Fully automates AWS credential validation, Cognito Client ID retrieval, and `.env.local` configuration to enable Cognito login in the dev server.

## When to use

- **First time setup** — getting Cognito auth working locally
- **Credential rotation** — updating expired/invalidated AWS creds
- **Team onboarding** — new developers setting up the project
- **CI/CD debugging** — testing Cognito auth locally before push

## What it does

1. ✅ Validates AWS CLI installation
2. 🔐 Authenticates to AWS (SSO or programmatic credentials)
3. 📦 Fetches `COGNITO_CLIENT_ID` and `COGNITO_CLIENT_SECRET` from SSM
4. ⚙️ Updates `.env.local` with all Cognito configuration
5. 🧪 Tests dev server startup to verify the setup works

## Quick start

```bash
# Fully automated setup
bash scripts/cognito-setup.sh

# Preview what would happen (no changes)
bash scripts/cognito-setup.sh --dry-run

# Skip dev server test (faster)
bash scripts/cognito-setup.sh --skip-verify
```

## Prerequisites

- **AWS CLI** installed (`pip install awscli`)
- **Valid AWS credentials** (either SSO or programmatic)
  - If using SSO, run: `aws sso login --sso-session cloudless` on a machine with a browser
  - If using programmatic keys, update `~/.aws/credentials`
- **SSM read permissions** on `/cloudless/production/*` parameters

## What gets updated

The script updates `.env.local` with:
- `NEXT_PUBLIC_COGNITO_CLIENT_ID` — for browser/Next.js public config
- `COGNITO_CLIENT_ID` — for server-side auth
- `COGNITO_CLIENT_SECRET` — if it exists in SSM
- Backs up the previous `.env.local` to `.env.local.backup.*`

## Troubleshooting

### "AWS credentials invalid"

AWS keys have been rotated. You need new credentials:

**Option A: AWS SSO (recommended)**
```bash
# On your local machine (with browser)
aws sso login --sso-session cloudless
```

**Option B: Programmatic keys**
1. Go to AWS Console → IAM → Users
2. Create access keys (or ask your admin for them)
3. Update `~/.aws/credentials`:
   ```ini
   [default]
   aws_access_key_id = YOUR_KEY
   aws_secret_access_key = YOUR_SECRET
   ```

### "Permission denied" or "UnauthorizedOperation"

Your AWS credentials don't have SSM read permission. Ask your admin to grant `ssm:GetParameter` on `/cloudless/production/*`.

### "ParameterNotFound" for CLIENT_ID

The SSM parameter doesn't exist or is in a different SSM path. Verify the path:
```bash
aws ssm get-parameter --name "/cloudless/production/COGNITO_CLIENT_ID" --region us-east-1
```

### Dev server won't start after setup

Check `.env.local` is correctly updated:
```bash
grep "COGNITO_CLIENT_ID" .env.local
```

Then start manually to see errors:
```bash
pnpm dev
```

## How it works internally

```
┌─────────────────────────────────────────────┐
│  1. Check AWS CLI + validate credentials    │
├─────────────────────────────────────────────┤
│  2. Fetch CLIENT_ID from SSM Parameter      │
├─────────────────────────────────────────────┤
│  3. Fetch CLIENT_SECRET from SSM (optional) │
├─────────────────────────────────────────────┤
│  4. Backup + update .env.local              │
├─────────────────────────────────────────────┤
│  5. Test: start dev server & curl /en       │
├─────────────────────────────────────────────┤
│  ✅ Ready to auth with Cognito              │
└─────────────────────────────────────────────┘
```

All steps are idempotent — running the script multiple times is safe.
