# Cloudless Design System v2 — "Calm Cloud"

**Status**: Phase 1 (Foundation) — additive, not yet wired to production.
**Replaces**: the cyberpunk/neon-terminal language in [src/app/globals.css](../src/app/globals.css).

## Why we are rebranding

The current visual language (deep void background, hard neon glow, scanlines, glitch animation, terminal cursor) reads as "edgy hacker shop". The product is a B2B cloud consultancy selling cloud architecture, serverless, analytics, and AI marketing to startups and SMBs — a buyer audience that needs to read **trustworthy enterprise** in the first three seconds, not "dark-mode developer tool". The brand name and tagline ("Clear skies. Zero friction.") already invite a sky / cloud metaphor; v2 leans into that directly.

## Design principles

1. **Calm over loud.** No glow, no scanlines, no glitch. Motion is subtle (opacity + 8px translate). One accent, used sparingly.
2. **Light first, dark optional.** Marketing pages default to light. `/admin` defaults to dark. `prefers-color-scheme` overrides the default.
3. **Generous whitespace, sharp typography.** Hero sections breathe. Section paddings are 96px+ desktop, 64px mobile. Body line-height 1.65.
4. **Tokens over hardcoded values.** Every color, radius, shadow, and motion duration lives in a CSS variable.
5. **Cloud metaphor, not literal clouds.** Soft gradient meshes (cyan → sky-blue → lavender), glass surfaces on the hero. No emoji clouds, no fluffy illustrations.

## What is preserved from v1

- **Cyan accent** — `#00fff5` becomes `#0e9aab` in light, `#22d3e6` in dark. Same hue family, way less saturated, used only on CTAs / focus rings / link underline.
- **Terminal blocks** — `/services` and `/docs` keep the styled code blocks with traffic-light dots. Developer credibility marker. Recolored to fit the new palette.
- **Three.js hero motion** — kept, but recolored from neon to soft sky tones, animation slowed ~30%.

## What is dropped

- `glow-*` text shadow utilities
- `box-glow-*` box shadow utilities
- `.scanlines`, `.cyber-grid*`, `.dot-matrix`, `.neon-border`
- `.typing-cursor`, `.glitch`, `.scan-line`
- `--color-neon-magenta`, `--color-neon-green`, `--color-neon-blue` (semantic-success / semantic-info take over)
- Forced `!important` overrides on form inputs

## Token map (v1 → v2)

| v1 token | v2 light | v2 dark | Notes |
|---|---|---|---|
| `--color-void` | — | `#0b0f15` | Slightly bluer than pure black |
| `--color-void-light` | `#fcfcfd` | `#121823` | Page background |
| `--color-void-lighter` | `#f4f6f9` | `#1a2230` | Elevated surface |
| `--color-foreground` | `#0f1822` | `#e6edf3` | Body text |
| `--color-muted` | `#7a8aa0` | `#697587` | Captions, hints |
| `--color-accent` | `#0e9aab` | `#22d3e6` | Calmer teal |
| `--color-neon-cyan` | (deprecated) | (deprecated) | Replaced by `--color-accent` |
| `--color-neon-magenta` | (removed) | (removed) | No use case in v2 |
| `--color-neon-green` | `--color-success` `#0a8a52` | `--color-success` `#1fa56e` | Now semantic |

## New v2 tokens

### Surfaces
- `--surface-canvas` — page background (`#fcfcfd` / `#0b0f15`)
- `--surface-subtle` — section alt background (`#f4f6f9` / `#121823`)
- `--surface-raised` — card / panel (`#ffffff` / `#1a2230`)
- `--surface-glass` — sticky nav / hero cards (`rgb(255 255 255 / 0.7)` blur 20 / `rgb(11 15 21 / 0.7)` blur 20)

### Borders
- `--border-subtle` — dividers, hairlines (`#dde3ec` / `#27313f`)
- `--border-strong` — input borders, card edges in hover (`#b6c2d1` / `#3d4a5c`)

### Text
- `--ink-primary` — H1/H2/key text (`#0f1822` / `#e6edf3`)
- `--ink-body` — paragraph (`#475467` / `#9aa7b8`)
- `--ink-muted` — captions (`#7a8aa0` / `#697587`)

### Accent
- `--accent` — single brand accent (`#0e9aab` / `#22d3e6`)
- `--accent-hover` — interactive hover state (`#0c8696` / `#5be4f0`)
- `--accent-soft` — ghost CTA fill, badges (`#e0f2f5` / `#0e3a40`)

