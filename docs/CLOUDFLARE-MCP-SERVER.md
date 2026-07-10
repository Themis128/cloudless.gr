# Cloudflare MCP Server Configuration

## MCP Server Details
| Property | Value |
|----------|-------|
| Endpoint | `https://mcp.cloudflare.com/mcp` |
| Name | `cloudflare` (in mcp.json) |
| Access | CLOUDFLARE_API_TOKEN or OAuth via `npx wrangler login` |
| Status | ✅ Active |

## Available Tools

| Tool | Description | Status |
|------|-------------|--------|
| `r2_bucket_list` | List all R2 buckets | ✅ Working |
| `r2_object_get` | Download object from R2 | ✅ Working |
| `r2_object_put` | Upload object to R2 | ✅ Working |
| `r2_bucket_info` | Get bucket details | ✅ Working |
| `r2_bucket_create` | Create new bucket | ✅ Working |

## MCP Configuration (mcp.json)

```json
"cloudflare": {
  "command": "npx",
  "args": ["mcp-remote", "https://mcp.cloudflare.com/mcp"],
  "env": {
    "CLOUDFLARE_API_TOKEN": "${CLOUDFLARE_API_TOKEN}"
  }
}
```

## R2 Website Bucket

| Property | Value |
|----------|-------|
| Bucket | `cloudless-assets` |
| Binding | `ASSETS_BUCKET` |
| Location | EEUR |
| Use | Static website hosting |
| Objects | 3 ✅ |

## Worker Email Integration

The worker has `send_email` binding configured in `wrangler.json` but requires Email Routing to be enabled in the Cloudflare Dashboard for the EMAIL binding to work.

### Current Bindings in wrangler.json
- `r2_buckets` - 4 buckets configured ✅
- `d1_databases` - AUTH_DB configured ✅
- `send_email` - EMAIL binding configured (requires Email Routing setup) ⚠️

## Verification Commands

```bash
# Check authentication
npx wrangler whoami

# List R2 buckets
npx wrangler r2 bucket list

# Check bucket info
npx wrangler r2 bucket info cloudless-assets --config wrangler-cloudflare-free.json

# Test health endpoint
curl https://fully-migrated-serverless-stack.baltzakis-themis.workers.dev/api/health

# Check worker deployments
npx wrangler deployments list --config wrangler-cloudflare-free.json
```

## API Token Requirements

For MCP server access, the CLOUDFLARE_API_TOKEN needs:
- Account R2 Storage: Read/Write
- Workers Scripts: Read/Write
- D1 Database: Read/Write