---
name: web-modernize
description: |
  Orchestrate a Modern Web Guidance modernization/audit pass on a codebase or
  directory. Use when asked to "modernize", "legacy-scan", "audit for legacy
  web patterns", "fix modern-web-guidance findings", or to verify a web codebase
  against current platform best practices. Wraps the modern-web-guidance skill's
  CLI (search/retrieve/legacy-scan) with a fix-and-verify workflow and this
  repo's PR conventions. Pairs with the modern-web-guidance skill — invoke that
  first for guide lookups; use this skill for end-to-end passes.
triggers:
  - user
  - model
---

# Web Modernize

End-to-end workflow for finding and fixing legacy web-platform patterns using
Google's Modern Web Guidance (`modern-web-guidance` skill + CLI).

## Prerequisites

- The `modern-web-guidance` skill must be installed (project
  `.agents/skills/`, or globally at `~/.config/devin/skills/`).
- CLI access: prefer the `mwg` wrapper (`~/scripts/mwg`, PATH-safe on WSL);
  otherwise `npx -y modern-web-guidance@latest <cmd>`. Run `mwg doctor` if
  `npx`/`node` errors appear.

## Workflow

### 1. Baseline scan

```bash
mwg legacy-scan <target-dir> --json > /tmp/mwg-scan.json
```

Parse `totalFindings` and each `guides[].rules[].findings[]` (file, line,
message). If zero, report clean and stop (optionally still do step 4's
semantic spot-check for the requested scope).

### 2. Retrieve the governing guide(s)

For each distinct `guideId` in the findings:

```bash
mwg retrieve "<guideId>"
```

Apply the guide's recommended pattern **and its stated fallback strategy** —
do not improvise. If output is saved to a temp file (>9.5 KB), read it fully.

### 3. Apply fixes — scanner-visible conventions

The deterministic scanner is textual: it cannot see through helpers. Write the
checks **inline** in the handler/stylesheet:

- **IME-safe Enter submit** — inside the `keydown` handler, after
  `event.preventDefault()`:
  `if (event.isComposing || event.keyCode === 229) return;`
  (React: `e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229`)
- **Dark mode / color-scheme** — declare `color-scheme` on `:root`/`html`
  (`light dark`) and pin per theme attribute (`[data-theme="light"]` →
  `light`, `[data-theme="dark"]` → `dark`); emit
  `<meta name="color-scheme" content="light dark">` in the root layout.
