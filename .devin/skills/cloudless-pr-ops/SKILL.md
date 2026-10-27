# cloudless-pr-ops — land PRs on protected main (verified 2026-10-27)

## Protection facts

- Required checks: **Build, Unit Tests, Lint & Format, Type Check** — strict mode (up-to-date required).
- **`required_conversation_resolution` is ON** — a green+up-to-date PR still shows BLOCKED when review threads (Sentry bot) are unresolved. Resolve via GraphQL: `resolveReviewThread(input:{threadId})` after fetching `reviewThreads(first:100){nodes{isResolved,id}}`.
- Merge queue: none. A "Refresh open PRs" workflow merges main into open branches automatically — it cancels running CI on each push, so always verify check results against the CURRENT head SHA, never a stale one.
- Empty-diff PRs (fix already on main) → close, don't merge.

## Coverage gate

- `pnpm test:coverage:full` enforces global thresholds: **99.5% lines** / 97% stmts / 95% funcs / 87% branches. All tests can pass while the job fails on lines alone.
- To find the gap fast: run vitest with `--coverage --coverage.include="<new files>"` scoped to the relevant test files — the "Uncovered Line #s" column is line-precise. Cheapest closes: new page error/empty branches, route `catch` blocks, keyboard/typing guards, fire-and-forget `.catch` paths in chat-tools.
- `vi.mock` factories must use `vi.hoisted` for referenced vars; jsdom tests need `IS_REACT_ACT_ENVIRONMENT = true` and `await screen.findBy*` for async render.

## Stacked branches

- Several PRs branch off each other — detect by identical file lists in `gh pr view N --json files`. Merge only the top of each stack (or an umbrella branch merging the tops); the lower PRs go empty and auto-close or get closed as superseded.

## Dependabot rebuilds

- After another dep PR lands, lockfile conflicts appear. Rebuild rather than merge-resolve: fresh branch off main, apply the version bump(s) in the right package.json files, `pnpm install` with the repo's pinned pnpm (packageManager field, 9.15.x) in `CI=true` — a symlinked `node_modules` triggers an interactive reinstall prompt that silently aborts in CI mode.
