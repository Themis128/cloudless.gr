# /ci-pr-checks `<PR number>` — Check CI status for a pull request

Shows all check runs for a specific PR: which are failing, pending, or passing. Use before merging or when a PR is blocked.

## Arguments

- `PR number` — the pull request number to inspect (e.g. `/ci-pr-checks 207`)
- If no PR number is given, ask the user which PR they want to check.

## Steps

1. **PR checks** — call `mcp__cloudless-infra__gh_pr_checks` with the given PR number and repo `cloudless.gr`.

   This returns all check runs grouped by failing / pending / passing, with direct links.

2. **If any checks are failing**:
   - For each failing check that is a GitHub Actions run (has a run ID in the URL), extract the run ID.
   - Call `mcp__cloudless-infra__gh_workflow_failure_logs` with that run ID (max_lines 80) to get the actual error.
   - Print a concise summary: which step failed and the key error lines.

3. **If a check is flaky** (has failed intermittently in recent history):
   - Call `mcp__cloudless-infra__gh_ci_flaky_detector` with the workflow filename and limit 20.
   - Report whether it is STABLE / FLAKY / CONSISTENTLY_FAILING.
   - If FLAKY: suggest re-running the failing check (`gh run rerun <id> --repo Themis128/cloudless.gr`).

4. **Print the verdict**:
   - All passing → "✅ PR #N is clear to merge"
   - Pending → "⏳ N checks still running — check back in a few minutes"
   - Failing → "❌ N checks failing — `<list with root cause summary>`"

## Notes

- Default repo is `cloudless.gr`. If the user mentions a different repo, use that.
- SonarCloud checks appear in the PR check list — if failing, the issue is code quality, not CI infrastructure.
- Lighthouse CI checks appear as `treosh/lighthouse-ci-action` — if failing, use `/lighthouse-triage`.
- Do not approve or merge PRs — only report and diagnose.
