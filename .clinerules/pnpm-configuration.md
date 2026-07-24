# pnpm Configuration Documentation

## Current Configuration Status: ✅ COMPLETE

The cloudless.gr project has pnpm fully configured and operational.

### Files Configured

1. **package.json** - Contains:
   - `"packageManager": "pnpm@11.9.0"` (or latest from corepack)
   - `"engines": { "node": ">=20", "pnpm": ">=10" }`
   - Numerous scripts using pnpm commands

2. **pnpm-workspace.yaml** - Monorepo configuration:
   - Defines workspace packages: `workers/*`
   - Configured allowBuilds for native packages
   - Excludes packages from minimumReleaseAge policy

3. **.npmrc** - pnpm-specific settings:
   - `node-linker=isolated` (default, for better isolation)
   - `auto-install-peers=true`
   - `shamefully-hoist=false`
   - `prefer-frozen-lockfile=false`
   - `prefer-workspace-packages=true`
   - Various public-hoist-pattern settings for Next.js and Cloudflare compatibility
   - Dependency overrides for security patches

4. **pnpm-lock.yaml** - Lockfile (476KB, 1382 entries)

## Configuration Details

### Corepack Setup
```bash
corepack enable
corepack prepare pnpm@latest --activate  # Current: 11.9.0
```

### Workspace Configuration
The project uses a monorepo structure with:
```yaml
packages:
  - "workers/*"
```

### Dependency Resolution
- Peer dependencies are auto-installed
- Workspace packages are preferred
- Native builds allowed for specific packages (esbuild, swc, sharp, etc.)

### Compatibility Patterns
The .npmrc includes patterns for:
- Next.js 16 compatibility
- OpenNext.js/Cloudflare support
- AWS Amplify compatibility
- Internationalization (next-intl)

## Usage

All project commands are already configured to use pnpm:

```bash
pnpm install          # Install dependencies
pnpm run dev        # Development server
pnpm run build      # Build
pnpm run deploy     # Deploy
```

## System Commands Verified

- Node.js: v24.18.0 ✅
- pnpm: 11.9.0 ✅
- Corepack: 0.35.0 ✅

## Notes

- The project follows pnpm best practices
- No additional configuration needed
- All scripts in package.json use pnpm commands
- The workspace is ready for development and deployment