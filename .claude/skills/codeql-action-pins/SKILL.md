---
name: codeql-action-pins
description: Fix the recurring codeql-action version skew — init/autobuild/analyze must all pin to the same tag SHA. Use when CodeQL "Analyze (javascript-typescript)" fails with "Loaded a configuration file for version X, but running version Y", or when reviewing Dependabot PRs that bump github/codeql-action/*. Happened twice: #1899 (4.37.x→4.38.1) and #1997 (4.38.1→4.38.2).
---

# codeql-action pin alignment

`.github/workflows/codeql.yml` uses three actions from the same repo, all
SHA-pinned to a tag. They **must share one commit**:

```yaml
uses: github/codeql-action/init@<SHA>       # vX.Y.Z
uses: github/codeql-action/autobuild@<SHA>  # vX.Y.Z
uses: github/codeql-action/analyze@<SHA>    # vX.Y.Z
```

## Symptom

`Analyze (javascript-typescript)` fails in ~40s during Autobuild:

```
We were unable to automatically build your code...
Loaded a configuration file for version '4.38.1', but running version '4.38.2'
```

Cause: Dependabot opens **separate PRs per action reference**, so autobuild
and analyze get bumped while init (or vice versa) stays behind. Every PR then
fails until the pins re-align.

## Fix (identical both times it happened)

1. Pick the newest tag's SHA (all three actions share the tag commit —
   verify on the codeql-action releases/tags page).
2. Repin all three `uses:` to that SHA, update the `# vX.Y.Z` comments.
3. One PR — do not land partial bumps.

## Preventing recurrence when reviewing Dependabot PRs

- A dependabot PR bumping only `autobuild` or only `analyze` is a **breaking
  PR in waiting** — check whether sibling actions are bumped in other open
  PRs before merging; if init lags, repin it in the same PR or a follow-up
  immediately.
- The SHA drift watchdog does not catch this (SHAs are all valid, just
  different versions).

## History

- #1899 (2026-09-21): init bumped to 4.38.1 while autobuild 4.37.8 / analyze
  4.37.9 — aligned all to 4.38.1.
- #1997 (2026-09-28): autobuild+analyze bumped to 4.38.2, init left at
  4.38.1 — aligned all to `2892aa5e` (v4.38.2).
