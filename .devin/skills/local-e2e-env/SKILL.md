---
name: local-e2e-env
description: Bootstrap a working local Playwright environment on this WSL/Ubuntu box without sudo — user-local Node 22, pnpm via npx (corepack cache is broken), user-extracted chromium system libs, and the root-owned node_modules workaround. Use when `playwright test` fails with config-load errors, missing shared libraries, EACCES on install, or when setting up e2e runs locally.
---

# local-e2e-env

The repo's e2e suite (`e2e/deep/**`) needs three things the stock WSL box lacks.
All are handled idempotently by `scripts/setup.sh`.

## Failure modes this fixes

| Symptom | Cause | Fix |
|---|---|---|
| `SyntaxError: Named export 'E2E_HOST' not found` loading `playwright.config.mts` | System Node is v20; CI uses Node 22 | user-local Node 22 tarball at `~/.local/node/v22.20.0` |
| `Cannot find module '../dist/pnpm.cjs'` via corepack | corrupt corepack cache + no sudo for `/usr/bin/pnpm` symlink | `npx -y pnpm@9.15.0` |
| `ERR_PNPM_EACCES ... node_modules/@cloudflare/...` | `workers/mail-outbound/node_modules` is root-owned | rename to `node_modules.root-owned` (parent is user-writable); pnpm recreates it. Delete the stale dir later with `sudo rm -rf` |
| `chrome-headless-shell: error while loading shared libraries: libnspr4.so` | Playwright `install-deps` needs sudo | `apt-get download` + `dpkg -x` into `~/.local/pwlibs/root`, export `LD_LIBRARY_PATH` |

## Run tests

```bash
bash .devin/skills/local-e2e-env/scripts/setup.sh   # once (idempotent)

export PATH="$HOME/.local/node/v22.20.0/bin:$PATH"
export LD_LIBRARY_PATH="$HOME/.local/pwlibs/root/usr/lib/x86_64-linux-gnu"
npx -y pnpm@9.15.0 exec playwright test e2e/deep/<spec> --project=chromium
```

## Caveats

- **Dev-server OOM**: the full deep suite with default workers overwhelms this
  box — `next dev` gets OOM-restarted mid-run producing `ERR_CONNECTION_REFUSED`
  flakes. Run subsets (`--project=chromium` on one spec file) or let CI
  (`e2e-full-coverage.yml`) be authoritative.
- `workers/mail-outbound/node_modules.root-owned` is git-ignored locally via
  `.git/info/exclude`; it still occupies disk until removed with sudo.
- Node tarball + pwlibs live under `$HOME` — nothing touches system dirs.
