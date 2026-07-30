# Cognito Automation Suite

Complete automated tooling for Cognito authentication setup in local development and CI/CD.

## Overview

This suite provides three levels of automation:

1. **Bash Script** — for local development and manual CI runs
2. **Claude Code Skill** — for interactive setup in Claude Code
3. **GitHub Actions Workflow** — for automated CI/CD pipelines

All three share the same underlying logic and produce identical results.

## Components

### 1. Bash Script: `scripts/archive/cognito/cognito-setup.sh`

**Purpose:** Standalone script for local or CI-based setup

**Location:** `/home/tbaltzakis/code/cloudless.gr/scripts/archive/cognito/cognito-setup.sh`

**Usage:**

```bash
# Full setup with verification
bash scripts/archive/cognito/cognito-setup.sh

# Dry run (preview without changes)
bash scripts/archive/cognito/cognito-setup.sh --dry-run

# Skip dev server test (faster)
bash scripts/archive/cognito/cognito-setup.sh --skip-verify
```

**What it does:**

1. Checks AWS CLI availability
2. Validates AWS credentials (SSO or programmatic)
3. Fetches `COGNITO_CLIENT_ID` and `COGNITO_CLIENT_SECRET` from SSM
4. Backs up existing `.env.local`
5. Updates credentials in `.env.local`
6. Starts dev server and verifies Cognito auth works
7. Reports success/failure with clear messaging

**Environment Variables:**

```bash
AWS_REGION=us-east-1              # AWS region (default: us-east-1)
SKIP_VERIFY=1                      # Skip dev server test
DRY_RUN=1                         # Preview without changes
```

---

### 2. Claude Code Skill: `cognito-setup`

**Purpose:** Interactive skill for Claude Code (this IDE)

**Location:** `/home/tbaltzakis/code/cloudless.gr/.claude/skills/cognito-setup/`

**Usage:**

```bash
# In Claude Code terminal
/cognito-setup

# Or via pnpm alias
pnpm cognito:setup
```

**Features:**

- Colored output (✓ success, ✗ errors, ⚠ warnings)
- Step-by-step progress
- Automatic backup of `.env.local`
- Built-in help: `bash scripts/archive/cognito/cognito-setup.sh --help`

---

### 3. GitHub Actions Workflow: `.github/workflows/cognito-setup.yml`

**Purpose:** Automated setup in CI/CD pipelines

**Location:** `/home/tbaltzakis/code/cloudless.gr/.github/workflows/cognito-setup.yml`

**Usage:**

```bash
# Manual trigger via GitHub CLI
gh workflow run cognito-setup.yml

# Or in GitHub UI: Actions → Setup Cognito Credentials → Run workflow
```

**Features:**

- Uses AWS OIDC (no static credentials stored)
- Posts results to issue #382
- Automatic error reporting
- Runs on `workflow_dispatch` (manual trigger only)

**Inputs:**

- `environment` — development | staging | production (default: development)

---

### 4. pnpm Aliases

**Location:** `package.json` scripts

**Available Commands:**

```bash
pnpm cognito:setup              # Full setup with verification
pnpm cognito:setup:dry          # Dry run (preview)
pnpm cognito:setup:quick        # Skip dev server test
```

---

### 5. MCP Server: `tools/cognito-setup-mcp/`

**Purpose:** Programmatic access to setup tools (for other tools/agents)

**Location:** `/home/tbaltzakis/code/cloudless.gr/tools/cognito-setup-mcp/`

**Exposed Tools:**

- `cognito_check_aws_creds` — Validate AWS authentication
- `cognito_fetch_credentials` — Fetch from SSM Parameter Store
- `cognito_update_env` — Update `.env.local` file
- `cognito_test_dev_server` — Test dev server startup
- `cognito_full_setup` — Orchestrate all steps

**Usage (in TypeScript/Node):**

```typescript
const client = new MCPClient({
  command: "npx",
  args: ["tsx", "tools/cognito-setup-mcp/src/index.ts"]
});

const result = await client.call("cognito_full_setup", {
  skipVerify: false,
  dryRun: false
});
```

---

## Architecture

### Layered Design

```
┌─────────────────────────────────────────────────────────┐
│  Level 1: Core Logic (scripts/archive/cognito/cognito-setup.sh)         │
│  - AWS auth, SSM fetch, .env.local update, dev test     │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┼──────────┬──────────┐
        ▼          ▼          ▼          ▼
┌──────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Level 2a:   │ │  Level 2b:       │ │  Level 2c:       │
│  Bash Skill  │ │  pnpm aliases    │ │  MCP Server      │
│ (wrapper)    │ │ (package.json)   │ │ (programmatic)   │
└──────────────┘ └──────────────────┘ └──────────────────┘
        │                  │                   │
        └──────────┬───────┴───────────────────┘
                   │
        ┌──────────▼──────────┐
        │  Level 3:            │
        │  GitHub Actions WF   │
        │  (.github/workflows) │
        └──────────────────────┘
```

