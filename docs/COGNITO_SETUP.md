# Cognito Authentication Setup Guide

This document covers automated setup of Cognito authentication for local development.

## Quick Start

### Option 1: CLI Script (Recommended)

```bash
bash scripts/archive/cognito/cognito-setup.sh
```

This fully automates:

1. AWS credential validation
2. Cognito Client ID/Secret retrieval from SSM
3. `.env.local` configuration
4. Dev server startup test

### Option 2: Claude Code Skill

```bash
/cognito-setup
```

Or in this repo:

```bash
pnpm cognito:setup
```

### Option 3: GitHub Actions (CI/CD)

```bash
# Manually trigger the workflow
gh workflow run cognito-setup.yml --repo Themis128-cloudless.gr
```

## Prerequisites

### AWS Credentials

You need valid AWS credentials with access to:

- SSM Parameter Store (read access to `/cloudless/production/*`)
- Cognito User Pool management (for testing)

**Your credentials are currently invalid.** You have three options:

#### Option A: AWS SSO (Recommended)

On your local machine (with a browser):

```bash
aws sso login --sso-session cloudless
```

This will:

1. Open a browser to authenticate
2. Cache credentials locally
3. Enable the setup script to work

#### Option B: Programmatic Access Keys

1. Go to AWS Console → IAM → Users
2. Click your user → Security credentials
3. Create new access key
4. Update `~/.aws/credentials`:

   ```ini
   [default]
   aws_access_key_id = AKIA...
   aws_secret_access_key = ...
   ```

#### Option C: Assume IAM Role (CI/CD only)

In GitHub Actions, the workflow uses OIDC to assume `AWS_DEPLOY_ROLE_ARN`.

## What Gets Configured

The setup script updates `.env.local`:

| Variable | Source | Purpose |
|----------|--------|---------|
| `COGNITO_CLIENT_ID` | SSM `/cloudless/production/COGNITO_CLIENT_ID` | Server-side auth |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Same as above | Browser/frontend auth |
| `COGNITO_CLIENT_SECRET` | SSM `/cloudless/production/COGNITO_CLIENT_SECRET` | Server secret (if exists) |
| `COGNITO_ISSUER` | Derived from pool ID | OpenID Connect endpoint |
| `AUTH_SECRET` | Existing value (unchanged) | Next-auth encryption key |

## Usage

### Full Setup (Recommended)

```bash
bash scripts/archive/cognito/cognito-setup.sh
```

**Output:**

```
[cognito] Checking AWS CLI...
✓ AWS CLI found
[cognito] Authenticating to AWS...
✓ Authenticated as arn:aws:iam::123456789:user/...
[cognito] Fetching Cognito credentials from SSM...
✓ CLIENT_ID: 4qmvj6c7n00b...
✓ CLIENT_SECRET: ****...
[cognito] Updating .env.local...
✓ Updated .env.local with Cognito credentials
[cognito] Testing dev server...
✓ Dev server started successfully

✓ Cognito setup complete!

Next steps:
  1. pnpm dev              # Start dev server
  2. Visit http://localhost:4000/en
  3. Click 'Sign in' to test Cognito authentication
```

### Dry Run (Preview)

See what would change without making modifications:

```bash
bash scripts/archive/cognito/cognito-setup.sh --dry-run
```

### Skip Dev Server Test

Faster setup if you know it works:

```bash
bash scripts/archive/cognito/cognito-setup.sh --skip-verify
```

## Troubleshooting

### "AWS CLI not found"

Install with:

```bash
pip install awscli
```

Or use your system package manager:

```bash
# macOS
brew install awscli

# Ubuntu/Debian
sudo apt-get install awscli
```

### "The security token included in the request is invalid"

Your AWS credentials have expired or are invalid. Fix with:

```bash
# Option 1: AWS SSO (recommended)
aws sso login --sso-session cloudless

# Option 2: Get new programmatic keys
# Go to AWS Console → IAM → Users → Create access key
# Then update ~/.aws/credentials
```

### "Parameter ParameterNotFound"

The SSM parameter doesn't exist. Verify:

```bash
aws ssm get-parameter --name "/cloudless/production/COGNITO_CLIENT_ID" --region us-east-1
```

If it doesn't exist:

