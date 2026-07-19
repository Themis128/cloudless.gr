# Cloudless Namespace - k3s Deployment

Kubernetes resources for the cloudless.gr application when running on k3s (SSM_DISABLED=1 mode).

## Quick Start

```bash
# Apply namespace and secrets
kubectl apply -f infrastructure/cloudless/namespace.yaml
kubectl apply -f infrastructure/cloudless/secrets.yaml

# Add SSM_DISABLED=1 to your deployment environment
# This tells the app to read secrets from process.env instead of AWS SSM
```

## Secret Configuration

The `secrets.yaml` file contains `ADMIN_ALERT_SECRET` and placeholders for other credentials.

### For Cloudflare Workers (Recommended)

Set the secret via Wrangler instead of k3s:

```bash
# Set ADMIN_ALERT_SECRET for Workers
echo "463953c7f9183ee69c0c4fc18495e72543398d79bdcf9702478dd59d920fc7b6" | npx wrangler secret put ADMIN_ALERT_SECRET

# Other common secrets
npx wrangler secret put SESSION_SECRET
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put POSTIZ_API_KEY
```

Or use the bulk setup script:

```bash
# Load your .env file and run the bulk secret script
export $(cat .env.local | grep -v '^#' | xargs)
CLOUDFLARE_API_TOKEN=your-token ./scripts/save-secrets-to-cloudflare.sh
```

### For k3s (SSM_DISABLED=1 mode)

The secret is mounted into the pod via environment variables. Ensure your deployment
includes `SSM_DISABLED=1` so the app reads from `process.env` instead of SSM.

## Usage

The `/api/webhooks/admin-alert` endpoint requires the `x-cloudless-alert-secret` header
to match the `ADMIN_ALERT_SECRET` value. This endpoint is used by:

- Sentry webhook alerts
- Pi alert-api Lambda for high-severity alerts
- Any cron/health check that needs operator notification

## Testing

```bash
# Test the webhook (replace with actual secret)
curl -X POST https://cloudless.gr/api/webhooks/admin-alert \
  -H "Content-Type: application/json" \
  -H "x-cloudless-alert-secret: 463953c7f9183ee69c0c4fc18495e72543398d79bdcf9702478dd59d920fc7b6" \
  -d '{"severity":"info","title":"Test Alert","message":"Testing admin alert webhook"}'