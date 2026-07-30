# Cloudflare Free Tier Services Guide

## Chatbot / AI - Workers AI

**Yes, you can use free models!** Workers AI includes:

| Model | Free Tier Limit | Notes |
|-------|-----------------|-------|
| LLaMA 3.1 8B | 100K tokens/day | General purpose |
| Mistral 7B | 100K tokens/day | Good for chat |
| Gemma 2B | 100K tokens/day | Fast, lightweight |

### Usage (wrangler.jsonc bindings):

```jsonc
{
  "ai": {
    "binding": "AI",
    "remote": true  // Workers AI is always remote
  }
}
```

### Code Example:

```typescript
// src/lib/chat-free.ts
export async function getChatResponse(
  messages: Array<{role: string, content: string}>,
  env: CloudflareEnv
): Promise<string> {
  const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
    messages,
    max_tokens: 512,
  });
  
  return (result as any).response || "";
}
```

## Email - Replacing AWS SES

### Option A: Keep AWS SES (Recommended)

- Still costs ~$0.50 per 1000 emails
- Works with Workers via SDK
- No breaking changes required
- SES domain verification already set up for `cloudless.gr`

### Option B: Cloudflare Email Routing + SMTP Relay

1. **Email Routing** (free): Forwards emails to Gmail/Outlook
2. **SMTP Service** (free tier alternatives):
   - **SendGrid**: 100 emails/day free
   - **Mailgun**: 5k emails/month free
   - **Postmark**: 100 emails/month free

### Option C: Ethereal Email (Development Only)

- Completely free SMTP sandbox
- Emails are captured, not delivered
- Use for testing

### Email Integration for Workers:

```typescript
// Using any SMTP service with Workers
import { SmtpClient } from "smtp-client";

export async function sendEmailFree(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  // Use SendGrid/Mailgun SMTP credentials stored as Wrangler secrets
  const client = new SmtpClient({
    host: env.SMTP_HOST,
    port: 587,
    secure: true,
  });
  
  // ... send logic
}
```

## Migration Impact on Email

| Current AWS SES | Cloudflare Alternative | Cost | Breaking Changes |
|-----------------|----------------------|------|------------------|
| `noreply@cloudless.gr` | Keep SES (no change) | ~$1-5/month | ❌ None |
| Order confirmations | SendGrid/Mailgun | Free tier covers | ⚠️ SMTP change |
| Contact acknowledgment | Any SMTP provider | Free tier covers | ⚠️ SMTP change |
| Newsletter | Use existing provider | Same | ❌ None |

## Recommended Approach

1. **Phase 1**: Keep AWS SES for production emails
2. **Phase 2**: Add SendGrid for backup (free tier)
3. **Phase 3**: Migrate chat to Workers AI free tier

The email templates in `src/lib/email.ts` will work with any SMTP provider - just need to swap the client.
