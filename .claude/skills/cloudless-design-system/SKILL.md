---
name: cloudless-design-system
description: Design system and UI/UX improvement guide for cloudless.gr — the Next.js site for Cloudless cloud consulting. Use this skill whenever the user asks to fix UI issues, improve design, redesign a section, audit UX, fix spacing/layout, improve a page's look, or mentions anything about the visual design of cloudless.gr. Also triggers on "make it look better", "fix the hero", "too much whitespace", "improve the layout", "design system", "component styling", "responsive issues", or any request involving the appearance, spacing, colors, typography, or visual hierarchy of pages on cloudless.gr. Use this even when the user just says "fix it" in context of a design issue.
---

# Cloudless Design System & UI/UX Guide

## Purpose

This skill captures the complete design language, component patterns, and known issues for cloudless.gr so you can make consistent, high-quality UI/UX improvements without guessing.

## Tech Stack

- **Framework**: Next.js 14+ (App Router) with TypeScript
- **Styling**: Tailwind CSS with custom theme extensions
- **Deployment**: SST on AWS (Lambda@Edge + CloudFront)
- **Repo**: `Themis128/cloudless.gr` on GitHub
- **Local path (WSL)**: `/home/tbaltzakis/cloudless.gr`

## Brand Identity

Cloudless is a cloud consulting agency targeting startups and SMBs. The brand voice is technical but approachable — like a senior engineer explaining things clearly. The visual identity blends a dark "void" aesthetic with neon terminal-style accents.

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `bg-void` | `#0a0a0f` (near-black) | Primary background |
| `bg-void-light` | `#12121a` | Alternate section background |
| `neon-cyan` | `#00f0ff` | Primary accent, CTAs, highlights, links |
| `neon-magenta` | `#ff00ff` | Secondary accent, gradient highlights in headings |
| `neon-green` | `#00ff88` | Success states, checkmarks, numbered badges |
| `slate-800` | Tailwind default | Borders, dividers |
| Text primary | `text-white` | Headings |
| Text secondary | `text-slate-300` / `text-slate-400` | Body text, descriptions |
| Text muted | `text-slate-500` | Captions, fine print |

### Typography

- **Headings**: Bold, large. H1 uses gradient text (cyan-to-magenta or white-to-cyan)
- **Section labels**: Monospace/uppercase with brackets, e.g., `[ WHAT WE DO ]`, `[ ABOUT ]`
- **Body**: Regular weight, `text-slate-300` or `text-slate-400`
- **Code/terminal**: Monospace font in styled terminal windows with traffic-light dots

### Signature Elements

1. **Terminal windows** — Fake CLI outputs with colored dots (red/yellow/green), monospace text, green checkmarks. Used as visual proof on services page.
2. **Section labels** — Cyan monospace text in brackets: `[ SECTION_NAME ]`
3. **Numbered badges** — Small cyan/green circles with numbers (01, 02, 03) for service cards
4. **Gradient headings** — Key words highlighted in cyan or magenta within white headings
5. **Neon borders** — Cards use `border-neon-cyan/20` or similar subtle glows
6. **Scanlines** — Subtle CRT-style overlay on hero section (class `scanlines`)

## Page Structure & Layout Patterns

### Common Layout

```
Navbar (sticky, dark, logo left, nav right)
  ├── Section: Hero (full-width, bg-void + decorative elements)
  ├── Section: Content blocks (alternating bg-void / bg-void-light)
  ├── Section: CTA banner (gradient background)
  └── Footer (bg-void-light, 4-column grid)
```

### Spacing System

Current spacing uses Tailwind's `py-20 lg:py-28` for sections. This creates the right rhythm for content-heavy sections but causes excessive whitespace when sections have less content.

**Guideline for fixes**:
- Content-heavy sections: `py-16 lg:py-24` is usually sufficient
- Light sections (badges, stats): `py-10 lg:py-14`
- Hero: Uses explicit height via content, not padding
- Between-section gaps should feel rhythmic, never more than ~120px visual gap

### Grid Patterns

- **Hero**: `grid grid-cols-1 lg:grid-cols-2 items-center gap-12` (text left, visual right)
- **Service cards**: `grid grid-cols-1 md:grid-cols-2 gap-8`
- **Value props**: `grid grid-cols-1 md:grid-cols-3 gap-6`
- **Store products**: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8`
- **Footer**: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8`

## Known Issues (from 2026-04-19 audit)

Read `references/known-issues.md` for the full audit findings. Key issues to address:

1. **Homepage hero** — Terminal animation column (`hidden lg:block`) has `animate-fade-in-up delay-300`, so the right side appears blank on first paint. CTA buttons and subtitle are too far below the heading.
2. **Excessive section gaps** — Multiple pages have viewport-sized empty spaces between sections (homepage between services and founder, store page after products)
3. **Blog hero** — Nearly invisible, just faint `[ BLOG ]` text with no heading or description
4. **Services "Our Promise"** — Only shows 1 of 3 expected cards

## How to Make Changes

### Before writing code

1. Read the relevant component file to understand current structure
2. Check if the issue is in Tailwind classes, component logic, or missing content
3. Prefer minimal, targeted fixes over rewrites

### Component file locations

```
src/app/[locale]/
├── layout.tsx          # Root layout, navbar, footer
├── page.tsx            # Homepage
├── services/page.tsx   # Services page
├── store/page.tsx      # Store page
├── contact/page.tsx    # Contact page
├── blog/page.tsx       # Blog listing
└── blog/[slug]/page.tsx # Blog post

src/components/
├── hero/               # Hero section components
├── services/           # Service cards, pricing
├── store/              # Store grid, product cards
├── ui/                 # Shared UI (buttons, badges)
├── ClientDecorators.tsx # CommandPalette, NeonCursor, KonamiEasterEgg
└── Footer.tsx          # Site footer
```

### Important constraints

- **Server Components**: Pages with `export const metadata` must stay as Server Components. You CANNOT use `next/dynamic` with `ssr: false` in them.
- **Client Components**: Only components marked with `"use client"` can use hooks, browser APIs, or `ssr: false` dynamic imports.
- **CartSlideOver**: Already lazy-loaded via `next/dynamic` in layout.tsx (without ssr:false since layout is a Server Component).
- **Deploy**: Must happen from WSL2, never Windows. Use `pnpm` exclusively.

### Tailwind custom classes to know

- `bg-void`, `bg-void-light` — Custom dark backgrounds
- `border-neon-cyan`, `text-neon-cyan` — Brand accent
- `scanlines`, `scan-line` — CRT overlay effect
- `cyber-grid` — Decorative grid pattern
- `animate-fade-in-up` — Entry animation (with delay variants)
- `animate-gradient-shift` — Subtle moving gradient

## Design Principles for Cloudless

1. **Dark-first**: Everything is designed for dark backgrounds. Never introduce light backgrounds.
2. **Terminal aesthetic**: Lean into the CLI/hacker vibe — terminal windows, monospace labels, status indicators.
3. **Neon accents sparingly**: Cyan and magenta should highlight, not overwhelm. One accent color per heading.
4. **Whitespace is intentional**: Breathing room is good, but empty viewports are not. Every screen should show meaningful content.
5. **Mobile-aware**: All grids collapse gracefully. Navbar should use hamburger menu below `md` breakpoint.
6. **Performance-conscious**: Lighthouse budget is 340KB script. Dynamic imports for heavy components. Images optimized.
