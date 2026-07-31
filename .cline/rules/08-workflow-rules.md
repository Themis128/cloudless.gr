# Workflow Rules

## Git Workflow

- **Branch strategy:** Feature branches from `main`, PRs to `main`
- **Commit messages:** Conventional commits format: `type(scope): description`
  - Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `ci`
  - Examples: `feat(api): add calendar booking endpoint`, `fix(auth): resolve session timeout`
- **PR naming:** Match commit convention, e.g., `feat(store): add product search`
- **Rebase workflow:** Rebase feature branches onto `main` before merging
- **Merge conflicts:** Use `pr-conflict-resolve` skill for conflict resolution

## PR Triage

- When PR webhook events arrive (failed CI, bot comments, review threads):
  1. **Silently skip** if it's a duplicate root-cause event
  2. **Fix immediately** if it's a clear CI failure or simple issue
  3. **Escalate to user** if it requires human judgment or access

## Code Review

- **Self-review:** Run `pnpm test:ci` and `pnpm cf:build` before pushing
- **CI checks:** All checks must pass before merge
- **SonarCloud:** Address all Issues (code fixes) and acknowledge Hotspots (UI only)
- **Common SonarCloud fixes:**
  - S3699: `void` unused promise results
  - S3776: Reduce cognitive complexity by extracting functions
  - S1192: Extract duplicate strings to constants
  - S4787: Use Web Crypto API instead of Node crypto

## Environment Setup

- **Node.js:** v24.18.0 (via nvm or corepack)
- **pnpm:** 11.9.0 (via corepack: `corepack enable && corepack prepare pnpm@latest --activate`)
- **Python:** 3.x (for scripts in `scripts/` directory)
- **Docker:** Available for containerized services

## Development Workflow

1. **Pull latest:** `git pull origin main`
2. **Install deps:** `pnpm install`
3. **Start dev:** `pnpm dev`
4. **Make changes:** Edit files, run tests
5. **Type check:** `pnpm typecheck` (or `npx tsc --noEmit`)
6. **Run tests:** `pnpm test:ci`
7. **Build check:** `pnpm cf:build` (for Cloudflare deployment)
8. **Commit:** `git commit -m "type(scope): description"`
9. **Push:** `git push origin feature-branch`

## Integration Activation

When activating external integrations (ActiveCampaign, TikTok Ads, X Ads, Postiz, Slack delivery, Cloudflare token):
1. Add credentials to Wrangler secrets (for Workers) or environment variables (for k3s)
2. Verify via `/admin/integrations` page
3. Update `docs/USE-CASES.md` if applicable