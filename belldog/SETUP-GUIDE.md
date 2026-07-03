# Belldog Setup Guide for www.cloudless.gr

## Overview
Belldog is a self-hosted Slack webhook proxy that allows you to:
- Generate webhook URLs with slash commands (`/belldog-generate`)
- Manage tokens and channels
- Proxy webhooks from any service to Slack
- Handle channel renames and token migrations

## Prerequisites
1. Access to create a Slack app at https://api.slack.com/apps
2. Your K3S cluster with kubectl access

---

## Step 1: Create Slack App

1. Go to https://api.slack.com/apps
2. Click **Create New App**
3. Choose **From scratch**
4. Name: `Belldog Proxy` or `Cloudless Alerts Proxy`
5. Workspace: Select **www.cloudless.gr**
6. Click **Create App**

### Add Required Scopes
Go to **OAuth & Permissions → Scopes → Bot Token Scopes** and add:
- `chat:write.public` - Post to any channel
- `chat:write` - Required by chat:write.public
- `groups:write` - Post to private channels
- `commands` - Slash commands
- `channels:read` - List public channels
- `groups:read` - List private channels

### Install App to Workspace
1. Go to **OAuth & Permissions**
2. Click **Install to Workspace** (or **Reinstall to Workspace** if updating)

### Copy Required Values
1. **Bot User OAuth Token**: Starts with `xoxb-...`
2. **Signing Secret**: Found in **Basic Information → App Credentials**

---

## Step 2: Setup DynamoDB (Required for Belldog)

Belldog requires DynamoDB for token storage. You have two options:

### Option A: Use AWS DynamoDB (Recommended)
1. Create a DynamoDB table named `belldog-tokens`
2. Partition key: `channel_name` (string)
3. Enable TTL for automatic cleanup

### Option B: Use Local DynamoDB (Development only)
- Belldog can run with DynamoDB local, but not recommended for production

---

## Step 3: Deploy Belldog to K3S

### Update Environment Variables
Edit `/home/tbaltzakis/cloudless.gr/belldog/belldog-secrets.yaml` with your values:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: belldog-secrets
  namespace: belldog
type: Opaque
stringData:
  SLACK_TOKEN: "xoxb-YOUR-BOT-TOKEN-HERE"
  SLACK_SIGNING_SECRET: "YOUR-SIGNING-SECRET-HERE"
```

### Apply the Configuration
```bash
# Create the namespace
kubectl apply -f namespace.yaml

# Create the secrets (update with your values first!)
kubectl apply -f belldog-secrets.yaml

# Create config and deployments
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# Apply ingress (if using nginx ingress)
kubectl apply -f ingress.yaml
```

---

## Step 4: Configure Slash Commands in Slack

Go to **Slack App → Interactivity & Shortcuts → Slash Commands** and add:

| Command | Request URL | Short Description |
|---------|-------------|-------------------|
| `/belldog-generate` | https://belldog.cloudless.gr/slash | Generate token and webhook URL |
| `/belldog-show` | https://belldog.cloudless.gr/slash | Show all tokens in this channel |
| `/belldog-regenerate` | https://belldog.cloudless.gr/slash | Generate another token |
| `/belldog-revoke` | https://belldog.cloudless.gr/slash | Revoke a token |
| `/belldog-revoke-renamed` | https://belldog.cloudless.gr/slash | Revoke after channel rename |

---

## Step 5: Test the Setup

1. **Open Slack** in your www.cloudless.gr workspace
2. **Type** `/belldog-generate` in any channel
3. **Response**: Belldog will generate a webhook URL and send it to the channel

Example response:
```
✓ Token generated! Your webhook URL is:
https://belldog.cloudless.gr/p/mychannel/abc123xyz/

Use this URL to post messages to this channel.
```

4. **Test posting**:
```bash
curl -XPOST --json '{"text":"Hello from Belldog!"}' \
  'https://belldog.cloudless.gr/p/mychannel/abc123xyz/'
```

5. **Check Slack** - the message should appear in the channel

---

## Usage

### Generate a Webhook URL
```
/belldog-generate
```
Response: Webhook URL for the current channel

### Show Tokens in Current Channel
```
/belldog-show
```
Response: List of all active tokens in this channel

### Regenerate Token
```
/belldog-regenerate
```
Response: New webhook URL (old token remains valid for migration)

### Revoke Token
```
/belldog-revoke
```
Response: Token revoked successfully

### Revoke After Channel Rename
```
/belldog-revoke-renamed
```
Use after renaming a channel to revoke the old token

---

## Migration from Old Webhooks

If you have existing webhooks:

1. Generate new token: `/belldog-generate`
2. Replace old webhook URLs with new one
3. After all services updated, revoke old token: `/belldog-revoke`

---

## Files Created

```
belldog/
├── namespace.yaml          # K8s namespace
├── configmap.yaml          # Configuration
├── deployment.yaml         # Belldog deployment
├── service.yaml            # ClusterIP service
├── ingress.yaml            # Ingress (belldog.cloudless.gr)
├── belldog-secrets.yaml    # Slack credentials (CREATE THIS)
└── SETUP-GUIDE.md          # This file
```

---

## Monitoring

```bash
# Check pod status
kubectl get pods -n belldog

# Check logs
kubectl logs -n belldog deployment/belldog -f

# Check service
kubectl get svc -n belldog

# Test endpoint
kubectl port-forward -n belldog deployment/belldog 8080:8080
curl http://localhost:8080/
```

---

## Troubleshooting

### Pod Crashing
```bash
kubectl logs -n belldog deployment/belldog
kubectl describe pod -n belldog deployment/belldog
```

### Slash Commands Not Working
- Verify Request URL in Slack app settings points to `https://belldog.cloudless.gr/slash`
- Ensure `/` suffix is included
- Check ingress/LoadBalancer is accessible from Slack

### Token Not Generated
- Verify DynamoDB table `belldog-tokens` exists and is accessible
- Check SLACK_TOKEN and SLACK_SIGNING_SECRET are correct

---

## Next Steps

1. Test `/belldog-generate` in a test channel
2. Update alert-api or other services to use Belldog-generated URLs
3. Monitor Belldog for a few days to ensure stability
4. Migrate existing webhooks to Belldog-managed URLs

---

## Benefits Over Direct Webhooks

1. **Channel-agnostic**: Generate token once, use for any channel
2. **Token rotation**: Easy token migration without updating services
3. **Channel rename protection**: Belldog tracks channel IDs
4. **Centralized management**: All tokens in one place
5. **Security**: Tokens not exposed in service configs
