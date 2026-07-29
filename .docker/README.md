# Docker MCP Profile for Cloudless.gr

This directory contains Docker MCP Toolkit configuration for the cloudless.gr development environment.

## Current Status

- Docker MCP CLI version: v0.42.2 ✓
- Docker Engine: 29.6.1 ✓
- Docker Desktop: Not running (required for profile commands)

## Profile Configuration

The `mcp-profile.json` file defines a development profile optimized for cloudless.gr:

| Server | Purpose |
|--------|---------|
| github-official | GitHub API integration (issues, PRs, repos) |
| playwright | Browser automation for testing |
| cloudflare | Cloudflare API (Workers, Pages, R2, DNS) |
| brave-search | Web search capabilities |
| sequentialthinking | Planning and reasoning tools |
| filesystem | File system access |
| git | Git operations |
| docker | Docker container management |

## Setup Instructions

### 1. Import the Profile (when Docker Desktop is available)

```bash
# Import the profile
docker mcp profile import .docker/mcp-profile.json

# Or create manually
docker mcp profile create --name cloudless-dev
docker mcp profile server add cloudless-dev \
  --server catalog://mcp/docker-mcp-catalog/github-official \
  --server catalog://mcp/docker-mcp-catalog/playwright \
  --server catalog://mcp/docker-mcp-catalog/cloudflare \
  --server catalog://mcp/docker-mcp-catalog/sequentialthinking \
  --server catalog://mcp/docker-mcp-catalog/filesystem \
  --server catalog://mcp/docker-mcp-catalog/git \
  --server catalog://mcp/docker-mcp-catalog/docker
```

### 2. Configure Secrets

```bash
# GitHub token
docker mcp secret set GITHUB_PERSONAL_ACCESS_TOKEN

# Cloudflare credentials
docker mcp secret set CLOUDFLARE_API_TOKEN
docker mcp secret set CLOUDFLARE_ACCOUNT_ID

# Brave Search API key
docker mcp secret set BRAVE_API_KEY
```

### 3. Run the Gateway

```bash
# Run with profile
docker mcp gateway run --profile cloudless-dev

# Or connect to a client
docker mcp client connect vscode --profile cloudless-dev
```

### 4. VS Code Integration

Add to your `.vscode/settings.json`:

```json
{
  "cline.mcpMode": "stdio",
  "cline.mcpGatewayCommand": "docker mcp gateway run --profile cloudless-dev"
}
```

## Alternative: Use Existing MCP Configuration

The project already has MCP configured via `mcp.json` and `~/.cline/data/settings/cline_mcp_settings.json`. These will work without Docker Desktop being fully connected.

## Related Documentation

- [MCP Integration Guide](../../DevDocs/storage/markdown/devdocs-mcp-integration.md)
- [Migration Completion Status](../../DevDocs/storage/markdown/migration-completion.md)
- [Restart MCP Instructions](../../DevDocs/storage/markdown/restart-mcp-instructions.md)
