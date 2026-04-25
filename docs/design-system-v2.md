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

## Phased rollout

| Phase | Scope | PR target |
|---|---|---|
| **1. Foundation** *(this commit)* | Spec doc + new token file (`src/app/theme-v2.css`). Not imported globally yet. | 1 PR |
| **2. Primitives** | Migrate `Button`, `Input`, `Card`, `Badge`, `Link`, `Section` to v2 tokens. Also add `[data-theme]` provider that toggles light/dark. | 1 PR |
| **3. Layout** | Header, footer, hero shell, common section wrappers. Hero gradient mesh replaces dot-matrix. | 1 PR |
| **4. Marketing pages** | Homepage, services, blog, contact, store, docs. Per-page polish. | 1 PR per page (~6 PRs) — or 1 large PR if smaller scope per page |
| **5. Admin + cleanup** | Admin dashboard restyle (kept dark by default). Remove deprecated v1 tokens, glow/scanline/glitch utilities, neon-magenta references. | 1 PR |

Each PR is independently mergeable. No long-lived feature branch.

## Open questions

- Greek + French locales: typography needs to handle Greek diacritics + French accents cleanly. Instrument Sans + Work Sans both support those — to verify in Phase 2.
- Three.js scene currently uses neon colors. Recolor in Phase 3 or replace entirely?
- Keep the 4 neon "matrix"-style background effects on `/services`, or replace with a static gradient mesh?

## References

- Linear (linear.app) — restraint, motion, micro-typography
- Resend (resend.com) — soft palette, generous whitespace, light + dark
- Stripe Atlas (stripe.com/atlas) — credibility through type + minimal color
- Vercel (vercel.com) — sharp dark, but we go softer
