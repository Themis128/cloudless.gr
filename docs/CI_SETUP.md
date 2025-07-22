# CI/CD Setup Guide

This guide explains how to set up the CI/CD pipeline with proper environment variables and secrets.

## 🔐 Required GitHub Secrets

The integration tests require real Supabase credentials to function properly. Follow these steps to set up the required secrets:

### 1. Go to GitHub Repository Settings

1. Navigate to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**

### 2. Add Repository Secrets

Click **New repository secret** and add the following secrets:

#### `SUPABASE_URL`

- **Value**: Your Supabase project URL
- **Format**: `https://your-project-id.supabase.co`
- **Example**: `https://abcdefghijklmnop.supabase.co`

#### `SUPABASE_ANON_KEY`

- **Value**: Your Supabase anonymous/public API key
- **Format**: A long string starting with `eyJ...`
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 3. How to Find Your Supabase Credentials

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **Project URL** and **anon/public** key

## 🧪 Testing Locally

You can test the server locally with the same environment as CI:

### Using the Local Test Script

```bash
# Test with real credentials
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_ANON_KEY=your-anon-key \
./test-local.sh

# Test with fallback credentials (will likely fail)
./test-local.sh
```

### Manual Testing

```bash
# Set environment variables
export NODE_ENV=production
export NUXT_HOST=0.0.0.0
export NUXT_PORT=3000
export NUXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
export NUXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Run the server
node --trace-uncaught --trace-warnings .output/server/index.mjs
```

## 🔍 Debugging Integration Test Failures

If the integration tests are still failing after setting up the secrets:

### 1. Check Secret Names

Ensure the secrets are named exactly:

- `SUPABASE_URL` (not `SUPABASE_PROJECT_URL`)
- `SUPABASE_ANON_KEY` (not `SUPABASE_API_KEY`)

### 2. Verify Secret Values

- The URL should start with `https://` and end with `.supabase.co`
- The key should be a long JWT token starting with `eyJ`

### 3. Check CI Logs

The CI workflow includes multiple fallback tests that will show detailed error information:

- Debug integration test
- Simple integration test
- Basic server test
- Node.js debug test
- Direct server test
- ES Module test
- Verbose Node.js error test
- Startup error handler test

### 4. Common Issues

#### Invalid Supabase Credentials

```
❌ Error appears to be Supabase-related
```

**Solution**: Verify your Supabase URL and API key are correct

#### Missing Dependencies

```
❌ Cannot find module 'h3'
```

**Solution**: Run `npm ci` before building

#### Port Already in Use

```
⚠️ Port already in use
```

**Solution**: The CI environment should handle this automatically

## 🚀 CI Workflow Overview

The CI workflow includes these steps:

1. **Lint & Type Check**: ESLint and TypeScript validation
2. **Build Test**: Multi-version Node.js build testing
3. **Security Check**: npm audit and vulnerability scanning
4. **Integration Test**: Server startup and health checks
5. **E2E Tests**: Playwright browser testing
6. **Accessibility Tests**: WCAG compliance checks
7. **Performance Tests**: Bundle size analysis

## 📝 Environment Variables Reference

| Variable                        | Description          | Required | Default                    |
| ------------------------------- | -------------------- | -------- | -------------------------- |
| `NODE_ENV`                      | Node.js environment  | Yes      | `production`               |
| `NUXT_HOST`                     | Server host          | Yes      | `0.0.0.0`                  |
| `NUXT_PORT`                     | Server port          | Yes      | `3000`                     |
| `NUXT_PUBLIC_SUPABASE_URL`      | Supabase project URL | Yes      | `https://test.supabase.co` |
| `NUXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase API key     | Yes      | `test-key-123456789`       |

## 🔧 Troubleshooting

### Test Credentials Don't Work

The test credentials (`https://test.supabase.co`) are placeholders and will cause the server to crash. You must use real Supabase credentials.

### Secrets Not Available in CI

- Ensure secrets are added to the correct repository
- Check that the secret names match exactly
- Verify the secrets are not empty

### Server Crashes Immediately

This usually indicates:

1. Invalid Supabase credentials
2. Missing environment variables
3. Dependency issues
4. Port conflicts

Use the debug scripts to get detailed error information.