All levels:

- Share the same core `cognito-setup.sh` script
- Provide different interfaces (CLI, pnpm, API, GH Actions)
- Produce identical results
- Are idempotent (safe to run multiple times)

### Data Flow

```
AWS Credentials
    │
    ├─► SSO cache         → aws sts get-caller-identity
    ├─► ~/.aws/credentials → AWS CLI direct
    └─► SSO login prompt  → browser auth
        │
        ▼
    Authenticated CLI
        │
        ▼
    AWS SSM Parameter Store
        │
        ├─► /cloudless/production/COGNITO_CLIENT_ID
        └─► /cloudless/production/COGNITO_CLIENT_SECRET
        │
        ▼
    Credentials Retrieved
        │
        ▼
    Backup + Update .env.local
        │
        ├─► NEXT_PUBLIC_COGNITO_CLIENT_ID
        ├─► COGNITO_CLIENT_ID
        ├─► COGNITO_CLIENT_SECRET
        └─► Other vars (unchanged)
        │
        ▼
    Dev Server Test
        │
        ├─► pnpm dev (start server)
        ├─► curl http://localhost:4000/en (verify)
        └─► Kill server
        │
        ▼
    ✓ Setup Complete
```

---

## Usage Scenarios

### Scenario 1: First-Time Local Setup

**User:** New team member setting up cloudless.gr locally

**Command:**

```bash
pnpm cognito:setup
```

**Result:**

- AWS credentials validated
- Cognito Client ID fetched
- `.env.local` updated
- Dev server tested
- Ready to authenticate

---

### Scenario 2: Credential Rotation

**User:** AWS credentials expired, need to refresh

**Command:**

```bash
# First, re-authenticate
aws sso login --sso-session cloudless

# Then run setup
pnpm cognito:setup
```

**Result:**

- Old credentials replaced
- New ones fetched from SSM
- Dev server verified
- No manual `.env.local` editing needed

---

### Scenario 3: CI/CD Pipeline

**User:** GitHub Actions workflow for automated setup

**Trigger:** Manual via `gh workflow run` or GitHub UI

**Command:**

```bash
gh workflow run cognito-setup.yml --ref main
```

**Result:**

- OIDC authentication to AWS
- Cognito setup in test environment
- Results posted to issue #382
- CI can proceed with Cognito auth available

---

### Scenario 4: Debugging

**User:** Setup failed, need to diagnose

**Command:**

```bash
# See what would happen
pnpm cognito:setup:dry

# Verbose output
bash -x scripts/archive/cognito/cognito-setup.sh

# Manual step-by-step
aws sts get-caller-identity              # Check auth
aws ssm get-parameter --name "/cloudless/production/COGNITO_CLIENT_ID" --region us-east-1
```

---

## Implementation Details

### Error Handling

All tools implement graceful error handling:

| Error | Detection | Recovery |
|-------|-----------|----------|
| AWS CLI missing | `which aws` | Exit with clear message |
| Invalid credentials | `aws sts get-caller-identity` | Prompt SSO login |
| SSM parameter not found | `ParameterNotFound` exception | Exit with SSM path hint |
| Dev server won't start | `curl` timeout | Non-fatal, suggest manual test |
| `.env.local` missing | File not found | Create with defaults |

### Idempotency

All scripts are fully idempotent:

- Running multiple times is safe
- Existing credentials are replaced (not duplicated)
- Backups are timestamped (don't overwrite each other)
- SSM calls are read-only (no side effects)

### Security

- No credentials logged to console (masked in output)
- No credentials committed to git
- AWS credentials from SSM (not hardcoded)
- `.env.local` backups marked read-only (`chmod 600`)
- MCP server reads/writes locally only (no network calls except AWS)

---

## Troubleshooting Matrix

| Problem | Cause | Solution |
|---------|-------|----------|
| "AWS CLI not found" | Missing CLI | `pip install awscli` |
| "security token ... invalid" | Expired credentials | `aws sso login --sso-session cloudless` |
| "ParameterNotFound" | Wrong SSM path | Verify parameter exists in SSM |
| "Permission denied" | Wrong IAM permissions | Contact admin for SSM read access |
| "Dev server won't start" | Port 4000 in use | `lsof -i :4000` and kill process |
| "Setup succeeded but auth fails" | Stale Node modules | `pnpm install` and restart dev server |

---

## Contributing

To extend or modify the automation:

1. **Update the core script:** `scripts/archive/cognito/cognito-setup.sh`
2. **Update the skill:** `.claude/skills/cognito-setup/index.md`
3. **Update MCP tools:** `tools/cognito-setup-mcp/src/index.ts`
4. **Update workflows:** `.github/workflows/cognito-setup.yml`
5. **Update docs:** This file + COGNITO_SETUP.md

All components should remain synchronized and idempotent.

---

## See Also

- [Cognito Setup Guide](./COGNITO_SETUP.md) — detailed user guide