- **Modal overlays → native `<dialog>`** — replace `role="dialog"` +
  `aria-modal` + manual focus-trap/Escape/focus-restore with
  `showModal()` (see `src/components/CookieConsent.tsx`,
  `src/components/CommandPalette.tsx`). For light dismiss add
  `closedby="any"` via spread (`{...({ closedby: "any" } as
Record<string, string>)}` — TS doesn't know the attribute yet) plus a
  **feature-detected** backdrop-click fallback gated on
  `!("closedBy" in HTMLDialogElement.prototype)` — unconditional manual
  dismiss listeners get flagged by the scanner. Guard `showModal()`/
  `close()` for jsdom. Add `overscroll-behavior: contain` on
  `dialog:modal` and `dialog::backdrop` (see `src/app/theme-v2.css`).
  Skip conversion only when e2e selectors depend on a structure that a
  `<dialog>` can't preserve — drawers that must stay mounted for gestures
  use the `navigation-drawer` scroll-snap pattern instead (see below).
- **Coverage gate (99.5% lines)** — jsdom has no `showModal()`/`close()`,
  `scrollTo`, or `IntersectionObserver`, so native-only calls are
  uncoverable: wrap them in `/* v8 ignore start */ … /* v8 ignore stop */`
  (**`ignore next` is NOT honored by this Vitest version**). Cover what
  jsdom _can_ reach — dispatch `new Event("close")` on the dialog to
  exercise the close→React-state sync, fire Escape for the fallback path,
  and unit-test pure helpers (e.g. `src/lib/top-layer.ts`) with stub
  elements. jsdom also treats a closed `<dialog>` as hidden: role queries
  inside it need `hidden: true`.
- **Top-layer motion** — entry/exit animation is CSS-only:
  `@starting-style` + `transition-behavior: allow-discrete` (separate
  declaration, never the shorthand) + `overlay` in transition-property,
  gated by `:where(:not([data-closing]))` on the open selector. Exit needs
  Chromium-only `overlay`+display transitions; Firefox/Safari use the
  `data-closing` + `getAnimations()` fallback in `src/lib/top-layer.ts`
  (`requestDialogClose`). Route `cancel` events through it; keep the
  document-Escape fallback but skip it when `dialog.close` exists (real
  browsers) and never let it close a drawer when another `dialog[open]`
  is layered above. Respect `prefers-reduced-motion` (transforms only under
  `no-preference`, 0.1s under `reduce`).
- **Slide-over drawers** — use the `navigation-drawer` pattern
  (`CartSlideOver.tsx` + `.cart-drawer*` in theme-v2.css): modal `<dialog>`
  using horizontal scroll-snap (two snap stops = open/closed),
  IntersectionObserver on the sheet as state source-of-truth,
  scroll-driven `--cart-backdrop` fade with a scroll-listener fallback,
  `cancel`→animated close. Gotchas learned in review: unmemoized context
  callbacks (new identity per render) must be read through a ref so the
  observer effect runs once; and only treat a below-threshold
  IntersectionObserver entry as "closed" after the sheet was seen open
  (`ratio > 0.5` flag) — the initial ratio-0 delivery during the open
  scroll animation otherwise slams the drawer shut. Every dismiss path
  (React `isOpen→false`, backdrop tap, `cancel`, swipe settle) must share
  one helper that re-arms the seen-open flag and closes directly when the
  scroller is already parked at the closed stop — plus a scroll-settle
  debounce (`scrollLeft <= 1` after ~150ms quiet) as the backstop for
  gesture-driven closes the observer's flag would otherwise ignore,
  otherwise an interrupted open leaves an invisible modal `<dialog>`
  blocking the page. For a RIGHT-edge
  drawer put the spacer column
  first (`grid-template-columns: 100% var(--w)`), sheet `grid-column: 2` +
  `scroll-snap-align: end`, spacer `scroll-snap-align: start` — scrollLeft
  0 is naturally closed so no `scroll-initial-target` fallback is needed.
  Do NOT use `closedby="any"` on viewport-filling drawers (taps land on the
  dialog, bypassing the slide-out animation).

For other guides, follow the guide verbatim; when it offers fallbacks, pick
the Baseline-safe one unless the codebase already requires otherwise.

### 4. Semantic pass (the ~80% the scanner can't see)

For the requested scope, run targeted searches before writing UI code:

```bash
mwg search "<2-5 word action query>"   # e.g. "light dismiss dialog"
mwg retrieve "<id>"
```

Prefer native platform APIs over libraries/polyfills when a guide covers the
pattern (dialogs, scroll-driven animation, anchor positioning, container
queries, view transitions, form autofill, etc.).

### 5. Verify

- Re-run `mwg legacy-scan <target-dir> --json` → must be `0` findings.
- Run the repo's own gates: typecheck, lint, format check, unit tests —
  whatever the project defines (check package.json / AGENTS.md).
- For UI changes, exercise the flow (dev server / Playwright) when feasible.

### 6. Land it

- Follow repo git rules (cloudless.gr: feature branch → PR → squash
  auto-merge; never commit to `main` directly).
- If a CI gate exists (`modern-web-guidance.yml`), the PR must keep
  `legacy-scan` green — that means fixes stay scanner-visible (no helpers
  hiding the checks).

## Autonomous mode

This workflow can run inside the `modernizer` subagent
(`~/.config/devin/agents/modernizer.md` or the plugin's `agents/`) for
unsupervised passes: give it a target dir + scope, it scans, fixes, verifies,
and reports a diff summary. Keep the parent agent for PR/commit decisions.
