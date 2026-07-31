# Project Overview

## cloudless.gr — Cloud Consulting Platform

A Next.js 16 + Cloudflare Workers full-stack application for cloud consulting services.

### Tech Stack
- **Framework:** Next.js 16.2.1 (App Router, React 19.2.4, Turbopack)
- **Styling:** Tailwind CSS 4 with `@theme inline` custom tokens
- **3D:** @react-three/fiber + @react-three/drei + three.js
- **Animation:** GSAP (ScrollTrigger) + Lenis smooth scroll
- **Auth:** Cloudflare D1 (`user-auth-db`) + opaque session cookies
- **Payments:** Stripe (webhooks, checkout)
- **Email:** AWS SES (legacy) / Cloudflare Email (target)
- **Secrets:** D1 `app_config` table + Wrangler secrets; no `.env` files in prod
- **Testing:** Vitest + @testing-library/react + jsdom + Playwright E2E
- **Deployment:** Pi k3s (primary) + Cloudflare Workers proxy (`pi-origin`)
- **Package Manager:** pnpm (monorepo with `workers/*` workspace)

### Key Directories
- `src/app/` — Next.js App Router pages and API routes
- `src/components/` — React components (Navbar, Footer, 3D, store, etc.)
- `src/lib/` — Server utilities (auth, email, Stripe, Notion, Slack, GCal, etc.)
- `src/context/` — React context providers (Auth, Cart, CookieConsent)
- `src/locales/` — i18n dictionaries (en, el, fr)
- `workers/` — Cloudflare Workers (chat, analytics, etc.)
- `e2e/` — Playwright E2E tests
- `__tests__/` — Vitest unit tests
- `infrastructure/` — k3s deployment manifests
- `scripts/` — ETL and utility scripts
- `migrations/` — D1 schema migrations
- `public/` — Static assets, SW, PWA icons