<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Cloudless.gr — Project Architecture & Agent Guide

## Tech Stack

- **Framework:** Next.js 16.3.0 (App Router, React 19.2.8, Turbopack)
- **Styling:** Tailwind CSS 4 with `@theme inline` custom tokens
- **3D:** @react-three/fiber + @react-three/drei + three.js
- **Animation:** GSAP (ScrollTrigger) + Lenis smooth scroll
- **Command palette:** cmdk
- **Auth:** Cloudflare D1 (`user-auth-db`) + opaque session cookies
- **Payments:** Stripe (webhooks, checkout)
- **Email:** Cloudflare Email Service (via `email-sender.ts`)
- **Secrets:** Wrangler secrets (Production) / `.env.local` (Development)
- **Testing:** Vitest + @testing-library/react + Playwright
- **Deployment target:** Cloudflare Workers (via OpenNext)

## Design System (Cyberpunk × Quantum Devflow)

- **Void colors:** `#0a0a0f` (void), `#12121a` (void-light), `#1a1a2e` (void-lighter)
- **Neon colors:** cyan `#00fff5`, magenta `#ff00ff`, green `#00ff41`, blue `#4d7cff`
- **Fonts:** Instrument Sans (heading), Work Sans (body), Geist Mono (code)
- **Font loading:** Imported via `next/font/google` with `preload: false`.
- **Effects:** scanlines, cyber-grid, neon-border, glow-cyan, dot-matrix

### Card & Section Patterns

- **Cards:** `rounded-xl border border-slate-800 bg-void-light/50 hover:border-neon-cyan/50`
- **Buttons:** `rounded-lg` (WCAG 44px+ touch targets)
- **Backdrop:** `bg-void/90 backdrop-blur-xl` on navbar
- **Top accent bar:** 1px neon-cyan glow line on navbar
- **IMPORTANT:** Never use dynamic Tailwind class names (e.g., `bg-${var}/10`). Tailwind 4 JIT cannot detect them. Use a static class mapping object instead.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx               # Root layout: AuthProvider → CartProvider → LenisProvider
│   ├── [locale]/                # i18n routing (en · el · fr · de)
│   │   ├── page.tsx             # Homepage
│   │   ├── services/            # Service offerings
│   │   ├── store/               # E-commerce
│   │   ├── auth/                # Login · Signup (D1)
│   │   ├── dashboard/           # Customer portal
│   │   └── admin/               # Admin panel (magenta accent)
│   └── api/
│       ├── auth/                # D1 Auth endpoints
│       ├── checkout/            # Stripe Checkout
│       ├── slack/               # Two-way Slack integration
│       └── webhooks/            # Stripe & Notion webhooks
├── components/                  # UI Components (HolographicCard, TerminalBlock, etc.)
├── context/                     # AuthContext, CartContext
├── lib/                         # Server + shared utilities
│   ├── auth-d1.ts               # D1 session/password helpers
│   ├── ssm-config-d1.ts         # Cloudflare secrets loader
│   ├── slack-notify.ts          # Block Kit notifications
│   ├── gsc.ts                   # Google Search Console (11x SEO functions)
│   └── i18n.ts                  # Locale system
└── locales/                     # en.json, el.json, fr.json, de.json
```

## Agentic Workflows (Python)

The project includes a suite of Python-based agents for research and documentation, located in `agents/`.

- **Research Agent:** `agents/run_cloudless_agent.py` — Uses Tavily search + Deep Agents for technical analysis.
- **Docs Research:** `agents/run_langchain_docs_research.py` — Specialized for LangChain/LangGraph documentation.
- **Memory:** Persistent filesystem memory at `.agent-memory/memories/AGENTS.md`.
- **Setup:** Run `./setup-agents.sh` to initialize the Python environment.

## MCP Configuration

Workspace MCP servers configured in `mcp.json`:

- `project`: `project-mcp` for codebase context.
- `mcp-tool-shop`: Additional utility tools.
- `notion`: `@notionhq/notion-mcp-server` for direct Notion CMS access.

## Authentication (Cloudflare D1)

- **Store:** Cloudflare D1 `user-auth-db` — users, sessions, roles, PBKDF2 hashes.
- **Session:** Opaque `session_token` cookie. Default 30 days.
- **Admin:** Membership in D1 `roles` table. Promote via `POST /api/admin/users` `{ action: "promote", username }`.
- **Route protection:** Server-side via `src/proxy.ts` and layout guards.

## Internationalization (i18n)

- **Supported locales:** `en` (default), `el`, `fr`, `de`.
- **Detection:** Cookie-based (`NEXT_LOCALE`).
- **Rule:** Always import locale/currency constants from `locale-defaults.ts`.
- **Rule:** For new UI strings, update ALL locale JSON files in `src/locales/`.

## Security & Secrets

- **No .env in Production:** Use Wrangler secrets for `STRIPE_SECRET_KEY`, `SLACK_BOT_TOKEN`, etc.
- **Rate Limiting:** Centralized in `proxy.ts` (IP-based).
- **Validation:** All inbound Slack/Stripe requests verified via HMAC-SHA256.

## Testing

- **Unit:** `pnpm test` (Vitest + jsdom)
- **E2E:** `npx playwright test`
- **Coverage:** `pnpm test:coverage:full`