1. Contact your admin to ensure SSM parameters are set up
2. Or check if you're using the wrong AWS account

### "Permission denied" or "UnauthorizedOperation"

Your AWS credentials don't have SSM read permission. Ask your admin to grant:

- `ssm:GetParameter` on `/cloudless/production/*`
- `ssm:DescribeParameters` (optional, for listing)

### Dev server won't start

After setup, verify `.env.local` has correct values:

```bash
grep "COGNITO" .env.local
```

Then start manually to see detailed errors:

```bash
pnpm dev
```

Check:

1. `COGNITO_CLIENT_ID` is not `<PASTE_CLIENT_ID_HERE>`
2. `AUTH_SECRET` is set (not empty)
3. `.env.local` has no syntax errors

### Setup failed but want to recover

The script backs up your previous `.env.local`:

```bash
# List backups
ls -la .env.local.backup.*

# Restore a backup
cp .env.local.backup.TIMESTAMP .env.local
```

## How It Works

```
┌──────────────────────┐
│   1. Check AWS CLI   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────┐
│   2. Validate credentials    │
│   - Try current creds        │
│   - If failed, use SSO login │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│   3. Fetch from SSM          │
│   - COGNITO_CLIENT_ID        │
│   - COGNITO_CLIENT_SECRET    │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│   4. Update .env.local       │
│   - Backup existing file     │
│   - Replace credential lines │
│   - Preserve other settings  │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│   5. Test dev server         │
│   - Kill existing instance   │
│   - Start with pnpm dev      │
│   - Curl /en endpoint        │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│   ✅ Ready to auth            │
│   - Cognito login enabled    │
│   - Dev server running       │
│   - .env.local configured    │
└──────────────────────────────┘
```

## Automation in CI/CD

### GitHub Actions

Trigger manually or via workflow dispatch:

```bash
gh workflow run cognito-setup.yml
```

The workflow:

1. Uses AWS OIDC to assume credentials (no static keys)
2. Runs the setup script
3. Posts results to issue #382
4. Exits with error code if setup fails

### Local CI Testing

Test the workflow locally with `act`:

```bash
act -j setup -s AWS_DEPLOY_ROLE_ARN=arn:aws:iam::...
```

## Advanced: Environment Variables

Override defaults:

```bash
# Use different AWS region
AWS_REGION=eu-west-1 bash scripts/archive/cognito/cognito-setup.sh

# Use different SSM path prefix
SSM_PREFIX=/custom/path/COGNITO_CLIENT_ID bash scripts/archive/cognito/cognito-setup.sh

# Custom pool ID (for testing)
POOL_ID=us-west-2_XYZ123 bash scripts/archive/cognito/cognito-setup.sh
```

## Advanced: Manual Setup

If the script doesn't work for your setup:

```bash
# 1. Get credentials manually
CLIENT_ID=$(aws ssm get-parameter --name "/cloudless/production/COGNITO_CLIENT_ID" --region us-east-1 --query Parameter.Value --output text)
CLIENT_SECRET=$(aws ssm get-parameter --name "/cloudless/production/COGNITO_CLIENT_SECRET" --region us-east-1 --with-decryption --query Parameter.Value --output text)

# 2. Update .env.local manually
# Edit .env.local and replace:
#   NEXT_PUBLIC_COGNITO_CLIENT_ID=<PASTE_CLIENT_ID_HERE>
#   COGNITO_CLIENT_ID=<PASTE_CLIENT_ID_HERE>
#   COGNITO_CLIENT_SECRET=
# with the values from above

# 3. Test
pnpm dev
curl http://localhost:4000/en
```

## Debugging

Enable verbose output:

```bash
bash -x scripts/archive/cognito/cognito-setup.sh
```

Check logs:

```bash
# Dev server test log
cat /tmp/dev-test.log

# AWS SSO cache
ls -la ~/.aws/sso/cache/
```

Test individual steps:

```bash
# Test AWS auth only
aws sts get-caller-identity

# Test SSM access
aws ssm get-parameter --name "/cloudless/production/COGNITO_CLIENT_ID" --region us-east-1

# Test dev server manually
pnpm dev
```

## See Also

- [Cognito Automation](./COGNITO_AUTOMATION.md) — how the setup automation works end to end
