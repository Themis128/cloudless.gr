# cognito-setup-mcp — Cognito Setup MCP Server

Programmatic interface for automated Cognito authentication setup.

## Quick Start

```bash
# Start the MCP server
npx tsx tools/cognito-setup-mcp/src/index.ts

# Or use the pnpm alias (once wired into mcp.json)
pnpm cognito:setup:mcp
```

## Tools Provided

### 1. `cognito_check_aws_creds`

Check AWS credentials and authenticate if needed.

**Input:** None

**Output:**

```json
{
  "success": true,
  "message": "Authenticated as arn:aws:iam::123456789:user/...",
  "data": {
    "identity": {
      "UserId": "AIDAI...",
      "Account": "123456789",
      "Arn": "arn:aws:iam::123456789:user/username"
    }
  }
}
```

**Error Handling:**

- If credentials invalid: attempts SSO login
- If SSO unavailable: returns helpful error message

---

### 2. `cognito_fetch_credentials`

Fetch Cognito credentials from AWS SSM Parameter Store.

**Input:** None

**Output:**

```json
{
  "success": true,
  "message": "Successfully fetched Cognito credentials from SSM",
  "data": {
    "clientId": "4qmvj6c7n00bmq4spl0eshvqvp",
    "clientSecret": "secret1234567890...",
    "fullClientSecret": "secret..."
  }
}
```

**SSM Parameters:**

- `/cloudless/production/COGNITO_CLIENT_ID` (required)
- `/cloudless/production/COGNITO_CLIENT_SECRET` (optional, for public clients)

---

### 3. `cognito_update_env`

Update `.env.local` with fetched credentials.

**Input:**

```json
{
  "clientId": "4qmvj6c7n00bmq4spl0eshvqvp",
  "clientSecret": "secret..." // optional
}
```

**Output:**

```json
{
  "success": true,
  "message": "Updated .env.local with Cognito credentials",
  "data": {
    "clientId": "4qmvj6c7n00bmq4spl0eshvqvp",
    "backupPath": ".env.local.backup.1686547200"
  }
}
```

**Side Effects:**

- Backs up existing `.env.local` to `.env.local.backup.TIMESTAMP`
- Updates these lines:
  - `NEXT_PUBLIC_COGNITO_CLIENT_ID=...`
  - `COGNITO_CLIENT_ID=...`
  - `COGNITO_CLIENT_SECRET=...` (if provided)

---

### 4. `cognito_test_dev_server`

Start dev server and verify Cognito auth works.

**Input:**

```json
{
  "timeout": 30 // seconds (optional, default 30)
}
```

**Output:**

```json
{
  "success": true,
  "message": "Dev server started successfully with Cognito config"
}
```

**Process:**

1. Kill any existing `next dev` processes
2. Start `pnpm dev` in background
3. Wait up to `timeout` seconds for server to be reachable
4. Test endpoint: `curl http://localhost:4000/en`
5. Report success or timeout

---

### 5. `cognito_full_setup` (Orchestrator)

Run the complete setup workflow.

**Input:**

```json
{
  "skipVerify": false,  // Skip dev server test
  "dryRun": false      // Preview without making changes
}
```

**Output:**

```json
{
  "success": true,
  "message": "✓ Cognito setup complete!",
  "data": {
    "steps": [
      {
        "name": "AWS Authentication",
        "success": true,
        "message": "Authenticated as arn:aws:iam::..."
      },
      {
        "name": "Fetch Credentials",
        "success": true,
        "message": "Successfully fetched Cognito credentials from SSM"
      },
      // ... more steps
    ],
    "nextSteps": [
      "pnpm dev — Start dev server",
      "Visit http://localhost:4000/en",
      "Click 'Sign in' to test Cognito authentication"
    ]
  }
}
```

**Dry Run Mode:**

- Shows what would be changed
- No actual file modifications
- Useful for previewing changes

**Skip Verify Mode:**

- Faster setup (skips dev server test)
- Useful when you know it works
- Still validates all credentials

---

## Integration with Claude Code

### Method 1: Direct MCP Integration

Add to `mcp.json`:

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

Then in Claude Code:

```
/cognito-setup   # or call tools directly
```

### Method 2: Via Skill

The `cognito-setup` skill wraps this MCP server.

---

## Usage Examples

### Example 1: Check Credentials

```typescript
const result = await mcp.call("cognito_check_aws_creds", {});
if (result.success) {
  console.log(`Authenticated as: ${result.data.identity.Arn}`);
} else {
  console.error(`Auth failed: ${result.message}`);
}
```

### Example 2: Dry Run

```typescript
const result = await mcp.call("cognito_full_setup", {
  dryRun: true,
  skipVerify: false
});

// Preview what would happen
result.data.steps.forEach(step => {
  console.log(`${step.success ? '✓' : '✗'} ${step.name}: ${step.message}`);
});
```

### Example 3: Full Setup with Error Handling

```typescript
try {
  const result = await mcp.call("cognito_full_setup", {
    skipVerify: false,
    dryRun: false
  });

  if (result.success) {
    console.log("Setup complete!");
    result.data.nextSteps.forEach(step => console.log(`• ${step}`));
  } else {
    console.error(`Setup failed: ${result.message}`);
  }
} catch (error) {
  console.error(`MCP error: ${error.message}`);
}
```

---

## Error Codes

| Error | Meaning | Recovery |
|-------|---------|----------|
| `AWS_CLI_NOT_FOUND` | AWS CLI not installed | Install with `pip install awscli` |
| `AWS_AUTH_FAILED` | Credentials invalid or expired | Run `aws sso login --sso-session cloudless` |
| `SSM_PARAMETER_NOT_FOUND` | Cognito parameter doesn't exist | Verify SSM path and permissions |
| `ENV_FILE_NOT_FOUND` | `.env.local` doesn't exist | Create with default values or restore from backup |
| `DEV_SERVER_TIMEOUT` | Dev server didn't start | Check `/tmp/dev-test.log` for details |

---

## Architecture

```
cognito_full_setup (orchestrator)
├─ cognito_check_aws_creds
│  └─ aws sts get-caller-identity
│     └─ (retry with SSO login if fails)
├─ cognito_fetch_credentials
│  └─ aws ssm get-parameter (CLIENT_ID + SECRET)
├─ cognito_update_env
│  └─ Read + modify + write .env.local
└─ cognito_test_dev_server
   ├─ pnpm dev (background)
   └─ curl http://localhost:4000/en (polling)
```

---

## Testing

```bash
# Manual test
npx tsx tools/cognito-setup-mcp/src/index.ts << 'EOF'
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "cognito_check_aws_creds",
    "arguments": {}
  }
}
EOF
```

---

## See Also

- [Cognito Setup Guide](../../docs/COGNITO_SETUP.md)
- [Cognito Automation Suite](../../docs/COGNITO_AUTOMATION.md)
- [Bash Script](../../scripts/cognito-setup.sh)
- [Claude Code Skill](./.claude/skills/cognito-setup/)
