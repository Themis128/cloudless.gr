# 🔧 Troubleshooting Guide - Cloudless LLM Dev Agent

This guide helps you resolve common issues with the Cloudless LLM Dev Agent platform.

## 🚨 Common Issues & Solutions

### 1. Module Resolution Error: "#internal/nuxt/paths"

**Error Message:**
```
Package import specifier "#internal/nuxt/paths" is not defined in package /workspace/package.json
```

**Solution:**
This is a Nuxt.js internal module resolution issue. Use the simple startup script:

```bash
# For development (recommended)
npm run start:simple

# Alternative safe scripts
npm run dev:safe
npm run build:safe
```

**If still failing:**
```bash
# Complete reset approach
rm -rf .nuxt .output dist node_modules package-lock.json
npm install
npm run start:simple
```

**Alternative Solutions:**
1. **Clean and rebuild:**
   ```bash
   npm run fix
   npm run dev:safe
   ```

2. **Manual cleanup:**
   ```bash
   rm -rf .nuxt .output dist node_modules/.cache
   npm install
   npm run dev:safe
   ```

### 2. Redis Connection Issues

**Error Message:**
```
Reached the max retries per request limit
```

**Solution:**
Disable Redis for development:

```bash
# Set environment variable
export SKIP_REDIS=true

# Or use safe scripts (automatically disable Redis)
npm run dev:safe
npm run build:safe
```

**For Production:**
```bash
# Ensure Redis is running
docker run -d -p 6379:6379 redis:alpine

# Or use external Redis
export REDIS_URL=redis://your-redis-host:6379
```

### 3. Build Failures

**Error Message:**
```
Exiting due to prerender errors
```

**Solution:**
Disable prerendering:

```bash
# Set environment variable
export NUXT_PRERENDER=false

# Or use safe scripts
npm run build:safe
```

### 4. Environment Configuration Issues

**Error Message:**
```
Supabase configuration missing
```

**Solution:**
1. **Interactive setup:**
   ```bash
   npm run setup
   ```

2. **Manual setup:**
   ```bash
   cp env.example .env
   # Edit .env with your Supabase credentials
   ```

3. **Minimal setup (for testing):**
   ```bash
   npm run dev:safe  # Creates minimal .env automatically
   ```

### 5. Dependency Issues

**Error Message:**
```
Cannot find module
```

**Solution:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Or use fix script
npm run fix
```

## 🛠️ Safe Scripts

The platform includes safe scripts that handle common issues automatically:

### Development
```bash
npm run start:simple    # Simple startup (recommended)
npm run dev:safe        # Safe development server
```

**Features:**
- Automatically disables Redis
- Creates minimal .env if missing
- Handles module resolution issues
- Provides clear error messages
- Tries multiple startup methods

### Production Build
```bash
npm run build:safe  # Safe production build
```

**Features:**
- Cleans build artifacts
- Disables Redis and prerendering
- Validates environment
- Provides troubleshooting tips

### Fix Script
```bash
npm run fix         # Automated fix for common issues
```

**Features:**
- Cleans build artifacts
- Validates environment
- Fixes package.json imports
- Reinstalls dependencies
- Prepares Nuxt

## 🔍 Diagnostic Commands

### Check Environment
```bash
# Check if .env exists
ls -la .env

# Check environment variables
cat .env | grep -E "(SUPABASE|REDIS|NUXT)"
```

### Check Dependencies
```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# List installed packages
npm list --depth=0
```

### Check Build Artifacts
```bash
# Check if build directories exist
ls -la .nuxt .output dist

# Clean build artifacts
rm -rf .nuxt .output dist
```

### Check Redis Status
```bash
# Check if Redis is running
redis-cli ping

# Start Redis with Docker
docker run -d -p 6379:6379 redis:alpine
```

## 🚀 Quick Start Solutions

### For New Users
```bash
# 1. Install dependencies
npm install

# 2. Setup environment
npm run setup

# 3. Start development
npm run start:simple
```

### For Existing Users with Issues
```bash
# 1. Fix common issues
npm run fix

# 2. Start development
npm run start:simple
```

### For Production Deployment
```bash
# 1. Safe build
npm run build:safe

# 2. Start production server
npm start
```

## 📋 Environment Variables Reference

### Required Variables
```env
NUXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Optional Variables
```env
# Redis (optional)
SKIP_REDIS=true                    # Disable Redis
REDIS_HOST=localhost               # Redis host
REDIS_PORT=6379                    # Redis port
REDIS_PASSWORD=                    # Redis password

# Build (optional)
NUXT_PRERENDER=false               # Disable prerendering
NODE_ENV=development               # Environment
```

## 🆘 Getting Help

If you're still experiencing issues:

1. **Check the logs** for specific error messages
2. **Use safe scripts** (`npm run dev:safe`, `npm run build:safe`)
3. **Run the fix script** (`npm run fix`)
4. **Check this troubleshooting guide**
5. **Review the setup guide** (`SETUP.md`)

### Common Error Patterns

| Error Pattern | Solution |
|---------------|----------|
| `#internal/nuxt/paths` | Use `npm run start:simple` |
| `Redis connection` | Set `SKIP_REDIS=true` |
| `prerender errors` | Set `NUXT_PRERENDER=false` |
| `Supabase missing` | Run `npm run setup` |
| `Cannot find module` | Run `npm run fix` |

## 🔄 Recovery Steps

If the application is completely broken:

1. **Reset to clean state:**
   ```bash
   rm -rf .nuxt .output dist node_modules package-lock.json
   npm install
   ```

2. **Setup environment:**
   ```bash
   npm run setup
   ```

3. **Start with simple script:**
   ```bash
   npm run start:simple
   ```

4. **If still failing, check:**
   - Node.js version (should be 18+)
   - npm version (should be 8+)
   - Available disk space
   - Network connectivity 