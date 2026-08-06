# Email Service — Cloudflare Email (migrated from AWS SES)

Email is now sent via Cloudflare Email Service (Workers email binding) or Resend as fallback.

**Legacy documentation:** This file previously documented AWS SES SMTP setup. The SES-based SMTP workflow has been decommissioned. See `src/lib/email-sender.ts` for current implementation.

## Current Email Architecture

| Component | Description |
|-----------|-------------|
| Workers | Uses `env.EMAIL` binding (no API keys needed) |
| Node/Worker fallback | Cloudflare Email REST API or Resend |

## Email Configuration

### Cloudflare Email Binding

The `EMAIL` binding is configured in `wrangler.jsonc`:

```json
{
  "send_email": [
    {
      "name": "EMAIL"
    }
  ]
}
```

### Resend Fallback

If Cloudflare Email is not configured, Resend can be used:

- `RESEND_API_KEY` environment variable required

## Apps Using Email

| App | Namespace | Purpose |
|-----|-----------|---------|
| Frontend | N/A | Contact forms, newsletters, notifications |
| Portal | portals | Booking confirmations, etc. |
| Contact forms | API routes | User inquiries |

## Testing

```bash
# Test email functionality
node -e "const {sendEmail} = require('./src/lib/email-sender.ts'); sendEmail({to: 'test@example.com', subject: 'Test', html: '<p>Test</p>', text: 'Test'})"
```

## Migration Status

- ✅ AWS SES has been replaced with Cloudflare Email
- ⚠️ SES SMTP credentials have been removed from SSM (use Cloudflare binding)
- ⚠️ Legacy AWS SES IAM policies have been deleted
