# Architecture Rules

## Design System (Cyberpunk × Quantum Devflow)

### Colors
- **Void:** `#0a0a0f` (void), `#12121a` (void-light), `#1a1a2e` (void-lighter)
- **Neon:** cyan `#00fff5`, magenta `#ff00ff`, green `#00ff41`, blue `#4d7cff`
- **Fonts:** Instrument Sans (heading), Work Sans (body), Geist Mono (code)
- **Font loading:** `next/font/google` with `preload: false`

### Card & Section Patterns
- **Cards:** `rounded-xl border border-slate-800 bg-void-light/50 hover:border-neon-cyan/50`
- **Icon boxes:** `w-10 h-10 bg-neon-cyan/10 border border-neon-cyan/20 rounded-lg`
- **Section rhythm:** `py-20 lg:py-28` for major sections
- **Pill badges:** `inline-flex items-center gap-2 px-3 py-1.5 bg-neon-cyan/10 border border-neon-cyan/20 rounded-full`
- **Tags:** `rounded-full`
- **Buttons:** `rounded-lg`
- **Backdrop:** `bg-void/90 backdrop-blur-xl` on navbar
- **Top accent bar:** 1px neon-cyan glow line on navbar
- **CTA gradients:** `bg-gradient-to-r from-neon-cyan/10 via-neon-blue/10 to-neon-magenta/10`
- **FAQ details:** `bg-void border border-slate-800 rounded-xl open:border-neon-cyan/30`
- **Section borders:** `border-y border-slate-800`
- **IMPORTANT:** Never use dynamic Tailwind class names (e.g., `bg-${var}/10`). Use a static class mapping object instead.

## Authentication Architecture (Cloudflare D1)

- **Store:** Cloudflare D1 `user-auth-db` — users, sessions, roles, password hashes (PBKDF2)
- **Session:** Opaque `session_token` cookie (or Bearer) resolved by `src/lib/api-auth.ts`
- **Admin:** Membership in D1 `roles` → projected as `groups: ["admin"]`
- **Route protection:** `src/proxy.ts` (before render) + layout guards
- **Password rules:** ≥8 chars with upper, lower, digit, and special character. Lockout after 5 failed attempts in 15 minutes.
- **Color coding:** Cyan for user-facing auth, magenta for admin

## i18n Architecture

- **Supported locales:** `en` (default), `el`, `fr` — all fully translated (195 keys each)
- **Locale detection:** Cookie-based (`NEXT_LOCALE`), set by `LocaleSwitcher`
- **Core utilities:** `translate()`, `translateArray()`, `getMessages()`, `isSupportedLocale()`
- **Server components:** Use `getServerLocale()` from `src/lib/server-locale.ts`
- **Client components:** Use `useCurrentLocale()` hook from `src/lib/use-locale.ts`
- **Rule:** Always import locale/currency constants from `locale-defaults.ts`
- **Rule:** For new UI strings, add the key to all three locale files, then use `translate()` or `translateArray()`

## Optional Integrations Pattern

All integrations are optional and degrade gracefully. Config is centralized in `src/lib/integrations.ts` which provides `isConfigured(...keys)` to check availability. Every API route and lib that depends on an integration checks `isConfigured()` first and returns a 503 or null/empty result when not configured.

**Integration patterns:**
- **Fire-and-forget:** Use `Promise.allSettled([...]).catch(() => {})` so the main flow isn't blocked
- **Fallback:** Blog API returns static `lib/blog.ts` data when Notion isn't configured
- **Cache:** Calendar availability is cached 5 minutes; Google OAuth tokens cached until expiry