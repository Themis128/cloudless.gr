# PR auto-merge to main

Implements GitHub [auto-merge](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request)
plus [update-branch](https://docs.github.com/en/rest/pulls/pulls#update-a-pull-request-branch) so
strict "up to date with base" protection on `main` does not leave PRs stranded.

## Behaviour

| Event | Action |
| --- | --- |
| PR opened / synced / ready (→ `main`) | Update from `main`, arm **squash** auto-merge |
| Push to `main` | Refresh every eligible open PR |
| Merge conflict | Label `needs-rebase`, comment; **do not** invent resolutions |
| Labels `no-automerge` / `do-not-merge` / `wip` | Skip |
| Dependabot | Handled by `dependabot-automerge.yml` only |

## Required checks (branch protection)

`Build` · `Unit Tests` · `Lint & Format` · `Type Check` — all must be green
before GitHub completes the auto-merge. Repo setting **Allow auto-merge** must stay on.

## Opt out

Add label `no-automerge` (or `do-not-merge` / `wip`) on the PR.

## Bot update-branch loop

`update-branch` merges performed as `github-actions[bot]` can put subsequent
PR workflow runs into `action_required` (awaiting approval). The arm job
**skips** update-branch when `github.actor == github-actions[bot]`. Prefer a
repo secret `GITHUB_PAT` (classic PAT with `repo` scope) so refresh merges are
attributed to a user and CI runs without approval gates.
