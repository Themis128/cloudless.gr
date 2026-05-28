# /ci-flaky `<workflow>` — Detect and diagnose flaky CI workflows

Analyses the last 30 runs of a workflow to determine if failures are intermittent (flaky) or a genuine regression. Posts a verdict: STABLE / FLAKY / CONSISTENTLY_FAILING.

## Arguments

- `workflow` — the workflow filename to analyse (e.g. `/ci-flaky deploy-pi.yml` or `/ci-flaky e2e.yml`)
- If no workflow is given, first call `mcp__cloudless-infra__gh_ci_summary` for `cloudless.gr` to find all failing workflows, then analyse each failing one.

## Steps

1. **Flakiness analysis** — call `mcp__cloudless-infra__gh_ci_flaky_detector` with:
   - `repo`: `cloudless.gr`
   - `workflow`: the given filename
   - `limit`: 30

   This returns: success rate, max failure streak, max success streak, current streak, and a timeline.

2. **Interpret the verdict**:

   **STABLE** (success rate ≥ 85%):
   - The current failure is likely a real regression, not flakiness.
   - Fetch failure logs: `mcp__cloudless-infra__gh_workflow_failure_logs` on the most recent failed run ID.
   - Summarise what changed: check recent commits on the failing branch.

   **FLAKY** (success rate 15–85%):
   - The workflow has intermittent failures — likely environment, timing, or resource contention.
   - Check if failures cluster on specific branches or times of day.
   - Suggest: re-run the failed job (`gh run rerun <id> --failed-only`), or investigate the flaky step from the logs.
   - Common causes for this repo: Pi runner resource spikes, network timeouts on ARM build, Playwright test timing.

   **CONSISTENTLY_FAILING** (success rate < 15%):
   - This is a real breakage, not flakiness.
   - Fetch logs immediately: `mcp__cloudless-infra__gh_workflow_failure_logs` on the most recent run.
   - Check runner health: `mcp__cloudless-infra__gh_runner_health` for `cloudless.gr`.
   - Check if this started after a specific commit — correlate timeline with `gh log`.

3. **Print a clear summary**:
   ```
   Workflow:     deploy-pi.yml
   Verdict:      FLAKY
   Success rate: 63% (19/30 runs)
   Max fail streak: 3  |  Current streak: 2× failure
   
   Recommendation: Re-run the failed job. If it fails again, investigate
   the "Build ARM image" step which timed out in 4/11 failures.
   ```

## Notes

- Analyse one workflow at a time. If multiple workflows are failing, run this command for each.
- The Pi ARM runners are prone to resource spikes during heavy builds — a single failure on `deploy-pi.yml` is often flaky.
- `e2e.yml` / `k3s-standby-e2e.yml` failures after a Pi reboot are expected — the cluster needs ~2 minutes to stabilise.
- Do not cancel or re-run workflows automatically — suggest the command and let the user confirm.