### Semantic
- `--success` (`#0a8a52` / `#1fa56e`)
- `--warning` (`#b56e00` / `#e09530`)
- `--danger` (`#c0392b` / `#e85f4d`)
- `--info` — same as accent

### Radii
- `--radius-sm` 6px (badges, small inputs)
- `--radius-md` 10px (buttons, inputs)
- `--radius-lg` 14px (cards)
- `--radius-xl` 20px (hero panels, modals)
- `--radius-pill` 999px

### Shadows
- `--shadow-sm` — 1px hairline lift, used on inputs `0 1px 2px rgb(15 24 34 / 0.04)`
- `--shadow-md` — card resting state `0 4px 12px rgb(15 24 34 / 0.06)`
- `--shadow-lg` — card hover / hero panel `0 12px 32px rgb(15 24 34 / 0.08)`
- Dark mode shadows are nearly invisible by design — depth comes from `--surface-raised` contrast, not shadow.

### Motion
- `--motion-fast` 120ms (hover, focus)
- `--motion-base` 200ms (default ease-out)
- `--motion-slow` 360ms (reveal-on-scroll)
- All transitions cubic-bezier `cubic-bezier(0.4, 0, 0.2, 1)` unless explicitly varied.

### Type scale
- `--type-display` 56px / 64px line-height (hero h1 only)
- `--type-h1` 44px / 52px
- `--type-h2` 32px / 40px
- `--type-h3` 24px / 32px
- `--type-h4` 20px / 28px
- `--type-body` 16px / 26px
- `--type-small` 14px / 22px
- `--type-caption` 13px / 18px

## Phased rollout — status

