# Cognito Automation Suite — Complete Index

This is your entry point for the complete Cognito setup automation system.

## 📖 Start Here

1. **Quick Start** → Read [`COGNITO_SETUP_SUMMARY.md`](./COGNITO_SETUP_SUMMARY.md) (5 min)
2. **Detailed Guide** → Read [`docs/COGNITO_SETUP.md`](./COGNITO_SETUP.md) (15 min)
3. **Run Setup** → Execute `pnpm cognito:setup` (2 min)

## 🗂️ Complete File Structure

### 📚 Documentation (Start Here)

| File | Purpose | Read When |
|------|---------|-----------|
| [COGNITO_SETUP_SUMMARY.md](./COGNITO_SETUP_SUMMARY.md) | Executive overview | First time |
| [docs/COGNITO_SETUP.md](./COGNITO_SETUP.md) | Detailed user guide | Need detailed instructions |
| [docs/COGNITO_AUTOMATION.md](./COGNITO_AUTOMATION.md) | Architecture & design | Want to understand how it works |
| [COGNITO_SETUP_CHECKLIST.md](./COGNITO_SETUP_CHECKLIST.md) | Implementation status | Want to verify all features |

### 🛠️ Tools & Scripts

| File | Purpose | How to Use |
|------|---------|-----------|
| [scripts/archive/cognito/cognito-setup.sh](../scripts/archive/cognito/cognito-setup.sh) | Main automation script | `bash scripts/archive/cognito/cognito-setup.sh` |
| [tools/cognito-setup-mcp/src/index.ts](../tools/cognito-setup-mcp/src/index.ts) | MCP server for programmatic access | `npx tsx tools/cognito-setup-mcp/src/index.ts` |
| [tools/cognito-setup-mcp/README.md](../tools/cognito-setup-mcp/README.md) | MCP API documentation | Reference when using MCP tools |
| [.claude/skills/cognito-setup/](../.claude/skills/cognito-setup/) | Claude Code skill | `/cognito-setup` in Claude Code |
| `cognito-setup.yml` (removed — manage users in Cognito console) | GitHub Actions automation | `# cognito-setup.yml removed — use Cognito console / AWS CLI` |

### ⚙️ Configuration

| File | Purpose | Modified |
|------|---------|----------|
| [package.json](../package.json) | pnpm script aliases | ✅ Added 3 commands |

## 🚀 Quick Commands

### For Local Development

```bash
# Full automated setup (recommended)
pnpm cognito:setup

# Preview changes without applying
pnpm cognito:setup:dry

# Quick setup (skip dev server test)
pnpm cognito:setup:quick
```

### For CI/CD

```bash
# Trigger GitHub Actions workflow
# cognito-setup.yml removed — use Cognito console / AWS CLI
```

### For Debugging

```bash
# Verbose output
bash -x scripts/archive/cognito/cognito-setup.sh

# Manual step-by-step
aws sts get-caller-identity
aws ssm get-parameter --name "/cloudless/production/COGNITO_CLIENT_ID" --region us-east-1
```

## 🎯 Usage by Scenario

### New Team Member

> "I just cloned the repo, how do I set up Cognito auth?"

```bash
# Prerequisites: You must be on your local machine with AWS credentials set up
aws sso login --sso-session cloudless

# Then from the repo root
pnpm cognito:setup
pnpm dev
# Visit http://localhost:4000/en and test login
```

### Credential Rotation

> "My AWS credentials expired, what do I do?"

```bash
# Re-authenticate
aws sso login --sso-session cloudless

# Run setup again
pnpm cognito:setup
```

### CI/CD Setup

> "I want to automate Cognito setup in our GitHub Actions pipeline"

```bash
# The workflow is already created at `cognito-setup.yml` (removed)
# Just trigger it
# cognito-setup.yml removed — use Cognito console / AWS CLI
```

### Debugging Issues

> "The setup failed, what's wrong?"

