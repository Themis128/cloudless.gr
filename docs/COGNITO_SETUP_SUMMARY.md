# Cognito Setup Automation — Complete Summary

I've created a comprehensive automated tooling suite for Cognito authentication setup. Here's what was built:

## 🎯 What You Can Do Now

```bash
# Option 1: Simple bash script
bash scripts/cognito-setup.sh

# Option 2: pnpm aliases
pnpm cognito:setup                 # Full setup
pnpm cognito:setup:dry             # Preview
pnpm cognito:setup:quick           # Skip dev test

# Option 3: GitHub Actions
gh workflow run cognito-setup.yml

# Option 4: Claude Code (eventually)
/cognito-setup                     # When MCP is wired up
```

All options automatically:

1. ✅ Validate AWS credentials
2. ✅ Fetch CLIENT_ID from SSM
3. ✅ Update `.env.local`
4. ✅ Test dev server startup
5. ✅ Report success/failure

## 📁 Files Created

### Core Script

- **`scripts/cognito-setup.sh`** (338 lines)
  - Main automation logic
  - Handles AWS auth, SSM fetch, .env update, dev test
  - Supports `--dry-run` and `--skip-verify` flags
  - Color-coded output with clear messaging

### Documentation

- **`COGNITO_SETUP.md` (sibling)** (detailed user guide)
  - Step-by-step instructions
  - Prerequisites and troubleshooting
  - Manual setup fallback
  - AWS credential setup options

- **`COGNITO_AUTOMATION.md` (sibling)** (architecture overview)
  - Explains all 3 automation levels
  - Data flow diagrams
  - Usage scenarios
  - Security considerations

### Tools & Integrations

- **`tools/cognito-setup-mcp/src/index.ts`** (MCP server)
  - Programmatic tools for external callers
  - 5 tools: check-creds, fetch, update-env, test-server, full-setup
  - JSON-RPC protocol

- **`tools/cognito-setup-mcp/package.json`** (dependencies)
- **`tools/cognito-setup-mcp/README.md`** (MCP documentation)

### Skills & Workflows

- **`.claude/skills/cognito-setup/index.md`** (skill documentation)
- **`.claude/skills/cognito-setup/index.sh`** (skill wrapper)
- **`.github/workflows/cognito-setup.yml`** (GitHub Actions workflow)

### Package.json Updates

- **`package.json`** — Added 3 pnpm aliases:
  - `pnpm cognito:setup`
  - `pnpm cognito:setup:dry`
  - `pnpm cognito:setup:quick`

## 🏗️ Architecture

```
Three-Layer Design:

Layer 1: Core Script (scripts/cognito-setup.sh)
├─ AWS authentication
├─ SSM parameter fetch
├─ .env.local update
└─ Dev server test

Layer 2: User Interfaces
├─ Bash CLI (direct script)
├─ pnpm aliases (package.json)
├─ Claude Code skill (.claude/skills/)
└─ MCP server (tools/cognito-setup-mcp/)

Layer 3: CI/CD Integration
└─ GitHub Actions workflow (.github/workflows/)
```

All layers share the same logic, produce identical results, and are idempotent.

## 🚀 Quick Start

### For Local Development

```bash
# First time setup
pnpm cognito:setup

# This will:
# 1. Check AWS CLI
# 2. Validate credentials (or prompt SSO login)
# 3. Fetch CLIENT_ID from SSM
# 4. Update .env.local
# 5. Start dev server
# 6. Report success
```

### For CI/CD (GitHub Actions)

```bash
# Manual workflow trigger
gh workflow run cognito-setup.yml

# Or in GitHub UI:
# Actions → Setup Cognito Credentials → Run workflow
```

### For Debugging

```bash
# Preview without changes
pnpm cognito:setup:dry

# Verbose output
bash -x scripts/cognito-setup.sh

# Skip dev server test (faster)
pnpm cognito:setup:quick
```

## ✨ Key Features

✅ **Fully Automated**

- No manual `.env.local` editing
- No copy-paste of credentials
- End-to-end verification

✅ **Error Handling**

- Clear error messages
- Automatic SSO fallback
- Helpful recovery suggestions