| Phase | Scope | PR | Status |
|---|---|---|---|
| **1. Foundation** | Spec doc + `src/app/theme-v2.css` token file. | merged into `main` as `8c70aa57` | ✅ done |
| **2. Token bridge + ThemeProvider** | Rewrote `@theme inline` to alias legacy v1 tokens onto v2 values, added route-aware `themeForRoute()` helper, set `data-theme` on `<html>` server-side via middleware → `headers()` → root layout. | [#53](https://github.com/Themis128/cloudless.gr/pull/53) | ✅ open |
| **3. /services light** | First marketing route flipped to light. Light-mode overrides for `text-white`, `text-slate-*`, `bg-slate-*`, `border-slate-*`. TerminalBlock pinned dark. | [#54](https://github.com/Themis128/cloudless.gr/pull/54) | ✅ open |
| **3.x Marketing surface light** | `/blog`, `/contact`, `/store`, `/docs`, `/privacy`, `/terms`, `/cookies`, `/refund` flipped. Additional overrides for placeholder text, kbd, decorative gradient overlays. | [#55](https://github.com/Themis128/cloudless.gr/pull/55) | ✅ open |
| **4. Homepage hero** | `/` flipped to light with gradient-mesh hero replacing the scanlines + cyber-grid + neon orbs. Three.js particle field calmed to 30% opacity. Section padding bumped to v2 96px on tablet+. | [#56](https://github.com/Themis128/cloudless.gr/pull/56) | ✅ open |
| **5. Cleanup** *(this commit)* | Retired the deprecated v1 effect utilities (`glow-*`, `box-glow-*`, `scanlines`, `cyber-grid`, `dot-matrix`, `glitch`, `typing-cursor`, `animate-gradient-shift`, `animate-neon-pulse`, `scan-line`). The class hooks remain so existing markup parses, but they collapse to no-ops or to v2-styled subtle equivalents. `neon-border` is preserved as a calm v2-styled border for terminal blocks. | this PR | ✅ done |
| **6. User theme switcher** | Navbar-level toggle (popover desktop, inline mobile) shipped as the first user-facing surface for choosing System / Light / Dark. Persists to `localStorage["cloudless-theme-pref"]` for anonymous visitors and to `user.preferences.theme` for authenticated users. Switcher is hidden on `/admin/*` (admin stays locked to dark). | `0a354365` | ✅ done |
| **6.1 Shared theme-pref helper + dashboard live preview** | Extracted `readStoredPref` / `writeStoredPref` / `useStoredPref` into `src/lib/theme-pref.ts` so navbar, `ThemePreferenceSync`, and the dashboard form share one source of truth. `/dashboard/settings` theme buttons now apply immediately (live preview) via the same localStorage + custom-event channel — Save still flushes the rest of the form to the server. | this PR | ✅ done |

Each PR is independently mergeable, stacked in order: `#53 → #54 → #55 → #56 → cleanup → theme switcher`.

## Theme switcher

The route-driven default in `themeForRoute()` is what an unfamiliar visitor sees on first paint. The switcher lets that visitor override the default for the rest of their session and lets logged-in users pin their preferred mode across devices.

### Selection priority

```
admin path (locked dark)
  ↓
user.preferences.theme   (authenticated; lives in Cognito + AuthContext)
  ↓
localStorage["cloudless-theme-pref"]   (anonymous override)
  ↓
themeForRoute(pathname)   (route default)
```

`ThemePreferenceSync` (mounted globally via `ClientDecorators` in the root layout) walks this list every time the pathname or any of the higher-priority sources change, then writes the final value to `<html data-theme=...>`.

### Where it lives in the chrome

| Surface | Component | Variant | Notes |
|---|---|---|---|
| Desktop nav (>= `lg` breakpoint) | `<ThemeSwitcher />` | Popover trigger between `<CartButton />` and `<LocaleSwitcher />` | Sun / moon / system icon shows current selection. |
| Mobile menu (<` lg` breakpoint) | `<ThemeSwitcherInline />` | Three radio buttons in their own bordered row, above the Language section | Inline because the mobile menu is inside an `overflow-y-auto` container that would clip an absolute-positioned popover. |
| Dashboard settings | `/dashboard/settings` form | Buttons that call `writeStoredPref(value)` immediately (live preview) and update local form state | Save still flushes everything (theme + language + email prefs) to the server via `updatePreferences`. The button click no longer waits for Save to apply the theme — it flows through the same localStorage + custom-event channel as the navbar. |

Both navbar variants render `null` on `/admin/*` paths.

### Persistence + cross-tab sync

When a click happens, the switcher:

1. Writes the new value to `localStorage["cloudless-theme-pref"]`.
2. Dispatches a same-tab `cloudless:theme-pref` `CustomEvent`.
3. If a user is logged in, calls `AuthContext.updatePreferences({ theme })` (best-effort; failures fall back to the localStorage write that already applied).

`ThemePreferenceSync` and the inline switcher both subscribe to that custom event AND the standard cross-tab `storage` event via `useSyncExternalStore`, so changing the theme on one tab updates other open tabs without a reload.

### Files

| File | Purpose |
|---|---|
| `src/lib/theme-pref.ts` | Shared persistence: `THEME_STORAGE_KEY`, `THEME_PREF_EVENT`, `readStoredPref`, `writeStoredPref`, `useStoredPref`. Single source of truth for navbar + dashboard + sync. |
| `src/components/ThemeSwitcher.tsx` | Default export = popover; named export `ThemeSwitcherInline` = mobile inline radio group. |
| `src/components/ThemePreferenceSync.tsx` | Resolves the priority chain and writes `data-theme` on `<html>`. |
| `src/components/ThemeProvider.tsx` | `themeForRoute()` mapping (route default). |
| `src/components/Navbar.tsx` | Mounts both switcher variants. |
| `src/app/[locale]/dashboard/settings/page.tsx` | Calls `writeStoredPref` on each theme button click for live preview; `updatePreferences` still runs on Save for the rest of the form. |
| `src/locales/{en,el,fr,de}.json` | `common.theme`, `common.themeSystem|Light|Dark`. |
| `__tests__/theme-switcher.test.tsx` | 8 tests — admin hide on both variants, popover persistence, custom event dispatch, authenticated `updatePreferences`, user-pref seeding, localStorage-wins-over-user-pref ordering. |
| `__tests__/theme-preference-sync.test.tsx` | 5 tests — original 3 (route default, user pref, admin lock) plus 2 new (anonymous localStorage override, auth-pref-wins-over-localStorage). |
| `__tests__/dashboard-settings-live-preview.test.tsx` | 3 tests — click writes localStorage, click dispatches the custom event, Save is still required for `updatePreferences`. |
| `e2e/theme-switcher.spec.ts` | 5 Playwright cases against `pnpm dev` — popover renders + 3 options, Light + Dark write `data-theme`, override survives reload, mobile inline radios persist clicks. |

## Open questions

- Greek + French locales: typography needs to handle Greek diacritics + French accents cleanly. Instrument Sans + Work Sans both support those — to verify in Phase 2.
- Three.js scene currently uses neon colors. Recolor in Phase 3 or replace entirely?
- Keep the 4 neon "matrix"-style background effects on `/services`, or replace with a static gradient mesh?

## References

- Linear (linear.app) — restraint, motion, micro-typography
- Resend (resend.com) — soft palette, generous whitespace, light + dark
- Stripe Atlas (stripe.com/atlas) — credibility through type + minimal color
- Vercel (vercel.com) — sharp dark, but we go softer