```bash
# See what would happen without making changes
pnpm cognito:setup:dry

# Or run with verbose output
bash -x scripts/archive/cognito/cognito-setup.sh

# Check the logs
cat /tmp/dev-test.log
```

## 🔑 Key Features

✅ **Fully Automated**

- No manual credential handling
- No copy-paste required
- End-to-end verification

✅ **Safe & Reversible**

- Automatic backups
- Idempotent (safe to run multiple times)
- Easy rollback via backup files

✅ **Multiple Interfaces**

- CLI: `bash scripts/archive/cognito/cognito-setup.sh`
- pnpm: `pnpm cognito:setup`
- GitHub Actions: `# cognito-setup.yml removed — use Cognito console / AWS CLI`
- MCP: Programmatic access via tools
- Claude Code: `/cognito-setup` skill

✅ **Well-Documented**

- User guides with examples
- Architecture diagrams
- Troubleshooting section
- API documentation

✅ **Production-Ready**

- Error handling & recovery
- Security best practices
- Testing & verification
- CI/CD integration

## 📊 What Gets Automated

```
Step 1: AWS Authentication
├─ Check if credentials valid
├─ If not, prompt SSO login
└─ Verify identity

Step 2: Fetch Credentials from SSM
├─ Retrieve COGNITO_CLIENT_ID
├─ Retrieve COGNITO_CLIENT_SECRET (if exists)
└─ Verify both exist

Step 3: Update .env.local
├─ Backup existing file (.env.local.backup.TIMESTAMP)
├─ Update NEXT_PUBLIC_COGNITO_CLIENT_ID
├─ Update COGNITO_CLIENT_ID
├─ Update COGNITO_CLIENT_SECRET
└─ Preserve all other settings

Step 4: Test Dev Server
├─ Kill any existing dev server
├─ Start with pnpm dev
├─ Wait for server to be ready
├─ Test with curl http://localhost:4000/en
└─ Report success/failure
```

## 🐛 Troubleshooting Quick Links

| Problem | Link |
|---------|------|
| AWS credentials invalid | [COGNITO_SETUP.md#aws-credentials](./COGNITO_SETUP.md#prerequisites) |
| AWS CLI not found | [COGNITO_SETUP.md#aws-cli-not-found](./COGNITO_SETUP.md#aws-cli-not-found) |
| Permission denied | [COGNITO_SETUP.md#permission-denied](./COGNITO_SETUP.md#permission-denied-or-unauthorizedoperation) |
| SSM parameter not found | [COGNITO_SETUP.md#parameter-not-found](./COGNITO_SETUP.md#parameternot-found) |
| Dev server won't start | [COGNITO_SETUP.md#dev-server](./COGNITO_SETUP.md#dev-server-wont-start-after-setup) |

## 📞 Getting Help

1. **Check the docs** → Start with [COGNITO_SETUP.md](./COGNITO_SETUP.md)
2. **Try dry-run** → `pnpm cognito:setup:dry` to see what would happen
3. **Check logs** → Look at error output and `/tmp/dev-test.log`
4. **Manual test** → Try individual steps (aws sts, aws ssm, etc.)
5. **Ask for help** → Check #cloudless Slack or open an issue

## 🔗 Related Documentation

- [Cognito Setup Guide](./COGNITO_SETUP.md) — detailed user guide
- [Cognito Automation](./COGNITO_AUTOMATION.md) — how the automation works end to end

## 🏆 Implementation Status

**Status:** ✅ Complete and production-ready

**Test Coverage:**

- ✅ AWS CLI validation
- ✅ SSO authentication
- ✅ SSM parameter fetch
- ✅ .env.local update
- ✅ Dev server startup
- ✅ Error handling
- ✅ Backup/restore

**Documentation:**

- ✅ User guide
- ✅ Architecture docs
- ✅ API documentation
- ✅ Troubleshooting guide
- ✅ Implementation checklist

---

**Next Step:** Get valid AWS credentials and run `pnpm cognito:setup`
