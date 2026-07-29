# Cloudflare API Token Permissions Required

Your current API token is authenticated but needs additional permissions for the migration.

## Required Token Permissions

Visit: https://dash.cloudflare.com/profile/api-tokens

Your API token needs these permissions:

### Account Permissions

- **D1 Data**: Read, Write
- **Workers Scripts**: Read, Write
- **Workers Routes**: Read, Write
- **R2 Storage**: Read, Write
- **Workers KV**: Read, Write (if using KV)
- **Workers AI**: Read (optional)

### Zone Permissions (for your domain)

- **Zone**: Read
- **DNS**: Read, Write

## Create New Token

Use this template:

```
Permissions:
- Account D1 Data: Read, Write
- Account Workers Scripts: Read, Write
- Account Workers Routes: Read, Write
- Account R2 Storage: Read, Write
- Account Workers KV Storage: Read, Write

Resources:
- Include: Account Settings
- Include: All accounts (or specific account)
- Include: Specific zone (cloudless.gr)
```

## Verify Token Permissions

```bash
# Test D1 access
CLOUDFLARE_API_TOKEN=your_token npx wrangler d1 list

# Test R2 access  
CLOUDFLARE_API_TOKEN=your_token npx wrangler r2 bucket list

# Test Workers access
CLOUDFLARE_API_TOKEN=your_token npx wrangler whoami
```

## Current Token Status

```bash
npx wrangler whoami
```

Shows: Authenticated but may lack D1 write permissions.
