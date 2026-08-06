# Postiz Service Token Setup for Worker-to-Postiz Communication

## �� 🎯 Problem Solved
Fixed the 502 errors in the GitHub Actions workflow (`postiz-crons.yml`) that occurred when the Workers cron job tried to communicate with the Postiz API protected by Cloudflare Access.

## �� 🔧 Changes Made

### 1. Modified `src/lib/postiz.ts`
- Added `extractClientIdFromToken()` helper function to parse JWT Service Tokens
- Updated `postizFetch()` function to include Cloudflare Access headers when `POSTIZ_SERVICE_TOKEN` is configured:
  - `Cf-Access-Client-Id`: Extracted from the Service Token JWT
  - `Cf-Access-Client-Secret`: The full Service Token JWT

### 2. Updated `wrangler-cloudless2.json`
- Added `POSTIZ_SERVICE_TOKEN` to the `secrets.required` array for both production and staging environments

## �� 📋 Setup Instructions

### Step 1: Create Cloudflare Service Token
1. Go to Cloudflare Dashboard → **Access** → **Service Tokens**
2. Click **"Create Service Token"**
3. Configure:
   - **Name:** `postiz-cron-worker`
   - **Description:** "Allows cloudless.gr Workers to access Postiz API"
4. Click **"Create Service Token"**
5. **IMPORTANT:** Copy the entire JWT token immediately (you won't see it again!)

### Step 2: Configure Postiz Access Policy
1. Go to Cloudflare Dashboard → **Access** → **Applications**
2. Find your Postiz application (`postiz.cloudless.gr`)
3. Edit the **Policy** tab
4. Under "Identity Providers", click **"Add an exception"**
5. Choose **"Service Token"** as the type
6. Paste the Service Token JWT you saved
7. Set action to **"Allow"**
8. **Save the policy**

### Step 3: Configure Worker Secret
```bash
# For production environment:
wrangler secret put POSTIZ_SERVICE_TOKEN --env production
# When prompted, paste your Service Token JWT

# For local development/testing:
wrangler secret put POSTIZ_SERVICE_TOKEN
# When prompted, paste your Service Token JWT
```

### Step 4: Deploy Your Worker
```bash
# For production:
wrangler deploy --env production

# Or if using the main wrangler config:
wrangler deploy
```

## �� 🧪 Verification

### Manual Test
After deployment, test your cron endpoint:
```bash
curl -v -H "Authorization: Bearer f3ceb8055e34b18c12d4b71dc78bd7395ae835a8bd8dd96a060229d02adf6102" \
  "https://pi-origin.cloudless.gr/api/cron/postiz-sync"
```

### Using Verification Script
```bash
node verify-postiz-token.js
```

### Check Cloudflare Access Logs
1. Go to Cloudflare Dashboard → **Access** → **Audit Log**
2. Filter for your Postiz application
3. Look for successful service token authentications

## �� 🛡��️ Security Notes

- **Never commit Service Tokens to git** - always use secrets management
- **Rotate tokens periodically** - consider refreshing every 90 days
- **Monitor usage** - check Access logs regularly for unexpected usage
- **The Service Token provides broad access** to your Postiz application via Cloudflare Access
- Ensure your Postiz application's Access policy is appropriately scoped

## �� 🔄 Troubleshooting

If you still see 502 errors:

1. **Double-check the token** - ensure you copied the entire JWT correctly
2. **Verify Access policy** - confirm the Service Token exception is saved and active
3. **Check worker logs** - look for any errors in your Worker deployment
4. **Test token extraction** - the verification script helps validate JWT parsing
5. **Confirm API reachability** - test direct access to Postiz API from a known location

## �� 📝 Files Modified

1. `src/lib/postiz.ts` - Added Service Token handling
2. `wrangler-cloudless2.json` - Added POSTIZ_SERVICE_TOKEN to secrets
3. `verify-postiz-token.js` - Verification helper script (optional)
4. `SERVICE_TOKEN_SETUP.md` - This documentation

## �� 🎉 Expected Outcome

After completing these steps, your GitHub Actions workflow should:
1. Successfully authenticate via CRON_SECRET (no more 401 errors)
2. Successfully communicate with Postiz API via Service Token (no more 502 errors)
3. Return successful JSON responses showing sync statistics