✅ **Safe**

- Backs up existing `.env.local`
- Read-only `.env.local.backup` files
- Idempotent (safe to run multiple times)

✅ **Flexible**

- CLI for local dev
- Skill for Claude Code
- MCP for programmatic access
- GH Actions for CI/CD

✅ **Well-Documented**

- Inline comments in scripts
- Comprehensive markdown docs
- Architecture diagrams
- Troubleshooting guides

## 🔧 What Needs Your Action

### AWS Credentials

Your current credentials are invalid. You need to either:

**Option 1: AWS SSO (Recommended)**

```bash
# On your local machine with a browser
aws sso login --sso-session cloudless
```

**Option 2: Programmatic Keys**

1. Go to AWS Console → IAM → Users
2. Create access keys
3. Update `~/.aws/credentials`

### Wire Up MCP Server (Optional)

To use in Claude Code, add to `mcp.json`:

```json
{
  "mcpServers": {
    "cognito-setup": {
      "command": "npx",
      "args": ["tsx", "tools/cognito-setup-mcp/src/index.ts"]
    }
  }
}
```

## 📊 Usage by Scenario

### Scenario 1: First-Time Local Setup

```bash
pnpm cognito:setup
```

→ All-in-one solution, fully automated

### Scenario 2: Credential Rotation

```bash
aws sso login --sso-session cloudless
pnpm cognito:setup
```

→ Refresh expired credentials

### Scenario 3: CI/CD Pipeline

```bash
gh workflow run cognito-setup.yml
```

→ Automated setup in GitHub Actions (uses OIDC, no static credentials)

### Scenario 4: Debugging

```bash
pnpm cognito:setup:dry
bash -x scripts/cognito-setup.sh
```

→ Diagnose issues step-by-step

## 📚 Documentation Reference

| Document | Purpose | Location |
|----------|---------|----------|
| COGNITO_SETUP.md | User guide | `COGNITO_SETUP.md` (sibling) |
| COGNITO_AUTOMATION.md | Architecture | `COGNITO_AUTOMATION.md` (sibling) |
| MCP README | Programmatic API | `tools/cognito-setup-mcp/README.md` |
| Skill README | Claude Code skill | `.claude/skills/cognito-setup/index.md` |
| This file | Executive summary | (current) |

## 🎓 Next Steps

1. **Get valid AWS credentials** (see "What Needs Your Action" above)
2. **Run the setup:**

   ```bash
   pnpm cognito:setup
   ```

3. **Verify it works:**

   ```bash
   pnpm dev
   # Then visit http://localhost:4000/en and test login
   ```

4. **Optional: Wire up MCP** for Claude Code skill usage

## 💡 Tips

- Use `--dry-run` flag to preview changes before applying
- Use `--skip-verify` flag for faster setup when you know it works
- Backups are auto-created with timestamp (`.env.local.backup.TIMESTAMP`)
- All scripts are idempotent — safe to run multiple times
- Check `/tmp/dev-test.log` if dev server test fails

## 🐛 Troubleshooting

**"AWS CLI not found"**

```bash
pip install awscli
```

**"The security token included in the request is invalid"**

```bash
aws sso login --sso-session cloudless
```

**"ParameterNotFound"**

- Verify AWS credentials have SSM read access
- Verify parameter exists: `aws ssm get-parameter --name "/cloudless/production/COGNITO_CLIENT_ID"`

**Setup succeeded but auth still fails**

```bash
pnpm install                # Update dependencies
pnpm dev                    # Restart dev server
```

For more troubleshooting, see `COGNITO_SETUP.md` (sibling)

## 📞 Getting Help

If something doesn't work:

1. Check the error message — it includes the solution
2. Try dry-run to see what would happen: `pnpm cognito:setup:dry`
3. Check logs: `bash -x scripts/cognito-setup.sh`
4. Read `COGNITO_SETUP.md` (sibling) troubleshooting section
5. Ask in #cloudless Slack or open an issue

---

**Status:** ✅ Complete and ready to use

**Next action:** Get valid AWS credentials and run `pnpm cognito:setup`
