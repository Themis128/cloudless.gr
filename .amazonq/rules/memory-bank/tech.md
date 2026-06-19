# Tech: cloudless.gr

## Languages & Runtimes

| Language | Version | Usage |
|---|---|---|
| TypeScript | ^6.0.3 (strict) | All app code, scripts, tests |
| Python | 3.12 | Pi infrastructure scripts, ESP32 alert API |
| JavaScript (ESM) | — | Some scripts (.mjs), stub files |
| Shell (bash) | — | CI scripts, deployment automation |

## Core Framework Stack

| Technology | Version | Role |
|---|---|---|
| Next.js | 16.2.9 | App Router, API routes, SSR/ISR |
| React | 19.2.7 | UI framework |
| Tailwind CSS | ^4.3.1 | Utility-first styling |
| next-intl | ^4.13.0 | i18n routing (locale prefix `always`) |
| next-auth | 5.0.0-beta.31 | Authentication (Cognito OIDC) |
| TypeScript | ^6.0.3 | Strict mode, `@/` path alias → `./src/` |

## Package Management

- **pnpm** 10.33.2 (enforced via `packageManager` field and `engines`)
- Node.js >= 20 required
- pnpm workspace: `pnpm-workspace.yaml` (monorepo root + `tools/` packages)

## AWS Services & SDKs

| SDK | Version | Service |
|---|---|---|
| `@aws-sdk/client-ssm` | ^3.1068.0 | SSM Parameter Store (secrets + mutable state) |
| `@aws-sdk/client-sesv2` | ^3.1068.0 | SES v2 (transactional email) |
| `@aws-sdk/client-ses` | ^3.1068.0 | SES v1 (legacy) |
| `@aws-sdk/client-bedrock-runtime` | ^3.1068.0 | AWS Bedrock (Claude AI) |
| `@aws-sdk/client-cognito-identity-provider` | ^3.1068.0 | Cognito user management |
| `@aws-sdk/client-dynamodb` | ^3.1068.0 | Stripe transactions (DynamoDB cache) |

All AWS SDKs are in `serverExternalPackages` in next.config.ts — bundled by Node's native resolver.

## Key Dependencies

| Package | Version | Purpose |
|---|---|---|
| `stripe` | ^22.2.1 | Stripe webhooks + subscription management (checkout redirects to contact page) |
| `jose` | ^6.2.3 | JWT validation (JWKS, Bearer tokens) |
| `@sentry/nextjs` | ^10.58.0 | Error tracking (client/server/edge) |
| `lenis` | ^1.3.23 | Smooth scroll |
| `lucide-react` | ^1.18.0 | Icons |
| `cmdk` | ^1.1.1 | Command palette |
| `pdf-lib` | ^1.17.1 | Analytics report PDF generation |
| `countup.js` | ^2.10.0 | Animated stat counters |

## Testing Stack

| Tool | Version | Purpose |
|---|---|---|
| Vitest | ^4.1.9 | Unit tests (jsdom environment, forks pool) |
| @vitest/coverage-v8 | ^4.1.9 | V8 native coverage |
| React Testing Library | ^16.3.2 | Component tests |
| Playwright | ^1.61.0 | E2E tests (3 projects: public, user, admin) |
| @axe-core/playwright | ^4.11.3 | Accessibility audits in E2E |
| monocart-reporter | ^2.11.2 | Coverage merging (V8 + CDP) |

Coverage thresholds (CI enforced): lines 47%, functions 37%, branches 37%, statements 46%.

## Build & Deployment

| Tool | Purpose |
|---|---|
| Turbopack | Default dev bundler (`next dev`) |
| Webpack | Only in coverage mode (`next dev --webpack`) |
| SST v4 | AWS Amplify deploy (`sst deploy --stage production`) |
| GitHub Actions | CI/CD (ci.yml, deploy.yml, 80+ workflows) |
| Docker | Pi standalone build (`NEXT_OUTPUT_STANDALONE=1`) |
| k3s | Kubernetes on Raspberry Pi (HA standby) |

## Dev Port

App runs on **port 4000** (not the default 3000): `next dev -p 4000` / `next start -p 4000`.

## Development Commands

```bash
# Development
pnpm dev                    # Start dev server on :4000 (Turbopack)
pnpm build                  # Production build
pnpm start                  # Production server on :4000

# Testing
pnpm test                   # Vitest watch mode
pnpm test:ci                # Vitest single run (CI)
pnpm test:e2e               # E2E tests (bootstraps env from SSM)
pnpm test:k3s               # k3s cluster E2E tests

# Linting & Formatting
pnpm lint                   # ESLint (src/)
pnpm lint:fix               # ESLint auto-fix
pnpm lint:py                # Ruff (Python)
pnpm format                 # Prettier (src/**/*.{ts,tsx,css,json})
pnpm typecheck              # tsc --noEmit
pnpm typecheck:py           # mypy (scripts, infrastructure, lambda)

# Deployment
pnpm deploy                 # SST deploy to production (AWS Amplify)
pnpm deploy:staging         # SST deploy to staging

# Utilities
pnpm gsc:sync               # Weekly GSC → Notion sync
pnpm newsletter:send        # Publish + send newsletter
pnpm cms:populate           # Populate Notion CMS
pnpm cognito:setup          # Configure Cognito Hosted UI
```

## Infrastructure Languages

- **Terraform** (`infrastructure/terraform/`): Lambda resource optimization
- **Python FastAPI** (`infrastructure/pi-alert-api/`): ESP32 alert receiver on Pi
  - Typed with mypy, linted with ruff, pylint config in `.codacy/`
- **Arduino/ESPHome C++** (`infrastructure/esp32-watchdog/`): ESP32 firmware
- **Cloudflare Workers TypeScript** (`workers/esp32-proxy/`): Edge proxy

## TypeScript Configuration Highlights

- `strict: true` — full strict mode
- `moduleResolution: "bundler"` — Turbopack-compatible resolution
- `paths: { "@/*": ["./src/*"] }` — absolute imports via `@/`
- `strictBuiltinIteratorReturn: false` — disabled for iterator compatibility
- Test and script files excluded from main tsconfig (have their own)

## Code Quality Tools

- ESLint flat config (`eslint.config.mjs`) with `eslint-config-next`
- Prettier with `prettier-plugin-tailwindcss` (auto-sorts Tailwind classes)
- Ruff for Python (lint + format)
- mypy for Python type checking
- markdownlint-cli2 for docs
- Codacy, SonarCloud, CodeQL in CI
- gitleaks for secret scanning (`.gitleaks.toml`)
- `.gitattributes`: LF enforcement for all text files

## Secrets / Config Pattern

- **No `.env` files in production** — all secrets from AWS SSM Parameter Store
- Path prefix: `/cloudless/production/`
- Local dev: `.env.local` (git-ignored)
- `src/lib/ssm-config.ts`: singleton SSMClient, 5-min cache, stale-on-error fallback
- `NODE_ENV=test` bypasses SSM entirely (reads `process.env`)
