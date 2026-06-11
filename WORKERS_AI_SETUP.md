# Cloudflare Workers AI Integration for cloudless.gr

Complete setup guide for adding AI-powered features to your public pages.

## ✅ Quick Start

### 1. Get Your Cloudflare API Token

1. Go to [dash.cloudflare.com → Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **"Create Token"**
3. Select **"Custom token"** (not "Use template")
4. Set permissions:
   - **AI** → `Run`
   - Set **Account Resources** to `All accounts`
5. Click **"Continue to Summary"** → **"Create Token"**
6. Copy the token value

### 2. Set Up Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Fill in your credentials:
   ```
   CLOUDFLARE_ACCOUNT_ID=fb7dc7b69b662480cd5961a4d1913c78
   CLOUDFLARE_API_TOKEN=your_token_here
   ```

### 3. Files Created

I've created three core files:

- **`server/api/ai/generate.ts`** — Backend handler that securely calls Cloudflare
- **`composables/useWorkersAI.ts`** — Vue 3 composable for consuming the API
- **`components/AIGenerator.vue`** — Ready-to-use component

### 4. Use It in Your Pages

In any `.vue` file, import and use the component:

```vue
<template>
  <div>
    <h1>Your Page</h1>
    <AIGenerator />
  </div>
</template>
```

Or use the composable directly:

```vue
<script setup>
const { loading, result, generate } = useWorkersAI()

const handleClick = async () => {
  await generate('Write a catchy product tagline')
}
</script>
```

---

## 🎯 Use Cases for cloudless.gr

### 1. **Title/Description Generation**
Help users auto-generate design titles and descriptions:

```typescript
await generate('Generate a catchy title for a minimalist logo design')
```

### 2. **Content Suggestions**
Suggest improvements while users design:

```typescript
await generate('Suggest 3 color palettes for a modern SaaS dashboard')
```

### 3. **Copy Writing**
Generate product copy, taglines, etc:

```typescript
await generate('Write a compelling 1-line description for a design tool')
```

---

## 💰 Pricing

- **Free tier**: 10,000 neurons/day (no cost)
- **Paid**: $0.011 per 1,000 neurons
- **Models available**:
  - `@cf/meta/llama-3-8b-instruct` (fast, good for most tasks)
  - `@cf/meta/llama-3-70b-instruct` (slower, higher quality)

**Example costs:**
- 100 requests/day at 500 neurons each = ~$0.55/month

---

## 🔒 Security Notes

✅ **What I did right:**
- API token never exposed to client
- Token stored in environment variables
- All requests go through your backend

⚠️ **Add these for production:**

### Rate Limiting (prevent abuse)

```typescript
// In server/api/ai/generate.ts, add:
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 requests/hour per IP
})

const { success } = await ratelimit.limit(
  event.node.req.headers['x-forwarded-for'] || '127.0.0.1'
)
if (!success) throw createError({ statusCode: 429, statusMessage: 'Rate limited' })
```

### Cost Tracking (monitor spending)

```typescript
// Log every usage
await db.aiUsage.create({
  userId: user.id,
  prompt: prompt.substring(0, 100),
  tokens: data.result?.output_tokens || 0,
  cost: (data.result?.output_tokens || 0) * 0.000005,
  timestamp: new Date()
})
```

### Error Boundaries (graceful fallback)

```vue
<template>
  <div v-if="error" class="error-alert">
    {{ error }}
    <button @click="reset">Try again</button>
  </div>
</template>
```

---

## 🧪 Testing

### Local Development

```bash
npm run dev
# Visit http://localhost:3000 and use the AIGenerator component
```

### Test with Real Prompts

- "Write a tagline for a design tool"
- "Suggest 5 color palettes for a modern dashboard"
- "Generate alternative headlines for a landing page"

### Monitor Usage

Check your Cloudflare dashboard for token consumption:
[dash.cloudflare.com → AI → Analytics](https://dash.cloudflare.com/ai/analytics)

---

## 📋 Deployment Checklist

- [ ] Copy `.env.local.example` to `.env.local`
- [ ] Add `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`
- [ ] Test locally with `npm run dev`
- [ ] Add rate limiting for production
- [ ] Set up cost tracking/alerts
- [ ] Deploy to your hosting
- [ ] Monitor token usage in Cloudflare dashboard
- [ ] Set up error alerts if costs exceed budget

---

## 🆘 Troubleshooting

### "Cloudflare credentials not configured"
- Ensure `.env.local` exists in your project root
- Check that `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are set
- Restart dev server after changing `.env.local`

### "Too many requests"
- You're hitting rate limits (add the sliding window code above)
- Implement exponential backoff in the client

### "401 Unauthorized"
- Your API token expired or is invalid
- Go to Cloudflare dashboard → regenerate token
- Update `.env.local`

### High cost/unexpected token usage
- Add cost tracking to see where tokens go
- Consider switching to 8B model (faster, cheaper)
- Implement prompt caching for repeated requests

---

## 📚 Next Steps

1. **Integrate into your design editor** — add quick-action buttons for "Generate Title", "Generate Description", etc.

2. **Add prompt templates** — prewrite good prompts for common use cases

3. **Cache results** — store generated content to reduce API calls

4. **A/B test models** — compare 8B vs 70B outputs for your use case

---

## Resources

- [Cloudflare Workers AI Docs](https://developers.cloudflare.com/workers-ai/)
- [API Reference](https://developers.cloudflare.com/workers-ai/platform/models/)
- [Pricing](https://www.cloudflare.com/en-gb/products/workers-ai/)

Questions? Check the Cloudflare docs or feel free to ask!
