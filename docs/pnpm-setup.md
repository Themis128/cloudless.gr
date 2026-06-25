# pnpm Setup and Optimization

This document describes the pnpm configuration and optimizations for the cloudless.gr project.

## Environment Setup

### Prerequisites

- Node.js >= 20 (managed via nvm)
- pnpm >= 10 (managed via corepack)

### First-Time Setup

```bash
# Load nvm (add to ~/.bashrc or ~/.zshrc for persistence)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Enable corepack and activate pnpm
corepack enable
corepack prepare pnpm@latest --activate

# Install dependencies
pnpm install
```

## Configuration Files

### `.npmrc`

Key settings optimized for Next.js 16 + AWS Amplify:

- `node-linker=isolated` — Better dependency isolation (pnpm v10+ default)
- `auto-install-peers=true` — Automatically install peer dependencies
- `prefer-frozen-lockfile=true` — Use existing lockfile when possible for faster installs
- `prefer-workspace-packages=true` — Prefer workspace packages over external dependencies
- `public-hoist-pattern` — Ensures AWS Amplify and i18n packages are accessible in edge runtimes

### `pnpm-workspace.yaml`

Defines workspace packages and native build allowances:

- Workspace packages: `workers/*`
- Allowed native builds: `@parcel/watcher`, `@sentry/cli`, `@swc/core`, `esbuild`
- Disabled native builds: `sharp`, `unrs-resolver` (not needed for this project)

### `package.json`

- `packageManager` field pins pnpm version for corepack
- `engines` enforces Node.js >= 20 and pnpm >= 10
- `pnpm.overrides` enforces security patches and version constraints
- `pnpm.onlyBuiltDependencies` limits native builds to required packages

## Common Commands

### Installation

```bash
pnpm install              # Install all dependencies
pnpm install --frozen-lockfile  # CI/CD: fail if lockfile is outdated
```

### Maintenance

```bash
pnpm dedupe              # Deduplicate dependencies
pnpm audit               # Check for vulnerabilities
pnpm audit --fix         # Fix vulnerabilities automatically
pnpm store prune         # Clean pnpm store cache
pnpm outdated            # Show outdated packages
pnpm update --interactive # Update packages interactively
```

### Using Added Scripts

```bash
pnpm pnpm                # Alias for pnpm install
pnpm pnpm:update         # Interactive update
pnpm pnpm:audit          # Security audit
pnpm pnpm:audit:fix      # Fix security issues
pnpm pnpm:dedupe         # Deduplicate dependencies
pnpm pnpm:why <pkg>      # Why is a package installed?
pnpm pnpm:list           # List installed packages
pnpm pnpm:outdated       # Show outdated packages
pnpm pnpm:clean          # Clean cache
pnpm pnpm:rebuild        # Rebuild and typecheck
```

## Performance Tips

1. **Use `--frozen-lockfile` in CI** — Ensures reproducible installs and faster CI builds
2. **Run `pnpm dedupe` periodically** — Reduces duplication and speeds up installs
3. **Keep `prefer-frozen-lockfile=true`** — Skips resolution when lockfile is valid
4. **Limit native builds** — Only allow builds for packages that truly need them

## Troubleshooting

### "node: not found"

Ensure nvm is loaded in your shell:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

### Peer dependency conflicts

The project uses `auto-install-peers=true` to minimize conflicts. If issues persist:

```bash
pnpm install --no-frozen-lockfile
```

### Native build failures

If a native build fails, check `pnpm-workspace.yaml` `allowBuilds` and ensure the package is listed in `onlyBuiltDependencies` in `package.json`.

## References

- [pnpm Documentation](https://pnpm.io)
- [pnpm Workspace](https://pnpm.io/workspaces)
- [Next.js package managers](https://nextjs.org/docs/app/getting-started/installation#automatic-installation)
